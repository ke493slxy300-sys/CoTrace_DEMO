import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PurchasePanel } from '../src/components/PurchasePanel.jsx';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const item = { id: 'item-1001', price: 168, status: 'available' };

test('disables purchase while the request is pending', async () => {
  let resolveRequest;
  const onOrderCreated = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveRequest = resolve; })));

  render(<PurchasePanel item={item} onOrderCreated={onOrderCreated} />);
  fireEvent.click(screen.getByRole('button', { name: '申请购买' }));
  expect(screen.getByRole('button', { name: '正在提交…' })).toBeDisabled();

  resolveRequest({ ok: true, json: async () => ({ data: { id: 'order-1' } }) });
  await waitFor(() => expect(onOrderCreated).toHaveBeenCalledWith({ id: 'order-1' }));
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('maps an API error code to a user-facing message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: { code: 'ITEM_NOT_AVAILABLE' } })
  })));

  render(<PurchasePanel item={item} onOrderCreated={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '申请购买' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('商品已被其他买家购买');
});
