import { useEffect, useRef, useState } from 'react';
import { createOrder } from '../services/orderApi.js';
import { getOrderErrorMessage } from '../utils/orderErrorMessages.js';

export function PurchasePanel({ item, onOrderCreated }) {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const activeRequest = useRef(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function handlePurchase() {
    if (status === 'submitting') return;

    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus('submitting');
    setErrorMessage('');

    try {
      const order = await createOrder(item.id, { signal: controller.signal });
      setStatus('success');
      onOrderCreated(order);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus('error');
      setErrorMessage(getOrderErrorMessage(error));
    } finally {
      activeRequest.current = null;
    }
  }

  const unavailable = item.status !== 'available';
  const disabled = unavailable || status === 'submitting' || status === 'success';

  return (
    <section className="purchase-panel" aria-label="购买操作">
      <div className="price">¥{item.price}</div>
      {unavailable && <p role="status">该商品当前不可购买。</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <button type="button" disabled={disabled} onClick={handlePurchase}>
        {status === 'submitting' ? '正在提交…' : '申请购买'}
      </button>
      {status === 'error' && (
        <button type="button" className="secondary" onClick={handlePurchase}>
          重新尝试
        </button>
      )}
    </section>
  );
}
