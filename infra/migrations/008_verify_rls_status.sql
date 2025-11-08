-- Verify RLS status on all tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('merchants', 'users_profile', 'merchant_members')
ORDER BY tablename;

-- If RLS is still enabled, force disable it again
ALTER TABLE merchants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_members DISABLE ROW LEVEL SECURITY;

-- Verify again
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('merchants', 'users_profile', 'merchant_members')
ORDER BY tablename;
