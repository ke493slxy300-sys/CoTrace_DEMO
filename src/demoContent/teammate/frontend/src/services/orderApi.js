export class OrderApiError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'OrderApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function createOrder(itemId, { signal } = {}) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ itemId }),
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error ?? {};
    throw new OrderApiError(
      error.code ?? 'INTERNAL_ERROR',
      error.message ?? '创建订单失败',
      response.status,
      error.details
    );
  }

  return payload.data;
}
