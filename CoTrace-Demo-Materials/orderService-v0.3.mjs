export function createOrder(item) {
  if (!item) return { status: 404, code: 'ITEM_NOT_FOUND' };
  return { status: 201, orderStatus: 'pending_seller_confirmation' };
}
