import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder } from './orderService-v0.4.mjs';

test('sold item returns 409 ITEM_NOT_AVAILABLE', () => {
  assert.deepEqual(createOrder({ status: 'sold' }), { status: 409, code: 'ITEM_NOT_AVAILABLE' });
});
test('available item creates pending order', () => {
  assert.deepEqual(createOrder({ status: 'available' }), { status: 201, orderStatus: 'pending_seller_confirmation' });
});
test('missing item returns 404 ITEM_NOT_FOUND', () => {
  assert.deepEqual(createOrder(null), { status: 404, code: 'ITEM_NOT_FOUND' });
});
