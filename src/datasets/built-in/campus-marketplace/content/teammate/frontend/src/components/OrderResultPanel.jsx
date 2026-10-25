export function OrderResultPanel({ order, onBack }) {
  const snapshot = order.itemSnapshot;

  return (
    <section aria-labelledby="order-result-title" className="order-result-panel">
      <p className="eyebrow">购买申请已提交</p>
      <h2 id="order-result-title">等待卖家确认</h2>
      <dl>
        <div>
          <dt>商品</dt>
          <dd>{snapshot.title}</dd>
        </div>
        <div>
          <dt>申请价格</dt>
          <dd>¥{snapshot.price}</dd>
        </div>
        <div>
          <dt>订单编号</dt>
          <dd>{order.id}</dd>
        </div>
      </dl>
      <p className="hint">卖家确认前，请留意订单状态变化。</p>
      <button type="button" onClick={onBack}>返回商品列表</button>
    </section>
  );
}
