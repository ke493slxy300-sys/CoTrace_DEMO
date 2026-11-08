export function createOrder(item) {
  if (!item) return { status: 404, code: 'ITEM_NOT_FOUND' };
  if (item.status !== 'available') return { status: 409, code: 'ITEM_NOT_AVAILABLE' };
  return { status: 201, orderStatus: 'pending_seller_confirmation' };
}
