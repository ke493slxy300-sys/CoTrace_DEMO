import { useState } from 'react';
import { OrderResultPanel } from '../components/OrderResultPanel.jsx';
import { PurchasePanel } from '../components/PurchasePanel.jsx';

export function ItemDetailPage({ item, navigateToList }) {
  const [createdOrder, setCreatedOrder] = useState(null);

  if (createdOrder) {
    return <OrderResultPanel order={createdOrder} onBack={navigateToList} />;
  }

  return (
    <main className="item-detail-page">
      <button type="button" className="text-button" onClick={navigateToList}>
        返回列表
      </button>
      <article>
        <p className="eyebrow">校园二手</p>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
        <p className="seller">发布者：{item.sellerName}</p>
      </article>
      <PurchasePanel item={item} onOrderCreated={setCreatedOrder} />
    </main>
  );
}
