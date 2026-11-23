import test from "node:test";
import assert from "node:assert/strict";
import { validSchedule, runDueSchedules } from "../netlify/functions/_shared/publisher-schedule.mjs";

test("schedule dates must be at least one minute ahead and within a year", () => {
  const now=Date.parse("2026-11-23T12:00:00.000Z");
  assert.equal(validSchedule("2026-11-23T12:00:59.000Z",now),false);
  assert.equal(validSchedule("2026-11-23T12:01:00.000Z",now),true);
  assert.equal(validSchedule("invalid",now),false);
  assert.equal(validSchedule("2028-11-23T12:00:00.000Z",now),false);
});

test("scheduler never dispatches while atomic claims are unavailable", async () => {
  let calls=0;
  const result=await runDueSchedules(async()=>{calls++;});
  assert.deepEqual(result,[]);
  assert.equal(calls,0);
});
