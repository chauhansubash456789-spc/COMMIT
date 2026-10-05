-- =============================================================================
-- COMMIT PROTOCOL: SUPABASE DATABASE SCHEMA
-- =============================================================================

-- 1. Create commitments table
CREATE TABLE IF NOT EXISTS public.commitments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    creator TEXT NOT NULL,
    staking_mode TEXT NOT NULL DEFAULT 'HARDCORE',
    stake_amount NUMERIC NOT NULL,
    penalty_amount NUMERIC NOT NULL DEFAULT 0,
    verification_fee NUMERIC NOT NULL DEFAULT 1.5,
    verifier_type TEXT NOT NULL,
    failure_policy TEXT,
    failure_policy_text TEXT,
    status TEXT NOT NULL DEFAULT 'CREATED',
    escrow_pda TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    attestation JSONB,
    settlement JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rapid lookups
CREATE INDEX IF NOT EXISTS idx_commitments_creator ON public.commitments(creator);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON public.commitments(status);

-- 2. Create verifier_profiles table
CREATE TABLE IF NOT EXISTS public.verifier_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rating NUMERIC DEFAULT 5.0,
    completed_verifications INT DEFAULT 0,
    accuracy_percent NUMERIC DEFAULT 100.0,
    dispute_count INT DEFAULT 0,
    total_earned_usdc NUMERIC DEFAULT 0.0,
    wallet TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial expert verifiers
INSERT INTO public.verifier_profiles (id, name, rating, completed_verifications, accuracy_percent, dispute_count, total_earned_usdc, wallet)
VALUES
    ('v_alex', 'Alex M.', 4.9, 128, 96.0, 4, 84.50, 'AlexVer1f1er111111111111111111111111111111111'),
    ('v_elena', 'Elena R.', 4.8, 94, 95.0, 2, 62.00, 'ElenaVer1f1er22222222222222222222222222222222'),
    ('v_chen', 'Chen W.', 5.0, 210, 98.0, 1, 145.00, 'ChenVer1f1er333333333333333333333333333333333')
ON CONFLICT (id) DO NOTHING;

-- 3. Create peer_votes table
CREATE TABLE IF NOT EXISTS public.peer_votes (
    id BIGSERIAL PRIMARY KEY,
    commitment_id TEXT REFERENCES public.commitments(id) ON DELETE CASCADE,
    verifier_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_votes ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public commitments are viewable by everyone" ON public.commitments FOR SELECT USING (true);
CREATE POLICY "Public verifier profiles are viewable by everyone" ON public.verifier_profiles FOR SELECT USING (true);
CREATE POLICY "Public peer votes are viewable by everyone" ON public.peer_votes FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access on commitments" ON public.commitments FOR ALL USING (true);
CREATE POLICY "Service role full access on verifiers" ON public.verifier_profiles FOR ALL USING (true);
CREATE POLICY "Service role full access on peer votes" ON public.peer_votes FOR ALL USING (true);
