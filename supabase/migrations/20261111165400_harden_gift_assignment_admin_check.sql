-- Keep gift assignment SECURITY INVOKER and authorize using the caller's own RLS-protected profile row.
-- This avoids exposing the SECURITY DEFINER is_admin() helper to authenticated API callers.
CREATE OR REPLACE FUNCTION public.assign_order_gift(
  p_order_item_id uuid,
  p_gift_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
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

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
