import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { valuationRates } from "@/db/schema";
import { FinanceAuthError, requireFinanceApiUser } from "@/lib/finance-auth";

const TCMB_TODAY_XML = "https://www.tcmb.gov.tr/kurlar/today.xml";
const TRUNCGIL_TODAY_JSON = "https://finans.truncgil.com/today.json";

function parseNumber(value: string | undefined) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function currencyRate(xml: string, code: string) {
  const block = xml.match(new RegExp(`<Currency[^>]*(?:CurrencyCode|Kod)="${code}"[\\s\\S]*?<\\/Currency>`, "i"))?.[0] ?? "";
  const forexSelling = block.match(/<ForexSelling>([^<]+)<\/ForexSelling>/i)?.[1];
  const forexBuying = block.match(/<ForexBuying>([^<]+)<\/ForexBuying>/i)?.[1];
  const unit = Number(block.match(/<Unit>([^<]+)<\/Unit>/i)?.[1] ?? 1) || 1;
  const quoted = parseNumber(forexSelling) ?? parseNumber(forexBuying);
  return quoted ? quoted / unit : null;
}

function providerRate(data: Record<string, unknown>, key: string) {
  const row = data[key] as Record<string, unknown> | undefined;
  return parseNumber(String(row?.["Satış"] ?? row?.["Alış"] ?? ""));
}

function errorResponse(error: unknown) {
  const status = error instanceof FinanceAuthError ? error.status : 502;
  const message = error instanceof Error ? error.message : "Kur bilgisi alınamadı.";
  return Response.json({ ok: false, error: message }, { status, headers: { "cache-control": "no-store, private" } });
}

export async function GET(request: Request) {
  try {
    await requireFinanceApiUser(request, false);
    const db = await getDb();
    const stored = await db.select().from(valuationRates).orderBy(desc(valuationRates.effectiveAt)).limit(250);
    const manualRates: Record<string, number> = {};
    const manualAsOf: Record<string, string> = {};
    for (const row of stored) {
      if (manualRates[row.assetCode] !== undefined) continue;
      manualRates[row.assetCode] = row.unitPriceCents / 100;
      manualAsOf[row.assetCode] = row.effectiveAt;
    }

    let tcmbError = "";
    let metalError = "";
    let usd: number | null = null;
    let eur: number | null = null;
    let gbp: number | null = null;
    try {
      const response = await fetch(TCMB_TODAY_XML, {
        headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
        cf: { cacheTtl: 300, cacheEverything: true },
      } as RequestInit & { cf: Record<string, unknown> });
      if (!response.ok) throw new Error(`TCMB kur servisi ${response.status} döndürdü.`);
      const xml = await response.text();
      usd = currencyRate(xml, "USD");
      eur = currencyRate(xml, "EUR");
      gbp = currencyRate(xml, "GBP");
    } catch (error) {
      tcmbError = error instanceof Error ? error.message : "TCMB kur servisine ulaşılamadı.";
    }

    let gold: number | null = null;
    let silver: number | null = null;
    let platinum: number | null = null;
    let palladium: number | null = null;
    try {
      const response = await fetch(TRUNCGIL_TODAY_JSON, {
        headers: { accept: "application/json" },
        cf: { cacheTtl: 300, cacheEverything: true },
      } as RequestInit & { cf: Record<string, unknown> });
      if (!response.ok) throw new Error(`Kıymetli maden servisinden ${response.status} döndü.`);
      const data = await response.json() as Record<string, unknown>;
      gold = providerRate(data, "gram-altin");
      silver = providerRate(data, "gumus");
      platinum = providerRate(data, "gram-platin");
      palladium = providerRate(data, "gram-paladyum");
      if (!gold) throw new Error("Gram altın fiyatı kaynakta bulunamadı.");
    } catch (error) {
      metalError = error instanceof Error ? error.message : "Kıymetli maden servisine ulaşılamadı.";
    }

    const rates: Record<string, number | null> = {
      TRY: 1,
      USD: usd ?? manualRates.USD ?? null,
      EUR: eur ?? manualRates.EUR ?? null,
      GBP: gbp ?? manualRates.GBP ?? null,
      XAU_GRAM: gold ?? manualRates.XAU_GRAM ?? null,
      XAG_GRAM: silver ?? manualRates.XAG_GRAM ?? null,
      XPT_GRAM: platinum ?? manualRates.XPT_GRAM ?? null,
      XPD_GRAM: palladium ?? manualRates.XPD_GRAM ?? null,
      XAU_QUARTER: manualRates.XAU_QUARTER ?? null,
      XAU_HALF: manualRates.XAU_HALF ?? null,
      XAU_FULL: manualRates.XAU_FULL ?? null,
      XAU_REPUBLIC: manualRates.XAU_REPUBLIC ?? null,
    };

    return Response.json({
      ok: true,
      asOf: new Date().toISOString(),
      source: `TCMB döviz + ${metalError ? "Elçi kayıtlı kıymetli maden değerleri" : "Truncgil canlı kıymetli maden verisi"}`,
      sourceUrl: `${TCMB_TODAY_XML} | ${TRUNCGIL_TODAY_JSON}`,
      rates,
      manualAsOf,
      warning: [tcmbError, metalError].filter(Boolean).join(" ") || undefined,
      notes: {
        metals: "Gram altın ve diğer desteklenen metaller canlı kaynaktan alınır; kaynak erişilemezse son kaydedilmiş değer kullanılır.",
      },
    }, { headers: { "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceApiUser(request, true);
    const body = await request.json() as { assetCode?: string; unitPrice?: number; source?: string };
    const assetCode = String(body.assetCode || "").trim().toUpperCase();
    const unitPrice = Number(body.unitPrice);
    if (!assetCode || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      return Response.json({ ok: false, error: "Kıymetli maden / kur değeri geçersiz." }, { status: 400 });
    }
    const db = await getDb();
    const effectiveAt = new Date().toISOString();
    await db.insert(valuationRates).values({
      id: crypto.randomUUID(),
      assetCode,
      unitPriceCents: Math.round(unitPrice * 100),
      source: String(body.source || "manual").trim() || "manual",
      effectiveAt,
      createdBy: user.email,
    });
    return Response.json({ ok: true, assetCode, unitPrice, effectiveAt }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return errorResponse(error);
  }
}
