DROP POLICY IF EXISTS "admin orders" ON public.orders;
DROP POLICY IF EXISTS "order confirmer read pending and confirmed orders" ON public.orders;

CREATE POLICY "orders read admin or order confirmer"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
  OR (
    status IN ('new', 'confirmed')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'order_confirmer'
    )
  )
);

CREATE POLICY "admin insert orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "admin update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "admin delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "admin order items" ON public.order_items;
DROP POLICY IF EXISTS "order confirmer read new order items" ON public.order_items;

CREATE POLICY "order items read admin or confirmer"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.profiles p ON p.id = (SELECT auth.uid())
    WHERE o.id = order_items.order_id
      AND o.status = 'new'
      AND p.role = 'order_confirmer'
  )
);

CREATE POLICY "admin insert order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "admin update order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "admin delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);
