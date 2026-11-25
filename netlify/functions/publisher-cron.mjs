import { runDueSchedules } from "./_shared/publisher-schedule.mjs";
import { dispatchPublisher } from "./publisher.mjs";

// Explicit production-only activation prevents accidental external publishing
// from development or preview deployments.
export default async () => {
  if (process.env.CONTEXT !== "production" || process.env.ELCI_PUBLISHER_SCHEDULER_ENABLED !== "true") {
    console.log("Publisher scheduler disabled; no posts dispatched.");
    return;
  }
  const processed=await runDueSchedules(dispatchPublisher);
  console.log("Publisher scheduled jobs processed:",JSON.stringify(processed));
};
export const config={schedule:"* * * * *"};
