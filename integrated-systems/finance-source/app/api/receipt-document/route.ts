import { FinanceAuthError, requireFinanceApiUser } from "@/lib/finance-auth";
import { extractReceiptCandidates } from "@/lib/receipt-review.mjs";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

type MarkdownResult = { format: "markdown" | "text" | "error"; data?: string; error?: string };
type WorkersAi = {
  toMarkdown(
    file: { name: string; blob: Blob },
    options?: { conversionOptions?: { output?: { format?: "text" | "markdown" }; pdf?: { metadata?: boolean } } },
  ): Promise<MarkdownResult>;
};

async function environment() {
  const worker = await import("cloudflare:workers") as { env?: { AI?: WorkersAi } };
  return worker.env ?? {};
}

function errorResponse(error: unknown) {
  const status = error instanceof FinanceAuthError ? error.status : 400;
  const message = error instanceof Error ? error.message : "Fiş okunamadı.";
  return Response.json({ ok: false, error: message }, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

/**
 * Ephemeral receipt extraction. The binary is sent to Workers AI for this one
 * request and is never written to D1, R2, Git or the application package.
 * The caller receives text to review, then posts only approved structured data.
 */
export async function POST(request: Request) {
  try {
    await requireFinanceApiUser(request, true);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Okunacak fiş görseli veya PDF seçilmedi.");
    if (!ALLOWED_TYPES.has(file.type)) throw new Error("Yalnız JPEG, PNG, WEBP veya PDF fiş okunabilir.");
    if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error("Fiş dosyası 10 MB sınırını aşmamalıdır.");
    const env = await environment();
    if (!env.AI) {
      throw new FinanceAuthError("Fiş okuma servisi henüz etkin değil. Görsel kaydedilmedi.", 503, "RECEIPT_OCR_MISSING");
    }
    const result = await env.AI.toMarkdown(
      { name: file.name.slice(0, 180), blob: file },
      { conversionOptions: { output: { format: "text" }, pdf: { metadata: false } } },
    );
    if (result.format === "error" || !result.data?.trim()) throw new Error(result.error || "Fişten okunabilir metin çıkarılamadı.");
    const extractedText = result.data.slice(0, 40_000);
    return Response.json({
      ok: true,
      storage: "none",
      extractedText,
      candidates: extractReceiptCandidates(extractedText),
      next: "Metni kalem tablosunda kontrol edin. Onaylanan veriler kaydedilir; fotoğraf saklanmaz.",
    }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return errorResponse(error);
  }
}
