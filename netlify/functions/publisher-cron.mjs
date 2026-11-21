import { runDueSchedules } from "./_shared/publisher-schedule.mjs";
import { dispatchPublisher } from "./publisher.mjs";

// Netlify scheduled functions run on UTC schedule; publishAt is an ISO instant.
export default async () => {
  const processed=await runDueSchedules(dispatchPublisher);
  console.log("Publisher scheduled jobs processed:",JSON.stringify(processed));
};
export const config={schedule:"* * * * *"};
