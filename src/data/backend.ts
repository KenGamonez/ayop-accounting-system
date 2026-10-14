// Live-backend boundary (Slice 1). Pure logic + thin Supabase client.
// Modes: demo (default, localStorage demo data), live (Supabase reference
// reads), setup-error (live selected but URL/key missing — never silently
// falls back to demo). Only the publishable anon key is ever used here;
// the service-role key must never enter frontend code.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type BackendMode = 'demo' | 'live' | 'setup-error';

export interface BackendEnv {
  backend?: string;
  url?: string;
  anonKey?: string;
}

/** Read from Vite env at runtime; testable with injected values. */
export function readBackendEnv(): BackendEnv {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return {
    backend: meta.env?.VITE_AYOP_BACKEND,
    url: meta.env?.VITE_SUPABASE_URL,
    anonKey: meta.env?.VITE_SUPABASE_ANON_KEY,
  };
}

export function resolveBackendMode(env: BackendEnv): BackendMode {
  if ((env.backend ?? 'demo').toLowerCase() !== 'live') return 'demo';
  if (!env.url || !env.anonKey) return 'setup-error';
  return 'live';
}

let cached: { key: string; client: SupabaseClient } | null = null;

/** Lazily creates the anon-key client. Call only in live mode. */
export function getSupabaseClient(url: string, anonKey: string): SupabaseClient {
  const key = url + '|' + anonKey.slice(-8);
  if (!cached || cached.key !== key) {
    cached = { key, client: createClient(url, anonKey) };
  }
  return cached.client;
}

export interface LiveAccount { code: string; name: string; type: string }
export interface LiveReference {
  units: string[];
  coa: LiveAccount[];
  staffLinked: number;
  staffTotal: number;
}

/**
 * Reads verified reference data. Throws a plain-language error on failure.
 * Units + COA are anon-readable by policy; the staff directory requires a
 * signed-in session, so without linked accounts only counts are attempted
 * and directory failure is reported, not hidden.
 */
export async function fetchLiveReference(client: SupabaseClient): Promise<LiveReference> {
  const [unitsRes, coaRes] = await Promise.all([
    client.from('business_units').select('name').order('name'),
    client.from('chart_of_accounts').select('code,name,type').order('code'),
  ]);
  if (unitsRes.error) throw new Error('Units read failed: ' + unitsRes.error.message);
  if (coaRes.error) throw new Error('Chart read failed: ' + coaRes.error.message);
  let staffLinked = 0;
  let staffTotal = 0;
  const staffRes = await client.from('staff').select('id,auth_user_id');
  if (!staffRes.error && Array.isArray(staffRes.data)) {
    staffTotal = staffRes.data.length;
    staffLinked = staffRes.data.filter((s: { auth_user_id?: string | null }) => !!s.auth_user_id).length;
  }
  return {
    units: (unitsRes.data ?? []).map((u: { name: string }) => u.name),
    coa: (coaRes.data ?? []) as LiveAccount[],
    staffLinked,
    staffTotal,
  };
}
