-- Allow signed-in users to call the admin predicate used by the gift-assignment RPC.
-- is_admin() only evaluates the current caller (auth.uid()) and returns a boolean.
-- Keep it unavailable to anonymous/public callers.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
