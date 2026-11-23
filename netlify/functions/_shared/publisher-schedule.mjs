import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const store = () => getStore({name:"elci-publisher-schedule-v1",consistency:"strong"});
const key = id => "job/"+id;
export const validSchedule = (at, now=Date.now()) => {
  const time=Date.parse(at);
  return Number.isFinite(time) && time>=now+60_000 && time<=now+365*86400000;
};
export async function schedulePublication({payload,channels,publishAt,actor}) {
  if (!validSchedule(publishAt)) throw new Error("Yayın tarihi en az 1 dakika sonrası, en fazla 1 yıl sonrası olmalı");
  const id=randomUUID(),createdAt=new Date().toISOString();
  const job={id,payload,channels,publishAt:new Date(publishAt).toISOString(),actor,createdAt,status:"pending",attempts:0,results:[]};
  await store().setJSON(key(id),job);
  return job;
}
export async function getSchedule(id) {return store().get(key(id),{type:"json",consistency:"strong"});}
export async function listSchedules() {
  const {blobs}=await store().list({prefix:"job/"});
  const jobs=(await Promise.all(blobs.map(x=>getSchedule(x.key.slice(4))))).filter(Boolean);
  return jobs.sort((a,b)=>a.publishAt.localeCompare(b.publishAt));
}
export async function cancelSchedule(id) {
  const job=await getSchedule(id);
  if (!job || job.status!=="pending") return false;
  job.status="cancelled";job.updatedAt=new Date().toISOString();
  await store().setJSON(key(id),job);return true;
}
export async function runDueSchedules(dispatch,{now=Date.now(),max=20}={}) {
  // Safety: never dispatch when this process has not explicitly opted in.
  if (process.env.ELCI_PUBLISHER_SCHEDULER_ENABLED !== "true" || process.env.CONTEXT !== "production" || process.env.ELCI_PUBLISHER_ATOMIC_CLAIM_READY !== "true") return [];
  const due=(await listSchedules()).filter(x=>x.status==="pending"&&Date.parse(x.publishAt)<=now).slice(0,max);
  const processed=[];
  for(const job of due) {
    // IMPORTANT: this read/write claim is not atomic. Do not enable production
    // scheduling until an atomic claim/idempotency layer is implemented.
    const latest=await getSchedule(job.id);
    if(latest?.status!=="pending") continue;
    latest.status="processing";latest.attempts+=1;latest.updatedAt=new Date().toISOString();
    await store().setJSON(key(job.id),latest);
    try {
      const results=await dispatch(latest.payload,latest.channels);
      latest.results=results;
      latest.status=results.every(r=>r.ok)?"published":"partial";
    } catch(e) {
      latest.status="failed";latest.error=String(e?.message||e).slice(0,300);
    }
    latest.updatedAt=new Date().toISOString();
    await store().setJSON(key(job.id),latest);
    processed.push({id:job.id,status:latest.status});
  }
  return processed;
}
