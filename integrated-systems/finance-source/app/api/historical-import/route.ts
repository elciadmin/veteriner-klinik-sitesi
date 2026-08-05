import { FinanceAuthError, requireFinanceApiUser } from "@/lib/finance-auth";

function status(error: unknown) {
  return error instanceof FinanceAuthError ? error.status : 500;
}

export async function GET(request: Request) {
  try {
    const user = await requireFinanceApiUser(request, false);
    return Response.json(
      {
        ready: true,
        uploadMode: "local-private-json",
        access: { role: user.role },
        message:
          "Geçmiş veri paketi güvenlik nedeniyle GitHub veya uygulama paketine eklenmez. Yetkili kullanıcı dosyayı kendi bilgisayarından seçer.",
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
            : "Geçmiş veri aktarım hizmeti açılamadı.",
      },
      {
        status: status(error),
        headers: { "cache-control": "no-store, private" },
      },
    );
  }
}
