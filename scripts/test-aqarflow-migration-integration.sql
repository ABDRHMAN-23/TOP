\set ON_ERROR_STOP on

DO $$
DECLARE
  table_name text;
  expected_tables text[] := ARRAY[
    'aqarflow_workspace_memberships',
    'aqarflow_properties',
    'aqarflow_ai_usage',
    'aqarflow_whatsapp_integrations',
    'aqarflow_whatsapp_events',
    'aqarflow_whatsapp_outbound_requests',
    'aqarflow_crm_contacts',
    'aqarflow_crm_conversations',
    'aqarflow_crm_messages',
    'aqarflow_crm_contact_notes',
    'aqarflow_crm_tasks',
    'aqarflow_crm_viewings'
  ];
  forced_tables text[] := ARRAY[
    'aqarflow_workspace_memberships',
    'aqarflow_properties',
    'aqarflow_ai_usage',
    'aqarflow_whatsapp_integrations',
    'aqarflow_whatsapp_events',
    'aqarflow_whatsapp_outbound_requests',
    'aqarflow_crm_contacts',
    'aqarflow_crm_conversations',
    'aqarflow_crm_messages',
    'aqarflow_crm_contact_notes',
    'aqarflow_crm_tasks',
    'aqarflow_crm_viewings'
  ];
BEGIN
  FOREACH table_name IN ARRAY expected_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Expected AqarFlow table missing: %', table_name;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=to_regclass('public.' || table_name)) THEN
      RAISE EXCEPTION 'RLS is not enabled on %', table_name;
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY forced_tables LOOP
    IF NOT (SELECT c.relforcerowsecurity FROM pg_catalog.pg_class c WHERE c.oid=to_regclass('public.' || table_name)) THEN
      RAISE EXCEPTION 'FORCE ROW LEVEL SECURITY is not enabled on %', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated','public.aqarflow_whatsapp_integrations','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_whatsapp_events','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_whatsapp_outbound_requests','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_crm_contacts','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_crm_conversations','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_crm_messages','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_ai_usage','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_crm_contact_notes','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_crm_tasks','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_crm_viewings','SELECT')
     OR has_table_privilege('authenticated','public.aqarflow_workspace_memberships','INSERT') THEN
    RAISE EXCEPTION 'Authenticated role can directly read a protected AqarFlow table';
  END IF;

  IF NOT has_table_privilege('service_role','public.aqarflow_whatsapp_integrations','SELECT')
     OR NOT has_table_privilege('service_role','public.aqarflow_crm_messages','SELECT')
     OR NOT has_table_privilege('service_role','public.aqarflow_crm_contact_notes','SELECT')
     OR NOT has_table_privilege('service_role','public.aqarflow_crm_tasks','SELECT')
     OR NOT has_table_privilege('service_role','public.aqarflow_crm_viewings','SELECT') THEN
    RAISE EXCEPTION 'Service role grants are missing';
  END IF;
END $$;

INSERT INTO public.aqarflow_crm_contacts(id,owner_user_id,phone_number,display_name)
VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','15550000001','CRM owner A'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','15550000002','CRM owner B');

DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.aqarflow_crm_contact_notes(owner_user_id,contact_id,author_user_id,note)
    VALUES ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','cross-tenant note must be rejected');
  EXCEPTION WHEN foreign_key_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'Cross-tenant contact note relationship was not blocked by the composite foreign key';
  END IF;
END $$;

INSERT INTO public.aqarflow_properties(owner_user_id,title,purpose,availability)
VALUES
 ('00000000-0000-4000-8000-000000000001','Owner A listing','sale','available'),
 ('00000000-0000-4000-8000-000000000002','Owner B listing','sale','available');

-- Level 2 tenant boundaries and workflow invariants.
DO $ops_check$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.aqarflow_crm_tasks(owner_user_id,contact_id,title,due_at,created_by)
    VALUES ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
      'cross-tenant task','2030-01-01T10:00:00Z','00000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN foreign_key_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Cross-tenant task contact relationship was not rejected'; END IF;
END $ops_check$;

DO $ops_check$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.aqarflow_crm_viewings(owner_user_id,contact_id,property_id,title,starts_at,ends_at,created_by)
    VALUES ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
      (SELECT id FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000001' AND title='Owner A listing'),
      'invalid duration','2030-01-01T10:00:00Z','2030-01-01T10:00:00Z','00000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Invalid viewing time range was not rejected'; END IF;
END $ops_check$;

INSERT INTO public.aqarflow_crm_viewings(owner_user_id,contact_id,property_id,title,starts_at,ends_at,created_by)
VALUES ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  (SELECT id FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000001' AND title='Owner A listing'),
  'Owner A first viewing','2030-01-01T10:00:00Z','2030-01-01T11:00:00Z','00000000-0000-4000-8000-000000000001');

DO $ops_check$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.aqarflow_crm_viewings(owner_user_id,contact_id,property_id,title,starts_at,ends_at,created_by)
    VALUES ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
      (SELECT id FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000001' AND title='Owner A listing'),
      'Overlapping viewing','2030-01-01T10:30:00Z','2030-01-01T11:30:00Z','00000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN exclusion_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Overlapping viewing for one property was not rejected'; END IF;
END $ops_check$;

INSERT INTO public.aqarflow_crm_tasks(owner_user_id,contact_id,title,due_at,created_by)
VALUES
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','later follow-up','2030-01-04T10:00:00Z','00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','earlier follow-up','2030-01-03T10:00:00Z','00000000-0000-4000-8000-000000000001');
DO $ops_check$
DECLARE expected timestamptz; actual timestamptz;
BEGIN
  SELECT min(due_at) INTO expected FROM public.aqarflow_crm_tasks
   WHERE owner_user_id='00000000-0000-4000-8000-000000000001'
     AND contact_id='10000000-0000-4000-8000-000000000001' AND status IN ('pending','in_progress');
  SELECT next_follow_up_at INTO actual FROM public.aqarflow_crm_contacts
   WHERE owner_user_id='00000000-0000-4000-8000-000000000001' AND id='10000000-0000-4000-8000-000000000001';
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'CRM next_follow_up_at was not synchronized to the earliest active task'; END IF;
END $ops_check$;

UPDATE public.aqarflow_crm_tasks SET status='completed',completed_at='2030-01-02T10:00:00Z'
 WHERE owner_user_id='00000000-0000-4000-8000-000000000001' AND title='earlier follow-up';
DO $ops_check$
DECLARE actual timestamptz;
BEGIN
  SELECT next_follow_up_at INTO actual FROM public.aqarflow_crm_contacts
   WHERE owner_user_id='00000000-0000-4000-8000-000000000001' AND id='10000000-0000-4000-8000-000000000001';
  IF actual IS DISTINCT FROM '2030-01-04T10:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Completing a task did not advance the next follow-up'; END IF;
END $ops_check$;

-- The owner can read only their own property.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Workspace owner cannot read their own property';
  END IF;
  IF (SELECT count(*) FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'Cross-tenant property read was not blocked for owner';
  END IF;
  IF public.aqarflow_reserve_ai_request('00000000-0000-4000-8000-000000000001') IS NULL THEN
    RAISE EXCEPTION 'AI quota reservation failed unexpectedly';
  END IF;
END $$;
RESET ROLE;

-- Memberships expose only the current user's own membership or the owner's own workspace.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $ BEGIN
  IF (SELECT count(*) FROM public.aqarflow_workspace_memberships WHERE owner_id='00000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Member cannot read their own workspace membership';
  END IF;
  IF (SELECT count(*) FROM public.aqarflow_workspace_memberships WHERE owner_id='00000000-0000-4000-8000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'Member can read another workspace membership';
  END IF;
END $;
RESET ROLE;

-- A valid team member can read the owner's inventory but cannot read another workspace.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Workspace member cannot read assigned owner inventory';
  END IF;
  IF (SELECT count(*) FROM public.aqarflow_properties WHERE owner_user_id='00000000-0000-4000-8000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'Cross-tenant property read was not blocked for member';
  END IF;
END $$;
RESET ROLE;

-- Unrelated account cannot read inventory.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.aqarflow_properties) <> 0 THEN
    RAISE EXCEPTION 'Unrelated user can read AqarFlow inventory';
  END IF;
END $$;
RESET ROLE;

SELECT 'AqarFlow migration/RLS integration assertions passed.' AS result;
