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
// Disabled until a durable, atomic claim and per-channel idempotency are implemented.
// A configuration toggle alone must never enable unsafe external publication.
export async function runDueSchedules() {
  return [];
}
