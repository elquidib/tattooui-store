-- Keep the public store settings readable, but hide the private admin WhatsApp destination.
REVOKE SELECT ON TABLE public.site_settings FROM anon, authenticated;
GRANT SELECT (
  id, store_name, logo_url, hero_desktop_url, hero_mobile_url,
  hero_title, hero_subtitle, hero_button_text, hero_button_url,
  announcement_text, whatsapp_number, shipping_fee, instagram_url,
  facebook_url, tiktok_url, primary_color, updated_at,
  story_image_url, story_desktop_url, story_mobile_url
) ON TABLE public.site_settings TO anon, authenticated;
GRANT SELECT (admin_whatsapp_number) ON TABLE public.site_settings TO authenticated;

-- Optimize the own-profile policy without changing who can read which row.
ALTER POLICY "users can read own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id);

-- The admin uploader converts images to WebP before storage.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp']::text[]
WHERE id = 'product-images';
