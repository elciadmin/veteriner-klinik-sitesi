import assert from "node:assert/strict";
import financeAccess from "../netlify/functions/finance-access.mjs";

const original = { ...process.env };
const event = (user) => ({ httpMethod: "GET", clientContext: user ? { user } : {} });
const body = (response) => JSON.parse(response.body);

try {
  delete process.env.FINANCE_EDITOR_EMAILS;
  delete process.env.FINANCE_ALLOWED_EMAILS;
  delete process.env.FINANCE_VIEWER_EMAILS;
  delete process.env.FINANCE_APP_URL;
  delete process.env.FINANCE_ACCESS_SHARED_SECRET;

  let response = await financeAccess(event(null));
  assert.equal(response.statusCode, 401);

  response = await financeAccess(event({ email: "user@example.com", roles: [] }));
  assert.equal(response.statusCode, 403, "empty allowlists must fail closed");

  process.env.FINANCE_EDITOR_EMAILS = "editor@example.com";
  process.env.FINANCE_APP_URL = "http://unsafe.example";
  process.env.FINANCE_ACCESS_SHARED_SECRET = "x".repeat(40);
  response = await financeAccess(event({ email: "editor@example.com", roles: [] }));
  assert.equal(response.statusCode, 503, "non-HTTPS finance URL must be rejected");

  process.env.FINANCE_APP_URL = "https://finance.example";
  process.env.FINANCE_ACCESS_SHARED_SECRET = "short";
  response = await financeAccess(event({ email: "editor@example.com", roles: [] }));
  assert.equal(response.statusCode, 503, "short shared secret must be rejected");

  process.env.FINANCE_ACCESS_SHARED_SECRET = "a-secure-random-value-with-at-least-32-characters";
  response = await financeAccess(event({ email: "EDITOR@example.com", roles: [] }));
  assert.equal(response.statusCode, 200);
  const launch = new URL(body(response).url);
  assert.equal(launch.origin, "https://finance.example");
  assert.equal(launch.pathname, "/api/finance-session");
  const [version, encoded, signature] = launch.searchParams.get("token").split(".");
  assert.equal(version, "v1");
  assert.ok(signature.length >= 32);
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.equal(payload.email, "editor@example.com");
  assert.equal(payload.role, "editor");
  assert.equal(payload.aud, "elci-finance");
  assert.ok(payload.exp - payload.iat <= 60);

  console.log("Security smoke tests passed: 6/6");
} finally {
  process.env = original;
}
