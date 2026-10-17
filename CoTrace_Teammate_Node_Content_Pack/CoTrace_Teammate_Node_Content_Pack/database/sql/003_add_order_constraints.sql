BEGIN;

-- MVP 中一个商品只允许形成一个有效订单记录。
-- 若未来支持取消后重新下单，应改为针对有效状态的部分唯一索引。
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_item_once ON orders(item_id);

-- 让状态筛选和成员订单列表保持可预测性能。
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at
  ON orders(status, updated_at DESC);

COMMENT ON COLUMN orders.item_title_snapshot IS
  '下单时商品标题快照；历史订单展示不得回查当前商品标题覆盖它。';
COMMENT ON COLUMN orders.item_price_cents_snapshot IS
  '下单时商品价格快照，单位为分。';
COMMENT ON COLUMN items.status IS
  'MVP 仅 available/sold。sold 暂时承担锁定语义，未来应显式增加 reserved。';

COMMIT;
