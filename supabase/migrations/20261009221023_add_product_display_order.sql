ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id ASC)::integer AS position
  FROM public.products
)
UPDATE public.products AS p
SET sort_order = ranked.position
FROM ranked
WHERE p.id = ranked.id AND p.sort_order IS NULL;
ALTER TABLE public.products ALTER COLUMN sort_order SET DEFAULT 2147483647;
UPDATE public.products SET sort_order = 2147483647 WHERE sort_order IS NULL;
ALTER TABLE public.products ALTER COLUMN sort_order SET NOT NULL;
CREATE INDEX IF NOT EXISTS products_status_sort_order_idx
ON public.products (status, sort_order, created_at DESC);
