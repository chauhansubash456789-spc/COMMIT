CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    clean_username TEXT;
    base_username TEXT;
    seq INT := 1;
    new_profile_id UUID;
BEGIN
    -- Prefer user-provided username from metadata
    base_username := LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
    IF base_username IS NULL OR LENGTH(base_username) < 3 THEN
        base_username := 'user_' || SUBSTRING(NEW.id::TEXT, 1, 8);
    END IF;
    clean_username := base_username;

    -- Ensure unique username
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = clean_username) LOOP
        clean_username := base_username || '_' || seq::TEXT;
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
    ON CONFLICT (auth_user_id) DO NOTHING
    RETURNING id INTO new_profile_id;

    -- Insert Stats
    IF new_profile_id IS NOT NULL THEN
        INSERT INTO public.user_stats (user_id)
        VALUES (new_profile_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;