import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '@/lib/supabase/url';

export type TestWorkspaceResource =
  | 'appointments' | 'clinic_settings' | 'booking_settings' | 'reports'
  | 'odontogram' | 'endodontics' | 'medical_history' | 'encounters'
  | 'patient_details' | 'booking_requests';

export function getTestWorkspaceToken(request: Request): string | null {
  const token = request.headers.get('x-sinan-test-workspace')?.trim() || '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token) ? token : null;
}

export function getTestWorkspaceClient(): SupabaseClient | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function listTestWorkspaceRecords(
  client: SupabaseClient,
  workspaceToken: string,
  resourceType: TestWorkspaceResource,
): Promise<{ data: any[]; error: any }> {
  const result = await client.rpc('sinan_test_list_records', {
    p_workspace_token: workspaceToken,
    p_resource_type: resourceType,
  });
  return { data: Array.isArray(result.data) ? result.data : [], error: result.error };
}

export async function getTestWorkspaceRecord(
  client: SupabaseClient,
  workspaceToken: string,
  resourceType: TestWorkspaceResource,
  recordId: string,
): Promise<{ data: any | null; error: any }> {
  const result = await client.rpc('sinan_test_get_record', {
    p_workspace_token: workspaceToken,
    p_resource_type: resourceType,
    p_record_id: recordId,
  });
  return { data: result.data && typeof result.data === 'object' ? result.data : null, error: result.error };
}

export async function upsertTestWorkspaceRecord(
  client: SupabaseClient,
  workspaceToken: string,
  resourceType: TestWorkspaceResource,
  payload: Record<string, unknown>,
  options: { recordId?: string | null; patientId?: string | null } = {},
): Promise<{ data: any | null; error: any }> {
  const result = await client.rpc('sinan_test_upsert_record', {
    p_workspace_token: workspaceToken,
    p_resource_type: resourceType,
    p_record_id: options.recordId ?? null,
    p_patient_id: options.patientId ?? null,
    p_payload: payload,
  });
  return { data: result.data && typeof result.data === 'object' ? result.data : null, error: result.error };
}
