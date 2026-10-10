\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    EXECUTE 'CREATE ROLE service_role NOLOGIN BYPASSRLS';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;

CREATE TABLE IF NOT EXISTS public.aqarflow_workspace_memberships (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, member_id),
  CHECK (owner_id <> member_id)
);
CREATE INDEX IF NOT EXISTS aqarflow_workspace_memberships_member_idx
  ON public.aqarflow_workspace_memberships(member_id, owner_id);
ALTER TABLE public.aqarflow_workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aqarflow_workspace_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aqarflow_workspace_memberships_read ON public.aqarflow_workspace_memberships;
CREATE POLICY aqarflow_workspace_memberships_read
  ON public.aqarflow_workspace_memberships FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR member_id = (SELECT auth.uid()));
REVOKE ALL ON public.aqarflow_workspace_memberships FROM public, anon;
REVOKE INSERT, UPDATE, DELETE ON public.aqarflow_workspace_memberships FROM authenticated;
GRANT SELECT ON public.aqarflow_workspace_memberships TO authenticated;
GRANT ALL ON public.aqarflow_workspace_memberships TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO public.aqarflow_workspace_memberships(owner_id, member_id, role) VALUES
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','member')
ON CONFLICT DO NOTHING;
