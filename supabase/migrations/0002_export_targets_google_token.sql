-- ============================================================================
-- Store the Google OAuth refresh token needed to write to the user's own
-- Google Sheets on their behalf (drive.file + spreadsheets scopes, requested
-- at sign-in with access_type=offline & prompt=consent).
-- ============================================================================

alter table public.export_targets
  add column google_refresh_token text;
