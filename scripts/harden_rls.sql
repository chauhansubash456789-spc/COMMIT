-- Drop all insecure wildcard policies on existing tables
DROP POLICY IF EXISTS "Service role has full access on user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role has full access on user_stats" ON public.user_stats;
DROP POLICY IF EXISTS "Service role has full access on verifier_profiles" ON public.verifier_profiles;
DROP POLICY IF EXISTS "Service role has full access on verifier_stats" ON public.verifier_stats;
DROP POLICY IF EXISTS "Service role full access on wallet_auth_nonces" ON public.wallet_auth_nonces;
DROP POLICY IF EXISTS "Service role full access on admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Service role full access on audit_logs" ON public.audit_logs;

-- Triggers for Defense-in-Depth against tampering
CREATE OR REPLACE FUNCTION public.prevent_stats_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (COALESCE(auth.role(), '') IN ('authenticated', 'anon')) THEN
        RAISE EXCEPTION 'Privilege Escalation Blocked: User statistics are authoritatively computed and cannot be updated by clients.';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_stats_tampering ON public.user_stats;
CREATE TRIGGER trg_prevent_stats_tampering
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW EXECUTE FUNCTION public.prevent_stats_tampering();

CREATE OR REPLACE FUNCTION public.prevent_verifier_profile_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (COALESCE(auth.role(), '') IN ('authenticated', 'anon')) THEN
        RAISE EXCEPTION 'Privilege Escalation Blocked: Verifier status and level can only be modified by authorized administrator.';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_verifier_profile_tampering ON public.verifier_profiles;
CREATE TRIGGER trg_prevent_verifier_profile_tampering
    BEFORE UPDATE ON public.verifier_profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_verifier_profile_tampering();

CREATE OR REPLACE FUNCTION public.prevent_verifier_stats_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (COALESCE(auth.role(), '') IN ('authenticated', 'anon')) THEN
        RAISE EXCEPTION 'Privilege Escalation Blocked: Verifier statistics are authoritatively computed and cannot be updated by clients.';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_verifier_stats_tampering ON public.verifier_stats;
CREATE TRIGGER trg_prevent_verifier_stats_tampering
    BEFORE UPDATE ON public.verifier_stats
    FOR EACH ROW EXECUTE FUNCTION public.prevent_verifier_stats_tampering();