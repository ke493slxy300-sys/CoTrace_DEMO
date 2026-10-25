BEGIN;

INSERT INTO users (id, display_name) VALUES
  ('11111111-1111-4111-8111-111111111111', '演示卖家'),
  ('22222222-2222-4222-8222-222222222222', '演示买家')
ON CONFLICT (id) DO NOTHING;

INSERT INTO items (
  id,
  seller_id,
  title,
  description,
  price_cents,
  currency,
  status
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '九成新机械键盘',
  '演示商品：仅用于节点详情和接口联调。',
  32900,
  'CNY',
  'available'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
