#!/usr/bin/env bash
set -euo pipefail

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-aqarflow_ci}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

psql -v ON_ERROR_STOP=1 -f scripts/aqarflow-ci-bootstrap.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010000200_aqarflow_ai_runtime.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010000300_aqarflow_whatsapp_tech_provider.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010000400_aqarflow_crm_inbox.sql
psql -v ON_ERROR_STOP=1 -f scripts/test-aqarflow-migration-integration.sql

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT
if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004'; SELECT public.aqarflow_reserve_ai_request('00000000-0000-4000-8000-000000000001');" >"$tmpfile" 2>&1; then
  echo "ERROR: an unrelated user reserved AI quota against another workspace." >&2
  cat "$tmpfile" >&2
  exit 1
fi
if ! grep -q 'workspace_access_denied' "$tmpfile"; then
  echo "ERROR: cross-tenant quota test failed for an unexpected reason." >&2
  cat "$tmpfile" >&2
  exit 1
fi

if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003'; INSERT INTO public.aqarflow_properties(owner_user_id,title,purpose) VALUES ('00000000-0000-4000-8000-000000000001','forbidden member insert','sale');" >"$tmpfile" 2>&1; then
  echo "ERROR: a workspace member inserted inventory as the owner." >&2
  exit 1
fi
if ! grep -q 'row-level security policy' "$tmpfile"; then
  echo "ERROR: member write was rejected for an unexpected reason." >&2
  cat "$tmpfile" >&2
  exit 1
fi

echo "AqarFlow migrations applied on disposable PostgreSQL; RLS, service-role boundaries, and cross-tenant negative tests passed."
