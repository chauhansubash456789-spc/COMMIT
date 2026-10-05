CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status) THEN
        IF (COALESCE(auth.role(), '') IN ('authenticated', 'anon')) THEN
            RAISE EXCEPTION 'Privilege Escalation Blocked: Role and Status cannot be modified by clients.';
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_profile_escalation
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_escalation();
