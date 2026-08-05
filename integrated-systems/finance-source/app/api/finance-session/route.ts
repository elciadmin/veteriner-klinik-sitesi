import {
  createSessionToken,
  FinanceAuthError,
  financeSessionCookie,
  financeSessionDurationSeconds,
  safeReturnPath,
  verifyLaunchToken,
} from "@/lib/finance-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const launch = await verifyLaunchToken(url.searchParams.get("token") ?? "");
    const durationSeconds = await financeSessionDurationSeconds();
    const session = await createSessionToken(
      { email: launch.email, role: launch.role },
      durationSeconds,
    );
    return new Response(null, {
      status: 302,
      headers: {
        location: safeReturnPath(url.searchParams.get("return_to")),
        "set-cookie": financeSessionCookie(session, durationSeconds),
        "cache-control": "no-store, private",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    const status = error instanceof FinanceAuthError ? error.status : 401;
    const message = error instanceof Error ? error.message : "Finans bağlantısı doğrulanamadı.";
    return Response.json(
      { ok: false, error: message },
      { status, headers: { "cache-control": "no-store, private" } },
    );
  }
}
