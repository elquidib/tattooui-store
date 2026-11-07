-- Public storefront can read only storefront-safe settings; internal WhatsApp destination stays private.
REVOKE SELECT ON TABLE public.site_settings FROM anon;
GRANT SELECT (
  id, store_name, logo_url, hero_desktop_url, hero_mobile_url,
  hero_title, hero_subtitle, hero_button_text, hero_button_url,
  announcement_text, shipping_fee, instagram_url, facebook_url, tiktok_url,
  primary_color, updated_at, story_image_url, story_desktop_url,
  story_mobile_url, bundle_offer_enabled, bundle_offer_price,
  bundle_offer_product_ids
) ON TABLE public.site_settings TO anon;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_original text;

CREATE OR REPLACE FUNCTION private.normalize_moroccan_city(p_city text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE lower(btrim(coalesce(p_city,'')))
    WHEN 'casa' THEN 'Casablanca'
    WHEN 'casa blanca' THEN 'Casablanca'
    WHEN 'casabalanca' THEN 'Casablanca'
    WHEN 'caza blanca' THEN 'Casablanca'
    WHEN 'caza blaneca' THEN 'Casablanca'
    WHEN 'cassablanca' THEN 'Casablanca'
    WHEN 'cassa' THEN 'Casablanca'
    WHEN 'caza' THEN 'Casablanca'
    WHEN 'kaza' THEN 'Casablanca'
    WHEN 'kaaza' THEN 'Casablanca'
    WHEN 'كازا' THEN 'Casablanca'
    WHEN 'كزا' THEN 'Casablanca'
    WHEN 'كزاه' THEN 'Casablanca'
    WHEN 'الدار البيضاء' THEN 'Casablanca'
    WHEN 'الدارالبيضاء' THEN 'Casablanca'
    WHEN 'دار البيضاء' THEN 'Casablanca'
    WHEN 'دار بيضاء' THEN 'Casablanca'
    WHEN 'البيضاء حي مولاي رشيد حدا فيلات الرحمة' THEN 'Casablanca'
    WHEN 'marrakech' THEN 'Marrakech'
    WHEN 'marakech' THEN 'Marrakech'
    WHEN 'marakeche' THEN 'Marrakech'
    WHEN 'marrakesh' THEN 'Marrakech'
    WHEN 'marrkech' THEN 'Marrakech'
    WHEN 'mrakch' THEN 'Marrakech'
    WHEN 'mrkich' THEN 'Marrakech'
    WHEN 'مراكش' THEN 'Marrakech'
    WHEN 'tanger' THEN 'Tangier'
    WHEN 'tanja' THEN 'Tangier'
    WHEN 'طنجة' THEN 'Tangier'
    WHEN 'agadiir' THEN 'Agadir'
    WHEN 'agdire' THEN 'Agadir'
    WHEN 'agader' THEN 'Agadir'
    WHEN 'aga' THEN 'Agadir'
    WHEN 'اكادير' THEN 'Agadir'
    WHEN 'أكادير' THEN 'Agadir'
    WHEN 'sale' THEN 'Salé'
    WHEN 'sala' THEN 'Salé'
    WHEN 'sela' THEN 'Salé'
    WHEN 'sla' THEN 'Salé'
    WHEN 'سلا' THEN 'Salé'
    WHEN 'kenitra' THEN 'Kenitra'
    WHEN 'kénitra' THEN 'Kenitra'
    WHEN 'knetra' THEN 'Kenitra'
    WHEN 'kenira birami' THEN 'Kenitra'
    WHEN 'قنيطرة' THEN 'Kenitra'
    WHEN 'fes' THEN 'Fes'
    WHEN 'meknes' THEN 'Meknes'
    WHEN 'meknès' THEN 'Meknes'
    WHEN 'meknas' THEN 'Meknes'
    WHEN 'mknas' THEN 'Meknes'
    WHEN 'مكناس' THEN 'Meknes'
    WHEN 'tetouan' THEN 'Tetouan'
    WHEN 'tétouan' THEN 'Tetouan'
    WHEN 'تطوان' THEN 'Tetouan'
    WHEN 'ouarzazat' THEN 'Ouarzazate'
    WHEN 'ورزازت' THEN 'Ouarzazate'
    WHEN 'dakhla' THEN 'Dakhla'
    WHEN 'دخلا' THEN 'Dakhla'
    WHEN 'الداخلة' THEN 'Dakhla'
    WHEN 'rabat' THEN 'Rabat'
    WHEN 'رباط' THEN 'Rabat'
    WHEN 'bni malal' THEN 'Beni Mellal'
    WHEN 'bni mlal' THEN 'Beni Mellal'
    WHEN 'béni mellal' THEN 'Beni Mellal'
    WHEN 'بني ملال' THEN 'Beni Mellal'
    WHEN 'asfi' THEN 'Safi'
    WHEN 'اسفي' THEN 'Safi'
    WHEN 'سفي' THEN 'Safi'
    WHEN 'essawira' THEN 'Essaouira'
    WHEN 'tan tan' THEN 'Tan-Tan'
    WHEN 'طانطان' THEN 'Tan-Tan'
    ELSE btrim(p_city)
  END
$$;

CREATE OR REPLACE FUNCTION private.normalize_order_city_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE v_source_city text; v_normalized text;
BEGIN
  v_source_city := NEW.city;
  IF NEW.city_original IS NULL THEN NEW.city_original := NEW.city; END IF;
  v_normalized := private.normalize_moroccan_city(v_source_city);
  NEW.city := v_normalized;
  IF NEW.city_original = NEW.city THEN NEW.city_original := NULL; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_order_city_before_write ON public.orders;
CREATE TRIGGER normalize_order_city_before_write
BEFORE INSERT OR UPDATE OF city ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.normalize_order_city_trigger();

UPDATE public.orders
SET city = private.normalize_moroccan_city(city)
WHERE city IS DISTINCT FROM private.normalize_moroccan_city(city);
