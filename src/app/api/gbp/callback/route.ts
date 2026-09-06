// src/app/api/gbp/callback/route.ts — routable mount for the OAuth flow
// The flow itself lives in src/integrations/gbp/oauth.ts (per the file
// tree); this one-liner gives Google the redirect URL to call:
// {APP_URL}/api/gbp/callback — register it in the Google Cloud console.
export { GET } from "@/integrations/gbp/oauth";