# Product variations implementation

Feature branch for optional product design/color variations, per-option images, price/stock overrides, cart and COD order persistence, and order-label display. Existing products and orders must be preserved.

Important: the database already has `products.variants` JSONB and `order_items.variant_id`, `variant_name`, and `variant_image_url`. The live `place_cod_order` RPC still needs a compatible migration before the storefront can be deployed safely.
