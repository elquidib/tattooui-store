CREATE OR REPLACE VIEW public.storefront_bundle_offer
WITH (security_barrier = true)
AS
SELECT
  bundle_offer_enabled,
  bundle_offer_price,
  bundle_offer_product_ids
FROM public.site_settings
WHERE id = true;

REVOKE ALL ON public.storefront_bundle_offer FROM PUBLIC;
GRANT SELECT ON public.storefront_bundle_offer TO anon, authenticated;

COMMENT ON VIEW public.storefront_bundle_offer IS
  'Publicly exposes only the active bundle offer configuration; admin-only site settings remain private.';