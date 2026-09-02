-- Finalize the AlphaBy production bootstrap without creating duplicate Auth
-- identities. The production project already owns soporte@alphaby.cloud; the
-- misspelled `suport@...` address from the commercial request is accepted only
-- as a backwards-compatible fallback when it is the identity that exists.

DO $bootstrap$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = 'craftzdog@alphaby.cloud'
  ) THEN
    PERFORM app_private.bootstrap_platform_operator(
      'craftzdog@alphaby.cloud',
      'craftzdog',
      'AlphaBy SaaS Owner',
      'OWNER',
      true
    );
    PERFORM app_private.bootstrap_internal_trial_tenant(
      'atlasby',
      'AtlasBy',
      'craftzdog@alphaby.cloud',
      'STARTER',
      30
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = 'soporte@alphaby.cloud'
  ) THEN
    PERFORM app_private.bootstrap_platform_operator(
      'soporte@alphaby.cloud',
      'alphaby.support',
      'AlphaBy Support',
      'SUPPORT',
      true
    );
  ELSIF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = 'suport@alphaby.cloud'
  ) THEN
    PERFORM app_private.bootstrap_platform_operator(
      'suport@alphaby.cloud',
      'alphaby.support',
      'AlphaBy Support',
      'SUPPORT',
      true
    );
  END IF;
END
$bootstrap$;

-- Supabase keeps PostgREST running when Data API is disabled and otherwise
-- points it at a non-existent sentinel schema. An existing empty schema stops
-- the recurring log errors while preserving the API-only architecture.
CREATE SCHEMA IF NOT EXISTS pgrst_no_exposed_schemas AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA pgrst_no_exposed_schemas FROM PUBLIC, anon, authenticated;
DO $postgrest_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator SET pgrst.db_schemas = ''pgrst_no_exposed_schemas''';
  END IF;
END
$postgrest_role$;
NOTIFY pgrst, 'reload config';

COMMENT ON SCHEMA pgrst_no_exposed_schemas IS
  'Intentionally empty schema used while the Supabase Data API is disabled. Reset authenticator pgrst.db_schemas before re-enabling it.';
