-- The staff portal stores a cancellation reason in action_type as
-- "cancelled:<reason>" and the staff UI reads it from that value.
-- The old CHECK allowed only the bare "cancelled" value, causing the order
-- status update to succeed but the audit insert to fail with HTTP 400.
-- Permit the existing documented format while keeping the reason bounded.

ALTER TABLE public.staff_order_actions
  DROP CONSTRAINT IF EXISTS staff_order_actions_action_type_check;

ALTER TABLE public.staff_order_actions
  ADD CONSTRAINT staff_order_actions_action_type_check
  CHECK (
    action_type IN ('confirmed', 'cancelled', 'call_later', 'edited')
    OR (
      action_type LIKE 'cancelled:%'
      AND char_length(substring(action_type FROM 11)) BETWEEN 1 AND 180
    )
  );
