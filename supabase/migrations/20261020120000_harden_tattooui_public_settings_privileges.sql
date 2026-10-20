-- Restrict anonymous access to public storefront settings only.
-- Prevent anon from having unnecessary write/DDL-related privileges on this table.
REVOKE ALL PRIVILEGES ON TABLE public.site_settings FROM anon;
GRANT SELECT (
  id, store_name, announcement_text, shipping_fee, facebook_url,
  hero_button_text, hero_button_url, hero_desktop_url, hero_mobile_url,
  hero_subtitle, hero_title, instagram_url, logo_url, primary_color,
  story_desktop_url, story_image_url, story_mobile_url, tiktok_url,
  updated_at, whatsapp_number
) ON TABLE public.site_settings TO anon;
