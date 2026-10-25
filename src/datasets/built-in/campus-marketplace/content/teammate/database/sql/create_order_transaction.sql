CREATE OR REPLACE FUNCTION create_order_transaction(
  p_order_id UUID,
  p_item_id UUID,
  p_buyer_id UUID
)
RETURNS TABLE (
  order_id UUID,
  order_status VARCHAR,
  item_title_snapshot VARCHAR,
  item_price_cents_snapshot INTEGER,
  currency_snapshot CHAR(3),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item items%ROWTYPE;
  v_order orders%ROWTYPE;
BEGIN
  -- 条件更新是并发控制点：只有一个请求能把 available 改为 sold。
  UPDATE items
  SET status = 'sold', updated_at = NOW()
  WHERE id = p_item_id
    AND status = 'available'
    AND seller_id <> p_buyer_id
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO orders (
    id,
    item_id,
    buyer_id,
    seller_id,
    item_title_snapshot,
    item_price_cents_snapshot,
    currency_snapshot,
    status
  ) VALUES (
    p_order_id,
    v_item.id,
    p_buyer_id,
    v_item.seller_id,
    v_item.title,
    v_item.price_cents,
    v_item.currency,
    'pending_seller_confirmation'
  )
  RETURNING * INTO v_order;

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.status,
    v_order.item_title_snapshot,
    v_order.item_price_cents_snapshot,
    v_order.currency_snapshot,
    v_order.created_at;

  -- INSERT 或约束失败会让整个函数所在事务失败，前面的商品更新随之回滚。
END;
$$;
