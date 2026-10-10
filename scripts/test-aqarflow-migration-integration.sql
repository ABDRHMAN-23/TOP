\set ON_ERROR_STOP on

DO $$
DECLARE
  table_name text;
  expected_tables text[] := ARRAY[
    'aqarflow_properties',
    'aqarflow_ai_usage',
    'aqarflow_whatsapp_integrations',
    'aqarflow_whatsapp_events',
    'aqarflow_whatsapp_outbound_requests',
    'aqarflow_crm_contacts',
    'aqarflow_crm_conversations',
    'aqarflow_crm_messages',
    'aqarflow_crm_contact_notes'
  ];
  forced_tables text[] := ARRAY[
    'aqarflow_whatsapp_integrations',
    'aqarflow_whatsapp_events',
    'aqarflow_whatsapp_outbound_requests',
    'aqarflow_crm_contacts',
    'aqarflow_crm_conversations',
    'aqarflow_crm_messages',
    'aqarflow_crm_contact_notes'
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
     OR has_table_privilege('authenticated','public.aqarflow_crm_contact_notes','SELECT') THEN
    RAISE EXCEPTION 'Authenticated role can directly read a protected AqarFlow table';
  END IF;

  IF NOT has_table_privilege('service_role','public.aqarflow_whatsapp_integrations','SELECT')
     OR NOT has_table_privilege('service_role','public.aqarflow_crm_messages','SELECT')
     OR NOT has_table_privilege('service_role','public.aqarflow_crm_contact_notes','SELECT') THEN
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
