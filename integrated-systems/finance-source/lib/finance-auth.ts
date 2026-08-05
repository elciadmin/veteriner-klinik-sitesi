import { Buffer } from "node:buffer";
import { cookies } from "next/headers";

export type FinanceRole = "editor" | "viewer";
export type FinanceUser = { email: string; role: FinanceRole };

type SignedPayload = FinanceUser & {
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  nonce?: string;
};

const SESSION_COOKIE = "__Host-elci_finance_session";
const SESSION_AUDIENCE = "elci-finance-session";
const LAUNCH_AUDIENCE = "elci-finance";
const MAX_CLOCK_SKEW_SECONDS = 60;

export class FinanceAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = "FINANCE_AUTH_REQUIRED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function emailList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

async function runtimeEnv(): Promise<Record<string, unknown>> {
  try {
    const workerModule = (await import("cloudflare:workers")) as {
      env?: Record<string, unknown>;
    };
    return workerModule.env ?? {};
  } catch {
    return process.env as Record<string, unknown>;
  }
}

async function envValue(name: string) {
  const env = await runtimeEnv();
  return String(env[name] ?? process.env[name] ?? "").trim();
}

async function sharedSecret() {
  const secret = await envValue("FINANCE_ACCESS_SHARED_SECRET");
  if (secret.length < 32) {
    throw new FinanceAuthError(
      "Finans erişim anahtarı yapılandırılmadı.",
      503,
      "FINANCE_SECRET_MISSING",
    );
  }
  return secret;
}

function decodePayload(encoded: string): SignedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new FinanceAuthError("Geçersiz finans oturumu.", 401, "INVALID_TOKEN");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new FinanceAuthError("Geçersiz finans oturumu.", 401, "INVALID_TOKEN");
  }
  const payload = parsed as Partial<SignedPayload>;
  const email = normalizeEmail(payload.email);
  const role = payload.role === "editor" || payload.role === "viewer" ? payload.role : null;
  if (!email || !role || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) {
    throw new FinanceAuthError("Eksik finans oturumu.", 401, "INVALID_TOKEN");
  }
  return { ...payload, email, role } as SignedPayload;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Buffer.from(signature).toString("base64url");
}

async function verifyToken(token: string, audience: string) {
  const [version, encoded, suppliedSignature, ...rest] = String(token ?? "").split(".");
  if (version !== "v1" || !encoded || !suppliedSignature || rest.length) {
    throw new FinanceAuthError("Geçersiz finans oturumu.", 401, "INVALID_TOKEN");
  }
  const secret = await sharedSecret();
  const expectedSignature = await hmac(`v1.${encoded}`, secret);
  if (!safeEqual(suppliedSignature, expectedSignature)) {
    throw new FinanceAuthError("Finans oturumu doğrulanamadı.", 401, "INVALID_SIGNATURE");
  }
  const payload = decodePayload(encoded);
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== audience || payload.iat > now + MAX_CLOCK_SKEW_SECONDS || payload.exp < now) {
    throw new FinanceAuthError("Finans oturumunun süresi doldu.", 401, "TOKEN_EXPIRED");
  }
  return payload;
}

export async function verifyLaunchToken(token: string) {
  const payload = await verifyToken(token, LAUNCH_AUDIENCE);
  if (payload.iss !== "elci-netlify-admin") {
    throw new FinanceAuthError("Finans bağlantı kaynağı geçersiz.", 401, "INVALID_ISSUER");
  }
  return payload;
}


export async function financeSessionDurationSeconds() {
  const raw = await envValue("FINANCE_SESSION_HOURS");
  const hours = raw ? Number(raw) : Number.NaN;
  const safeHours = Number.isFinite(hours) ? Math.min(8, Math.max(0.25, hours)) : 4;
  return Math.round(safeHours * 60 * 60);
}

export async function createSessionToken(user: FinanceUser, durationSeconds = 4 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SignedPayload = {
    aud: SESSION_AUDIENCE,
    iss: "elci-finance-app",
    email: normalizeEmail(user.email),
    role: user.role,
    iat: now,
    exp: now + durationSeconds,
    nonce: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await hmac(`v1.${encoded}`, await sharedSecret());
  return `v1.${encoded}.${signature}`;
}

export async function financeUserFromRequest(request: Request): Promise<FinanceUser | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)__Host-elci_finance_session=([^;]+)/);
  if (match?.[1]) {
    try {
      const payload = await verifyToken(decodeURIComponent(match[1]), SESSION_AUDIENCE);
      return { email: payload.email, role: payload.role };
    } catch (error) {
      if (error instanceof FinanceAuthError && error.status === 503) throw error;
    }
  }
  return null;
}

export async function requireFinanceApiUser(request: Request, write = false) {
  const user = await financeUserFromRequest(request);
  if (!user) {
    throw new FinanceAuthError("Finans sistemine güvenli giriş yapın.", 401, "LOGIN_REQUIRED");
  }
  if (write && user.role !== "editor") {
    throw new FinanceAuthError("Bu hesap yalnızca görüntüleme yetkisine sahip.", 403, "READ_ONLY");
  }
  return user;
}

export async function financePageUser(): Promise<FinanceUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const payload = await verifyToken(token, SESSION_AUDIENCE);
      return { email: payload.email, role: payload.role };
    } catch (error) {
      if (error instanceof FinanceAuthError && error.status === 503) throw error;
    }
  }
  return null;
}

export function financeSessionCookie(token: string, maxAgeSeconds = 4 * 60 * 60) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Priority=High; Max-Age=${maxAgeSeconds}`;
}

export function clearFinanceSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Priority=High; Max-Age=0`;
}

export function safeReturnPath(value: string | null) {
  const raw = String(value ?? "/");
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  try {
    const url = new URL(raw, "https://finance.local");
    if (url.origin !== "https://finance.local") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
