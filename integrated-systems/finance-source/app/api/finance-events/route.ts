import { and, asc, eq, gte, lte } from "drizzle-orm";

import { getDb } from "@/db";
import { financialEvents, financialJournalLines, idempotencyCommands, monthlyClosings } from "@/db/schema";
import { ACCOUNTS, assertBalanced, reversalJournal } from "@/lib/journal-core.mjs";
import { FinanceAuthError, requireFinanceApiUser } from "@/lib/finance-auth";
import { isPeriodLocked } from "@/lib/monthly-close.mjs";

const ACCOUNT_CODES = new Set(Object.values(ACCOUNTS));
const EVENT_TYPES = new Set([
  "sale", "purchase", "receivable_collection", "payable_payment",
  "pos_settlement", "stock_consumption", "owner_draw", "reversal",
]);

type JournalLineInput = {
  id?: string;
  accountCode: string;
  debitCents?: number;
  creditCents?: number;
  taxCode?: string;
  inventoryItemId?: string;
  ledgerRecordId?: string;
  memo?: string;
};

type FinanceEventInput = {
  id: string;
  eventType: string;
  effectiveDate: string;
  sourceModule: string;
  sourceRecordId: string;
  counterparty?: string;
  description?: string;
  documentId?: string;
  reversalOfId?: string;
  payload?: Record<string, unknown>;
  lines: JournalLineInput[];
};

function responseError(error: unknown, fallback = 400) {
  const status = error instanceof FinanceAuthError ? error.status : fallback;
  return Response.json({ ok: false, error: error instanceof Error ? error.message : "Finans olayı işlenemedi." }, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateEvent(input: FinanceEventInput) {
  if (!/^evt-[A-Za-z0-9._-]{8,120}$/.test(input.id)) throw new Error("Finans olayı kimliği geçersiz.");
  if (!EVENT_TYPES.has(input.eventType)) throw new Error("Finans olay türü geçersiz.");
  if (!isIsoDate(input.effectiveDate)) throw new Error("Finans olay tarihi geçersiz.");
  if (!input.sourceModule?.trim() || !input.sourceRecordId?.trim()) throw new Error("Kaynak modül ve kaynak kayıt zorunludur.");
  if (!Array.isArray(input.lines) || input.lines.length < 2 || input.lines.length > 20) throw new Error("Finans olayı 2–20 dengeli jurnal satırı içermelidir.");
  const lines = input.lines.map((line) => {
    const debitCents = Number(line.debitCents ?? 0);
    const creditCents = Number(line.creditCents ?? 0);
    if (!ACCOUNT_CODES.has(line.accountCode)) throw new Error("Hesap planı dışında jurnal hesabı kullanılamaz.");
    if (!Number.isInteger(debitCents) || !Number.isInteger(creditCents) || debitCents < 0 || creditCents < 0) throw new Error("Jurnal tutarları geçerli tam kuruş olmalıdır.");
    if ((debitCents > 0) === (creditCents > 0)) throw new Error("Her jurnal satırı yalnız borç veya alacak içermelidir.");
    return { ...line, debitCents, creditCents };
  });
  assertBalanced(lines);
  return lines;
}

async function hashPayload(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceApiUser(request, true);
    const payload = await request.json() as { idempotencyKey?: string; event?: FinanceEventInput };
    const key = String(payload.idempotencyKey ?? "");
    const event = payload.event;
    if (!/^cmd-[A-Za-z0-9._-]{12,140}$/.test(key)) throw new Error("Yeniden deneme anahtarı geçersiz.");
    if (!event) throw new Error("Finans olayı eksik.");
    const lines = validateEvent(event);
    const payloadSha256 = await hashPayload(event);
    const db = await getDb();
    const closings = await db.select({ period: monthlyClosings.periodKey, status: monthlyClosings.status }).from(monthlyClosings);
    if (isPeriodLocked(event.effectiveDate, closings)) {
      return Response.json({ ok: false, error: `${event.effectiveDate.slice(0, 7)} dönemi kapalı. Yeni açık dönemde gerekçeli düzeltme kaydı oluşturun.` }, { status: 409, headers: { "cache-control": "no-store, private" } });
    }
    if (event.eventType === "reversal") {
      if (!event.reversalOfId) throw new Error("Ters kayıtta özgün finans olayı zorunludur.");
      const original = (await db.select().from(financialEvents).where(eq(financialEvents.id, event.reversalOfId)).limit(1))[0];
      if (!original || original.status !== "posted") throw new Error("Terslenecek finans olayı bulunamadı.");
      const prior = (await db.select({ id: financialEvents.id }).from(financialEvents).where(eq(financialEvents.reversalOfId, event.reversalOfId)).limit(1))[0];
      if (prior) throw new Error("Bu finans olayı daha önce terslenmiş.");
      const originalLines = await db.select().from(financialJournalLines).where(eq(financialJournalLines.eventId, original.id));
      const expected = reversalJournal(originalLines);
      const matches = expected.length === lines.length && expected.every((line, index) => (
        line.accountCode === lines[index].accountCode &&
        line.debitCents === lines[index].debitCents &&
        line.creditCents === lines[index].creditCents
      ));
      if (!matches) throw new Error("Ters jurnal, özgün olayın tam karşılığı olmalıdır.");
    } else if (event.reversalOfId) {
      throw new Error("reversalOfId yalnız ters kayıt olayında kullanılabilir.");
    }
    const known = (await db.select().from(idempotencyCommands).where(eq(idempotencyCommands.idempotencyKey, key)).limit(1))[0];
    if (known) {
      if (known.action !== "post_financial_event" || known.payloadSha256 !== payloadSha256) {
        return Response.json({ ok: false, error: "Bu yeniden deneme anahtarı farklı bir işlem için kullanılmış.", code: "IDEMPOTENCY_KEY_REUSED" }, { status: 409, headers: { "cache-control": "no-store, private" } });
      }
      if (known.status === "completed") return Response.json(JSON.parse(known.responseJson), { headers: { "cache-control": "no-store, private" } });
      return Response.json({ ok: false, error: "Bu işlem hâlâ işleniyor; tekrar göndermeyin." }, { status: 409, headers: { "cache-control": "no-store, private" } });
    }
    const response = { ok: true, eventId: event.id, lineCount: lines.length, balanced: true };
    const now = new Date().toISOString();
    const eventValues = {
      id: event.id,
      eventType: event.eventType,
      effectiveDate: event.effectiveDate,
      status: "posted",
      sourceModule: event.sourceModule.trim(),
      sourceRecordId: event.sourceRecordId.trim(),
      counterparty: event.counterparty?.trim() || "",
      description: event.description?.trim() || "",
      documentId: event.documentId || null,
      reversalOfId: event.reversalOfId || null,
      payloadJson: JSON.stringify(event.payload ?? {}),
      createdBy: user.email,
    };
    const batches = [
      db.insert(idempotencyCommands).values({
        idempotencyKey: key,
        action: "post_financial_event",
        actorEmail: user.email,
        payloadSha256,
        status: "completed",
        responseJson: JSON.stringify(response),
        completedAt: now,
      }),
      db.insert(financialEvents).values(eventValues),
      ...lines.map((line, index) => db.insert(financialJournalLines).values({
        id: line.id || `jln-${event.id}-${index + 1}`,
        eventId: event.id,
        accountCode: line.accountCode,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
        taxCode: line.taxCode || "",
        inventoryItemId: line.inventoryItemId || null,
        ledgerRecordId: line.ledgerRecordId || null,
        memo: line.memo || "",
      })),
    ];
    await db.batch(batches as never[]);
    return Response.json(response, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return responseError(error, 400);
  }
}

export async function GET(request: Request) {
  try {
    await requireFinanceApiUser(request, false);
    const url = new URL(request.url);
    const start = url.searchParams.get("start") ?? "";
    const end = url.searchParams.get("end") ?? "";
    if ((start && !isIsoDate(start)) || (end && !isIsoDate(end)) || (start && end && start > end)) throw new Error("Rapor dönem aralığı geçersiz.");
    const db = await getDb();
    let query = db.select().from(financialEvents).orderBy(asc(financialEvents.effectiveDate), asc(financialEvents.createdAt));
    if (start && end) query = db.select().from(financialEvents).where(and(gte(financialEvents.effectiveDate, start), lte(financialEvents.effectiveDate, end))).orderBy(asc(financialEvents.effectiveDate), asc(financialEvents.createdAt)) as typeof query;
    else if (start) query = db.select().from(financialEvents).where(gte(financialEvents.effectiveDate, start)).orderBy(asc(financialEvents.effectiveDate), asc(financialEvents.createdAt)) as typeof query;
    else if (end) query = db.select().from(financialEvents).where(lte(financialEvents.effectiveDate, end)).orderBy(asc(financialEvents.effectiveDate), asc(financialEvents.createdAt)) as typeof query;
    const events = await query;
    return Response.json({ ok: true, events: events.slice(0, 250) }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return responseError(error, 400);
  }
}
