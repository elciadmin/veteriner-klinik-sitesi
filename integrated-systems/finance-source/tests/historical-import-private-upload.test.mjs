import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/historical-import/route.ts", "utf8");
const view = readFileSync("app/historical-import-view.tsx", "utf8");

test("historical import route does not bundle private clinic data", () => {
  assert.doesNotMatch(route, /data\/imports\/elci-20260805\.json/);
  assert.match(route, /local-private-json/);
});

test("historical import view requires a local JSON selection", () => {
  assert.match(view, /type="file"/);
  assert.match(view, /validateHistoricalImportPackage/);
  assert.match(view, /aktarımı\s+onaylayana kadar sunucuya gönderilmez/);
});
