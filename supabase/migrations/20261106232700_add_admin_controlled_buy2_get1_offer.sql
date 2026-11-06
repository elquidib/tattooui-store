-- Admin-controlled Buy 2 Get 1 Free promotion for TATTO✦OUI.
-- The gift design is intentionally not selected at checkout; staff choose it while packing.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS bundle_offer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_offer_price numeric NOT NULL DEFAULT 99
    CHECK (bundle_offer_price >= 0),
  ADD COLUMN IF NOT EXISTS bundle_offer_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_gift boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_code text,
  ADD COLUMN IF NOT EXISTS gift_selected_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS order_items_one_gift_per_order_uidx
  ON public.order_items(order_id)
  WHERE is_gift = true;

CREATE OR REPLACE FUNCTION public.place_cod_order_with_bundle(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_address text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text,
  p_discount_code text
)
RETURNS TABLE(
  order_id uuid,
  order_number bigint,
  subtotal numeric,
  discount_amount numeric,
  shipping numeric,
  total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET statement_timeout TO '6s'
AS $function$
DECLARE
  v_existing record;
  v_result record;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_product_name text;
  v_product_price numeric;
  v_product_stock integer;
  v_product_status text;
  v_offer_enabled boolean;
  v_offer_price numeric;
  v_eligible_ids uuid[];
  v_regular_subtotal numeric;
  v_discount numeric;
  v_temp_code text;
BEGIN
  SELECT o.id, o.order_number, o.subtotal, o.discount_amount, o.shipping, o.total
  INTO v_existing
  FROM public.orders o
  WHERE o.idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing.id, v_existing.order_number,
                         v_existing.subtotal, v_existing.discount_amount,
                         v_existing.shipping, v_existing.total;
    RETURN;
  END IF;

  IF jsonb_typeof(p_items) = 'array'
     AND jsonb_array_length(p_items) = 1
     AND coalesce((p_items->0->>'bundle_offer')::boolean, false) THEN

    v_item := p_items->0;
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'العرض غير صالح. يرجى تحديث الصفحة والمحاولة من جديد.';
    END;

    IF v_qty <> 2 THEN
      RAISE EXCEPTION 'عرض اشترِ 2 واحصل على 1 مجاناً يتطلب قطعتين من نفس التصميم.';
    END IF;

    SELECT s.bundle_offer_enabled, s.bundle_offer_price, s.bundle_offer_product_ids
    INTO v_offer_enabled, v_offer_price, v_eligible_ids
    FROM public.site_settings s
    WHERE s.id = true
    FOR SHARE;

    IF NOT coalesce(v_offer_enabled, false)
       OR NOT (v_product_id = ANY(coalesce(v_eligible_ids, '{}'::uuid[]))) THEN
      RAISE EXCEPTION 'هذا التصميم غير مشمول بالعرض حالياً.';
    END IF;

    SELECT p.name, p.price, p.stock, p.status
    INTO v_product_name, v_product_price, v_product_stock, v_product_status
    FROM public.products p
    WHERE p.id = v_product_id;

    IF NOT FOUND OR v_product_status <> 'active' THEN
      RAISE EXCEPTION 'هذا التصميم غير متوفر حالياً.';
    END IF;

    IF v_product_stock < 2 THEN
      RAISE EXCEPTION 'الكمية المتوفرة من هذا التصميم غير كافية للعرض.';
    END IF;

    v_regular_subtotal := v_product_price * 2;
    IF v_offer_price <= 0 OR v_offer_price >= v_regular_subtotal THEN
      RAISE EXCEPTION 'سعر العرض غير صالح لهذا التصميم حالياً.';
    END IF;

    v_discount := v_regular_subtotal - v_offer_price;
    v_temp_code := 'BNDL' || upper(replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.discounts(
      code, type, value, min_order_value, max_uses, used_count,
      starts_at, ends_at, active
    )
    VALUES(
      v_temp_code, 'fixed', v_discount, 0, 1, 0,
      now() - interval '1 minute', now() + interval '5 minutes', true
    );

    SELECT *
    INTO v_result
    FROM public.place_cod_order(
      p_customer_name, p_phone, p_city, p_address, p_notes,
      p_items, p_idempotency_key, v_temp_code
    );

    UPDATE public.orders
    SET discount_code = 'BUY2GET1',
        updated_at = now()
    WHERE id = v_result.order_id;

    UPDATE public.order_items
    SET unit_price = round(v_offer_price / 2, 2),
        line_total = v_offer_price,
        promotion_code = 'BUY2GET1'
    WHERE order_id = v_result.order_id
      AND product_id = v_product_id
      AND coalesce(is_gift, false) = false;

    INSERT INTO public.order_items(
      order_id, product_id, product_name, unit_price, quantity,
      line_total, is_gift, promotion_code
    )
    VALUES(
      v_result.order_id, NULL,
      'هدية مجانية (تُحدد عند تجهيز الطلب)',
      0, 1, 0, true, 'BUY2GET1'
    )
    ON CONFLICT (order_id) WHERE is_gift = true DO NOTHING;

    DELETE FROM public.discounts WHERE code = v_temp_code;

    RETURN QUERY SELECT v_result.order_id, v_result.order_number,
                         v_result.subtotal, v_result.discount_amount,
                         v_result.shipping, v_result.total;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.place_cod_order(
    p_customer_name, p_phone, p_city, p_address, p_notes,
    p_items, p_idempotency_key, p_discount_code
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.place_cod_order_with_bundle(text,text,text,text,text,jsonb,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_cod_order_with_bundle(text,text,text,text,text,jsonb,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.assign_order_gift(
  p_order_item_id uuid,
  p_gift_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET statement_timeout TO '4s'
AS $function$
DECLARE
  v_order_id uuid;
  v_current_product_id uuid;
  v_is_gift boolean;
  v_order_status text;
  v_product_name text;
  v_product_stock integer;
  v_product_status text;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'غير مسموح لك بتنفيذ هذا الإجراء.';
  END IF;

  SELECT oi.order_id, oi.product_id, oi.is_gift
  INTO v_order_id, v_current_product_id, v_is_gift
  FROM public.order_items oi
  WHERE oi.id = p_order_item_id
  FOR UPDATE;

  IF NOT FOUND OR NOT coalesce(v_is_gift, false) THEN
    RAISE EXCEPTION 'عنصر الهدية غير موجود.';
  END IF;

  IF v_current_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'تم اختيار هدية لهذا الطلب بالفعل.';
  END IF;

  SELECT o.status INTO v_order_status
  FROM public.orders o
  WHERE o.id = v_order_id
  FOR UPDATE;

  IF v_order_status IN ('cancelled', 'returned') THEN
    RAISE EXCEPTION 'لا يمكن اختيار هدية لطلب ملغى أو مرتجع.';
  END IF;

  SELECT p.name, p.stock, p.status
  INTO v_product_name, v_product_stock, v_product_status
  FROM public.products p
  WHERE p.id = p_gift_product_id
  FOR UPDATE;

  IF NOT FOUND OR v_product_status <> 'active' THEN
    RAISE EXCEPTION 'تصميم الهدية غير متوفر.';
  END IF;

  IF v_product_stock < 1 THEN
    RAISE EXCEPTION 'مخزون هذا التصميم غير كافٍ.';
  END IF;

  UPDATE public.products
  SET stock = stock - 1, updated_at = now()
  WHERE id = p_gift_product_id;

  UPDATE public.order_items
  SET product_id = p_gift_product_id,
      product_name = v_product_name || ' — هدية مجانية',
      unit_price = 0,
      quantity = 1,
      line_total = 0,
      gift_selected_at = now()
  WHERE id = p_order_item_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_order_gift(uuid,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_order_gift(uuid,uuid)
  TO authenticated;
