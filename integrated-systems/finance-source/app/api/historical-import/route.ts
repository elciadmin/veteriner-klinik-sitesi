import historicalPackage from "@/data/imports/elci-20260805.json";
import { requireFinanceApiUser, FinanceAuthError } from "@/lib/finance-auth";
import { validateHistoricalImportPackage } from "@/lib/historical-import.mjs";

function status(error: unknown) {
  return error instanceof FinanceAuthError ? error.status : 500;
}

export async function GET(request: Request) {
  try {
    const user = await requireFinanceApiUser(request, false);
    validateHistoricalImportPackage(historicalPackage);
    return Response.json(
      {
        ...historicalPackage,
        access: { role: user.role },
      },
      {
        headers: {
          "cache-control": "no-store, private",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Geçmiş veri paketi açılamadı.",
      },
      {
        status: status(error),
        headers: { "cache-control": "no-store, private" },
      },
    );
  }
}
