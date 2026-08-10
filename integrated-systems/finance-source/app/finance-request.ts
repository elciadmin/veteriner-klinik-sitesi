/**
 * One command identity per user intent.  The key is deliberately generated
 * before the request is sent so a network retry can use the same value.
 */
export function createFinanceCommandKey(scope = "write") {
  return `cmd-${scope}-${crypto.randomUUID()}-${Date.now()}`;
}

export async function postFinanceJson<T extends object>(
  path: string,
  payload: T,
  commandKey = createFinanceCommandKey(),
) {
  return fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": commandKey,
      "x-request-id": commandKey,
    },
    body: JSON.stringify(payload),
  });
}
