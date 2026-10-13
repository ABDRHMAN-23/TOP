const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
const requiredForLive = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const missing = requiredForLive.filter((name) => !process.env[name]?.trim() || /YOUR_|PLACEHOLDER|CHANGE_ME/i.test(process.env[name]));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

console.log('Sinan configuration preflight');
console.log(`Mode: ${demoMode ? 'DEMO (synthetic data only)' : 'LIVE'}`);
if (demoMode) {
  console.log('PASS: demo mode does not require live database credentials.');
  console.log('NOTE: demo mode intentionally disables persistence of patient and clinical data.');
  process.exit(0);
}

if (missing.length) {
  console.error(`FAIL: configure these server/deployment variables: ${missing.join(', ')}`);
  process.exit(1);
}

try {
  const parsed = new URL(supabaseUrl);
  const trustedHost = parsed.hostname.endsWith('.supabase.co') || ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Supabase URL must use HTTPS outside local development.');
  }
  if (!trustedHost) throw new Error('URL host is not a Supabase project host.');
} catch (error) {
  console.error(`FAIL: NEXT_PUBLIC_SUPABASE_URL is invalid: ${error instanceof Error ? error.message : 'invalid URL'}`);
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY?.trim() || /YOUR_|PLACEHOLDER|CHANGE_ME/i.test(process.env.GEMINI_API_KEY)) {
  console.error('FAIL: configure GEMINI_API_KEY on the server before enabling transcription processing.');
  process.exit(1);
}

console.log('PASS: required live-mode environment values are present (values were not printed).');
console.log('REQUIRED: database migration, Auth, private Storage policies, tenant-isolation checks, and build/deployment verification must still be confirmed separately.');
