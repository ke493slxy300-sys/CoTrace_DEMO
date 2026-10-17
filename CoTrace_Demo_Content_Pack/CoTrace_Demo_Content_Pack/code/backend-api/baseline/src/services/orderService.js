import { randomUUID } from 'node:crypto';
import { itemRepository } from '../repositories/itemRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { ORDER_STATUS } from '../domain/orderStatus.js';
import { BusinessError } from '../errors/BusinessError.js';

export async function createOrder({ itemId, buyerId }) {
  if (!itemId || !buyerId) {
    throw new BusinessError('缺少商品或买家信息');
  }

  const item = await itemRepository.findById(itemId);
  if (!item) {
    throw new BusinessError('商品不存在', 'ITEM_NOT_FOUND', 404);
  }

  const order = {
    id: randomUUID(),
    itemId,
    buyerId,
    sellerId: item.sellerId,
    status: ORDER_STATUS.PENDING_SELLER_CONFIRMATION,
    createdAt: new Date().toISOString()
  };

  await orderRepository.create(order);
  await itemRepository.update(itemId, { status: 'sold' });
  return order;
}
