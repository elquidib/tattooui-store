# Product variations implementation

This draft branch adds:
- Admin variation editor for design/colour names, per-variation image upload or URL, optional price/stock overrides, optional SKU, and a default choice.
- Storefront variation selection with a selected-option image preview and variant-aware price/availability.
- Variant-aware cart identity, quantity controls, checkout summary, COD request payload, confirmation summary, and admin order/shipping-label display.
- No existing products or orders are deleted or rewritten by this branch.

## Required before merge/deploy
The production database already has `products.variants` JSONB and `order_items.variant_id`, `variant_name`, and `variant_image_url`. However, the live `public.place_cod_order` RPC still validates stock/prices only at product level, deduplicates by product ID, and does not save the variant snapshot. A coordinated SQL migration must update that RPC to:
1. Validate selected variant IDs and optional price/stock overrides.
2. Allow multiple distinct variants of one product in the same cart.
3. Decrement variant-specific stock or shared product stock safely.
4. Save variant ID/name/image and variant price in `order_items`.

Do not merge or deploy the storefront changes until that RPC migration is reviewed, applied, and the end-to-end COD checkout is tested. Legacy products with an empty variants array must continue to use their current product price/stock behavior.
