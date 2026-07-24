import { getStore } from "@netlify/blobs";
const STORE_NAME = "elci-appointments-v1";
export default async () => {
  const retentionDays = Number(process.env.APPOINTMENT_RETENTION_DAYS || "0");
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 86400000;
  const store = getStore({ name:STORE_NAME, consistency:"strong" });
  const { blobs } = await store.list({ prefix:"appointment/" });
  for (const { key } of blobs) {
    const record = await store.get(key, { type:"json", consistency:"strong" });
    const created = new Date(record?.createdAt || 0).getTime();
    if (created && created < cutoff && ["completed","cancelled","archived"].includes(record?.status)) await store.delete(key);
  }
};
export const config = { schedule:"15 1 * * *" };
