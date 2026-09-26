import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "elci-publisher-oauth-v1";

function dedicatedKey() {
  return String(process.env.PUBLISHER_TOKEN_ENCRYPTION_KEY || "").trim();
}

function fallbackSecret() {
  return String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.META_APP_SECRET || "").trim();
}

export function oauthEncryptionConfigured() {
  const dedicated = dedicatedKey();
  if (dedicated) return /^[0-9a-f]{64}$/i.test(dedicated);
  return Boolean(fallbackSecret());
}

function keyBytes() {
  const dedicated = dedicatedKey();
  if (dedicated) {
    if (!/^[0-9a-f]{64}$/i.test(dedicated)) throw new Error("OAuth şifreleme anahtarı geçersiz");
    return Buffer.from(dedicated,"hex");
  }
  const fallback = fallbackSecret();
  if (!fallback) throw new Error("OAuth şifreleme anahtarı yapılandırılmamış");
  return createHash("sha256")
    .update("elci-publisher-oauth-v1\0" + fallback,"utf8")
    .digest();
}

export function oauthStore() {
  return getStore({name:STORE_NAME,consistency:"strong"});
}

export function encryptJson(data) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm",keyBytes(),iv);
  const plaintext = Buffer.from(JSON.stringify(data),"utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv,tag,encrypted].map(x=>x.toString("base64url")).join(".");
}

export function decryptJson(value) {
  const [ivRaw,tagRaw,dataRaw] = String(value || "").split(".");
  if (!ivRaw || !tagRaw || !dataRaw) return null;
  const decipher = createDecipheriv("aes-256-gcm",keyBytes(),Buffer.from(ivRaw,"base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw,"base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataRaw,"base64url")),decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

export async function saveOAuthSecret(name,data,metadata={}) {
  const store = oauthStore();
  await store.setJSON("secret/" + name,{ciphertext:encryptJson(data),updatedAt:new Date().toISOString()},{
    metadata:{name,...metadata,updatedAt:new Date().toISOString()}
  });
}

export async function loadOAuthSecret(name) {
  const row = await oauthStore().get("secret/" + name,{type:"json",consistency:"strong"});
  if (!row?.ciphertext) return null;
  try { return decryptJson(row.ciphertext); }
  catch { return null; }
}

export async function deleteOAuthSecret(name) {
  await oauthStore().delete("secret/" + name);
}

export async function saveOAuthState(state,data) {
  await oauthStore().setJSON("state/" + state,{
    ciphertext:encryptJson(data),
    expiresAt:Date.now() + 10 * 60 * 1000
  },{metadata:{provider:data.provider,expiresAt:Date.now() + 10 * 60 * 1000}});
}

export async function consumeOAuthState(state) {
  const store = oauthStore();
  const key = "state/" + String(state || "");
  const row = await store.get(key,{type:"json",consistency:"strong"});
  await store.delete(key).catch(()=>{});
  if (!row?.ciphertext || Number(row.expiresAt || 0) < Date.now()) return null;
  try { return decryptJson(row.ciphertext); }
  catch { return null; }
}
