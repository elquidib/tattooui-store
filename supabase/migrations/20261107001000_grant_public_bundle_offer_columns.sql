DROP VIEW IF EXISTS public.storefront_bundle_offer;
GRANT SELECT (bundle_offer_enabled, bundle_offer_price, bundle_offer_product_ids)
ON public.site_settings TO anon;