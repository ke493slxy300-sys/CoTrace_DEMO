import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder } from '../src/services/orderService.js';
import { itemRepository } from '../src/repositories/itemRepository.js';
import { orderRepository } from '../src/repositories/orderRepository.js';

function reset() {
  itemRepository.reset([{
    id: 'item-1001',
    sellerId: 'user-alex',
    title: '二手机械键盘',
    price: 168,
    status: 'available'
  }]);
  orderRepository.reset();
}

test('creates an order for an existing item', async () => {
  reset();
  const order = await createOrder({ itemId: 'item-1001', buyerId: 'user-maya' });
  assert.equal(order.itemId, 'item-1001');
  assert.equal(order.buyerId, 'user-maya');
});

test('rejects a missing item', async () => {
  reset();
  await assert.rejects(
    () => createOrder({ itemId: 'missing', buyerId: 'user-maya' }),
    { code: 'ITEM_NOT_FOUND' }
  );
});
