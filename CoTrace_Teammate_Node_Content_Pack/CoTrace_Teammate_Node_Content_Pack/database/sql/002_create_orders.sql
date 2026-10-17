BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  item_title_snapshot VARCHAR(160) NOT NULL,
  item_price_cents_snapshot INTEGER NOT NULL,
  currency_snapshot CHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_seller_confirmation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_price_snapshot_check CHECK (item_price_cents_snapshot > 0),
  CONSTRAINT orders_buyer_seller_check CHECK (buyer_id <> seller_id),
  CONSTRAINT orders_status_check CHECK (
    status IN ('pending_seller_confirmation', 'confirmed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_created_at
  ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_created_at
  ON orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_item_id ON orders(item_id);

COMMIT;
