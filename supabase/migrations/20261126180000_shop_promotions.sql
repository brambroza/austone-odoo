-- Odoo automatic promotions (loyalty.program type promotion / buy_x_get_y) picked by the dealer in the cart.
-- ShopCart."promotionRewardId": NULL = not picked (best one applies), 0 = no promotion, otherwise the Odoo loyalty.reward id.
-- ShopOrder."promotion": the reward the order got (applied on the SO through Odoo's reward wizard); "promotionDiscount" its baht off the bill.
ALTER TABLE "ShopCart" ADD COLUMN IF NOT EXISTS "promotionRewardId" INTEGER;
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "promotion" JSONB;
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "promotionDiscount" NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Places an order atomically: locks the cart, refuses an empty one (so a double submit cannot create two orders),
-- numbers the order, inserts it and empties the cart in one transaction. Returns the new row.
CREATE OR REPLACE FUNCTION place_shop_order(p_order JSONB) RETURNS "ShopOrder"
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_scope TEXT := p_order->>'scope';
  v_cart "ShopCart";
  v_seq BIGINT;
  v_now TIMESTAMP(3) := (now() AT TIME ZONE 'utc');
  v_row "ShopOrder";
BEGIN
  SELECT * INTO v_cart FROM "ShopCart" WHERE "scope" = v_scope FOR UPDATE;
  IF NOT FOUND OR jsonb_array_length(v_cart."items") = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;
  v_seq := nextval('"ShopOrder_seq"');
  INSERT INTO "ShopOrder" ("id", "ref", "scope", "dealerName", "status", "paymentMethod", "subtotal", "cashDiscount", "couponDiscount", "promotionDiscount", "total",
                           "lines", "coupon", "promotion", "odooPricelistId", "address", "carrier", "carrierId", "note", "poRef", "events", "createdAt", "updatedAt")
  VALUES (
    p_order->>'id',
    'WEB-' || to_char(v_now, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 3, '0'),
    v_scope,
    p_order->>'dealerName',
    'PENDING',
    p_order->>'paymentMethod',
    (p_order->>'subtotal')::NUMERIC,
    COALESCE((p_order->>'cashDiscount')::NUMERIC, 0),
    COALESCE((p_order->>'couponDiscount')::NUMERIC, 0),
    COALESCE((p_order->>'promotionDiscount')::NUMERIC, 0),
    (p_order->>'total')::NUMERIC,
    p_order->'lines',
    NULLIF(p_order->'coupon', 'null'::jsonb),
    NULLIF(p_order->'promotion', 'null'::jsonb),
    (p_order->>'odooPricelistId')::INTEGER,
    p_order->>'address',
    p_order->>'carrier',
    (p_order->>'carrierId')::INTEGER,
    COALESCE(p_order->>'note', ''),
    NULLIF(p_order->>'poRef', ''),
    jsonb_build_array(jsonb_build_object('status', 'PENDING', 'at', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    v_now,
    v_now
  ) RETURNING * INTO v_row;
  UPDATE "ShopCart" SET "items" = '[]'::jsonb, "couponCode" = NULL, "promotionRewardId" = NULL, "updatedAt" = v_now WHERE "scope" = v_scope;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION place_shop_order(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION place_shop_order(JSONB) TO service_role;
