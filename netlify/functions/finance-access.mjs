import { createHmac, randomUUID } from "node:crypto";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  },
  body: JSON.stringify(body),
});

const normalizedEmails = value => String(value || "")
  .split(",")
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

const normalizedRoles = user => {
  const values = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
  ];
  return [...new Set(values.map(value => String(value).trim().toLowerCase()).filter(Boolean))];
};

const base64url = value => Buffer.from(value).toString("base64url");

function signLaunchToken(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`v1.${encoded}`).digest("base64url");
  return `v1.${encoded}.${signature}`;
}

function safeFinanceBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveAccess(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  const roles = normalizedRoles(user);
  const editors = normalizedEmails(process.env.FINANCE_EDITOR_EMAILS || process.env.FINANCE_ALLOWED_EMAILS);
  const viewers = normalizedEmails(process.env.FINANCE_VIEWER_EMAILS);
  const isEditor = editors.includes(email) || roles.some(role => ["admin", "finance-admin", "finance-editor"].includes(role));
  const isViewer = isEditor || viewers.includes(email) || roles.includes("finance-viewer");
  return { email, role: isEditor ? "editor" : isViewer ? "viewer" : null };
}

export default async event => {
  if (event.httpMethod !== "GET") return json(405, { ok:false, error:"Method not allowed" });

  const user = event.clientContext?.user;
  if (!user?.email) {
    return json(401, { ok:false, code:"LOGIN_REQUIRED", error:"Finans sistemi için güvenli yönetim hesabıyla giriş yapın." });
  }

  const access = resolveAccess(user);
  if (!access.role) {
    return json(403, { ok:false, code:"FINANCE_ACCESS_DENIED", error:"Bu hesabın finans sistemine erişim yetkisi yok." });
  }

  const baseUrl = safeFinanceBaseUrl(process.env.FINANCE_APP_URL);
  if (!baseUrl) {
    return json(503, { ok:false, code:"FINANCE_URL_MISSING", error:"FINANCE_APP_URL güvenli biçimde tanımlanmadı." });
  }

  const secret = String(process.env.FINANCE_ACCESS_SHARED_SECRET || "");
  if (secret.length < 32) {
    return json(503, { ok:false, code:"FINANCE_SECRET_MISSING", error:"Finans güvenli bağlantı anahtarı tanımlanmadı." });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signLaunchToken({
    aud: "elci-finance",
    iss: "elci-netlify-admin",
    email: access.email,
    role: access.role,
    iat: now,
    exp: now + 60,
    nonce: randomUUID(),
  }, secret);

  const launchUrl = new URL("/api/finance-session", `${baseUrl}/`);
  launchUrl.searchParams.set("token", token);
  launchUrl.searchParams.set("return_to", "/");

  return json(200, {
    ok:true,
    url:launchUrl.toString(),
    user:{ email:access.email, role:access.role },
  });
};

export const config = {
  path: "/.netlify/functions/finance-access",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
