import { randomUUID } from 'node:crypto';
import { itemRepository } from '../repositories/itemRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { ITEM_STATUS, ORDER_STATUS } from '../domain/orderStatus.js';
import { BusinessError } from '../errors/BusinessError.js';

export async function createOrder({ itemId, buyerId }) {
  if (!itemId || !buyerId) {
    throw new BusinessError(
      '缺少商品或买家信息',
      'INVALID_ORDER_INPUT',
      400
    );
  }

  const item = await itemRepository.findById(itemId);
  if (!item) {
    throw new BusinessError('商品不存在', 'ITEM_NOT_FOUND', 404);
  }

  if (item.sellerId === buyerId) {
    throw new BusinessError('不能购买自己发布的商品', 'SELF_PURCHASE_NOT_ALLOWED', 409);
  }

  if (item.status !== ITEM_STATUS.AVAILABLE) {
    throw new BusinessError('商品已不可购买', 'ITEM_NOT_AVAILABLE', 409, {
      currentStatus: item.status
    });
  }

  const soldItem = await itemRepository.updateIfStatus(
    itemId,
    ITEM_STATUS.AVAILABLE,
    { status: ITEM_STATUS.SOLD }
  );

  if (!soldItem) {
    throw new BusinessError('商品已被其他买家抢先购买', 'ITEM_NOT_AVAILABLE', 409);
  }

  const order = {
    id: randomUUID(),
    itemId,
    buyerId,
    sellerId: item.sellerId,
    itemSnapshot: {
      title: item.title,
      price: item.price
    },
    status: ORDER_STATUS.PENDING_SELLER_CONFIRMATION,
    createdAt: new Date().toISOString()
  };

  try {
    return await orderRepository.create(order);
  } catch (error) {
    await itemRepository.replace(item);
    throw new BusinessError(
      '订单创建失败，请稍后重试',
      'ORDER_CREATE_FAILED',
      500,
      { cause: error.message }
    );
  }
}
