-- create_booking() and get_available_slots() are SECURITY DEFINER functions
-- left over from an earlier design where the browser talked to PostgREST
-- directly. Nothing calls them any more: the bookings module issues its own
-- SQL over DATABASE_URL.
--
-- While they stayed executable by `anon`, anyone with the public key could
-- POST to /rest/v1/rpc/create_booking and insert bookings straight into the
-- table, bypassing the throttler, the honeypot field and the form-timing
-- check in bookings.service.ts. The owner (DATABASE_URL) keeps its access, so
-- nothing in the application changes.
--
-- is_admin()/is_super_admin() are deliberately left alone: they are evaluated
-- inside the RLS policies on every table, and they disclose nothing beyond a
-- boolean about the caller themselves.

revoke execute on function public.create_booking(text, text, uuid, timestamptz, text) from anon, authenticated;
revoke execute on function public.get_available_slots(date, uuid) from anon, authenticated;
