import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testFiles = [
  "tests/recurring-expenses.test.mjs",
  "tests/report-export.test.mjs",
  "tests/decision-engine.test.mjs",
  "tests/monthly-close.test.mjs",
  "tests/finance-formulas.test.mjs",
  "tests/financial-core.test.mjs",
  "tests/quick-receipt.test.mjs",
  "tests/historical-import.test.mjs",
  "tests/finance-command.test.mjs",
  "tests/finance-command-v10.test.mjs",
  "tests/indexed-ledger.test.mjs",
  "tests/indexed-metals.test.mjs",
  "tests/recurring-v10.test.mjs",
  "tests/growth-planner.test.mjs",
];
const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

function readCount(label) {
  const match = output.match(new RegExp(`^(?:#|ℹ)\\s+${label}\\s+(\\d+)$`, "m"));
  return match ? Number(match[1]) : null;
}
const total = readCount("tests");
const passed = readCount("pass");
const failed = readCount("fail");
if (result.status !== 0 || total === null || passed === null || failed === null) {
  console.error("Test özeti doğrulanamadı; rapor dosyası güncellenmedi.");
  process.exit(result.status || 1);
}
const report = {
  date: new Date().toISOString().slice(0, 10),
  passed,
  total,
  failed,
  scope: "finance-core",
  generatedBy: "npm run test:core",
};
writeFileSync(
  resolve(root, "app/verified-test-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
console.log(`Doğrulanmış finans test raporu yazıldı: ${passed}/${total}`);
