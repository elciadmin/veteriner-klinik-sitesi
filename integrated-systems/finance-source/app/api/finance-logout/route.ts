import { clearFinanceSessionCookie, safeReturnPath } from "@/lib/finance-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get("return_to"));
  return new Response(null, {
    status: 302,
    headers: {
      location: returnTo,
      "set-cookie": clearFinanceSessionCookie(),
      "cache-control": "no-store, private",
    },
  });
}
