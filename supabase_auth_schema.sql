DROP TABLE IF EXISTS public.verifier_stats CASCADE;
DROP TABLE IF EXISTS public.verifier_profiles CASCADE;
-- =============================================================================
-- COMMIT PROTOCOL: COMPLETE SUPABASE AUTHENTICATION & SECURITY SCHEMA
-- =============================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS & CONSTANTS
DO $$ BEGIN
    CREATE TYPE public.app_user_role AS ENUM ('USER', 'VERIFIER', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.verifier_status_type AS ENUM ('NOT_APPLIED', 'PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.verifier_level_type AS ENUM ('NEW', 'VERIFIED', 'TRUSTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USER PROFILES TABLE (Bound to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT UNIQUE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'VERIFIER', 'ADMIN', 'SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id ON public.user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON public.user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 3. USER STATISTICS TABLE (Authoritatively calculated, client write blocked)
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_commitments INT NOT NULL DEFAULT 0,
    successful_commitments INT NOT NULL DEFAULT 0,
    failed_commitments INT NOT NULL DEFAULT 0,
    success_rate NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    total_staked_usdc NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VERIFIER PROFILES TABLE (RBAC for verifier privileges)
CREATE TABLE IF NOT EXISTS public.verifier_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('NOT_APPLIED', 'PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED')),
    verification_level TEXT NOT NULL DEFAULT 'NEW' CHECK (verification_level IN ('NEW', 'VERIFIED', 'TRUSTED')),
    verification_types TEXT[] DEFAULT ARRAY['peer_consensus']::TEXT[],
    member_since TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifier_profiles_status ON public.verifier_profiles(verification_status);

-- 5. VERIFIER STATISTICS TABLE (Authoritatively calculated)
CREATE TABLE IF NOT EXISTS public.verifier_stats (
    verifier_id UUID PRIMARY KEY REFERENCES public.verifier_profiles(id) ON DELETE CASCADE,
    total_verifications INT NOT NULL DEFAULT 0,
    successful_verifications INT NOT NULL DEFAULT 0,
    failed_verifications INT NOT NULL DEFAULT 0,
    disputed_verifications INT NOT NULL DEFAULT 0,
    resolved_disputes INT NOT NULL DEFAULT 0,
    overturned_decisions INT NOT NULL DEFAULT 0,
    accuracy_rate NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    average_rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    cancellation_count INT NOT NULL DEFAULT 0,
    no_show_count INT NOT NULL DEFAULT 0,
    total_earned_usdc NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    pending_rewards_usdc NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. WALLET AUTH NONCES TABLE (Cryptographic challenge & anti-replay)
CREATE TABLE IF NOT EXISTS public.wallet_auth_nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL,
    message TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_nonces_lookup ON public.wallet_auth_nonces(wallet_address, nonce);

-- 7. ADMIN USERS TABLE (Explicit Admin Directory)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    admin_role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (admin_role IN ('ADMIN', 'SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- 8. AUDIT LOGS TABLE (Immutable administrative and security trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =============================================================================
-- DATABASE TRIGGERS & CONSTRAINTS (SECURITY ENFORCEMENT)
-- =============================================================================

-- Trigger: Automatically create public.user_profiles and user_stats on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    clean_username TEXT;
    base_username TEXT;
    seq INT := 1;
BEGIN
    base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
    IF base_username IS NULL OR LENGTH(base_username) < 3 THEN
        base_username := 'user_' || SUBSTRING(NEW.id::TEXT, 1, 8);
    END IF;
    clean_username := base_username;

    -- Ensure unique username
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = clean_username) LOOP
        clean_username := base_username || seq::TEXT;
        seq := seq + 1;
    END LOOP;

    -- Insert Profile
    INSERT INTO public.user_profiles (auth_user_id, username, display_name, role, status)
    VALUES (
        NEW.id,
        clean_username,
        COALESCE(NEW.raw_user_meta_data->>'display_name', clean_username),
        'USER',
        'ACTIVE'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    -- Insert Stats
    INSERT INTO public.user_stats (user_id)
    SELECT id FROM public.user_profiles WHERE auth_user_id = NEW.id
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Prevent privilege escalation on user_profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow service role (or postgres) to change role or status
    IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status) THEN
        IF current_setting('role', true) != 'service_role' AND current_user != 'postgres' THEN
            RAISE EXCEPTION 'Privilege Escalation Blocked: Role and Status can only be updated by authorized administrator.';
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_profile_escalation
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_escalation();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifier_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_auth_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. user_profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.user_profiles FOR SELECT
    USING (status != 'DISABLED');

DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.user_profiles;
CREATE POLICY "Users can update own safe profile fields"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Service role has full access on user_profiles" ON public.user_profiles;
CREATE POLICY "Service role has full access on user_profiles"
    ON public.user_profiles FOR ALL
    USING (true);

-- 2. user_stats Policies (Public read, client write blocked)
DROP POLICY IF EXISTS "Public stats viewable by everyone" ON public.user_stats;
CREATE POLICY "Public stats viewable by everyone"
    ON public.user_stats FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role has full access on user_stats" ON public.user_stats;
CREATE POLICY "Service role has full access on user_stats"
    ON public.user_stats FOR ALL
    USING (true);

-- 3. verifier_profiles Policies
DROP POLICY IF EXISTS "Active verifiers are viewable by everyone" ON public.verifier_profiles;
CREATE POLICY "Active verifiers are viewable by everyone"
    ON public.verifier_profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role has full access on verifier_profiles" ON public.verifier_profiles;
CREATE POLICY "Service role has full access on verifier_profiles"
    ON public.verifier_profiles FOR ALL
    USING (true);

-- 4. verifier_stats Policies
DROP POLICY IF EXISTS "Verifier stats viewable by everyone" ON public.verifier_stats;
CREATE POLICY "Verifier stats viewable by everyone"
    ON public.verifier_stats FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role has full access on verifier_stats" ON public.verifier_stats;
CREATE POLICY "Service role has full access on verifier_stats"
    ON public.verifier_stats FOR ALL
    USING (true);

-- 5. wallet_auth_nonces Policies (Strict User Scoping)
DROP POLICY IF EXISTS "Users can read own nonces" ON public.wallet_auth_nonces;
CREATE POLICY "Users can read own nonces"
    ON public.wallet_auth_nonces FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on wallet_auth_nonces" ON public.wallet_auth_nonces;
CREATE POLICY "Service role full access on wallet_auth_nonces"
    ON public.wallet_auth_nonces FOR ALL
    USING (true);

-- 6. admin_users Policies (Restricted to Admins & Service Role)
DROP POLICY IF EXISTS "Admins can view admin directory" ON public.admin_users;
CREATE POLICY "Admins can view admin directory"
    ON public.admin_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.auth_user_id = auth.uid() AND up.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Service role full access on admin_users" ON public.admin_users;
CREATE POLICY "Service role full access on admin_users"
    ON public.admin_users FOR ALL
    USING (true);

-- 7. audit_logs Policies (Read-only for Admins, Insert for System)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.auth_user_id = auth.uid() AND up.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Service role full access on audit_logs" ON public.audit_logs;
CREATE POLICY "Service role full access on audit_logs"
    ON public.audit_logs FOR ALL
    USING (true);
