import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder } from '../src/services/orderService.js';
import { itemRepository } from '../src/repositories/itemRepository.js';
import { orderRepository } from '../src/repositories/orderRepository.js';

function reset(overrides = {}) {
  itemRepository.reset([{
    id: 'item-1001',
    sellerId: 'user-alex',
    title: '二手机械键盘',
    price: 168,
    status: 'available',
    ...overrides
  }]);
  orderRepository.reset();
}

test('creates an order with an immutable item snapshot', async () => {
  reset();
  const order = await createOrder({ itemId: 'item-1001', buyerId: 'user-maya' });
  assert.deepEqual(order.itemSnapshot, { title: '二手机械键盘', price: 168 });
  assert.equal(order.status, 'pending_seller_confirmation');
  assert.equal((await itemRepository.findById('item-1001')).status, 'sold');
});

test('rejects a missing item', async () => {
  reset();
  await assert.rejects(
    () => createOrder({ itemId: 'missing', buyerId: 'user-maya' }),
    { code: 'ITEM_NOT_FOUND', status: 404 }
  );
});

test('rejects a self purchase', async () => {
  reset();
  await assert.rejects(
    () => createOrder({ itemId: 'item-1001', buyerId: 'user-alex' }),
    { code: 'SELF_PURCHASE_NOT_ALLOWED', status: 409 }
  );
});

test('rejects an item that is already sold', async () => {
  reset({ status: 'sold' });
  await assert.rejects(
    () => createOrder({ itemId: 'item-1001', buyerId: 'user-maya' }),
    { code: 'ITEM_NOT_AVAILABLE', status: 409 }
  );
});

test('only one of two competing buyers can claim the item', async () => {
  reset();
  const results = await Promise.allSettled([
    createOrder({ itemId: 'item-1001', buyerId: 'user-maya' }),
    createOrder({ itemId: 'item-1001', buyerId: 'user-priya' })
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
});
