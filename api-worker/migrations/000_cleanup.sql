-- ============================================================================
-- Cleanup Script - Run this FIRST to remove all existing tables
-- ============================================================================

DROP TABLE IF EXISTS rate_limit_hits CASCADE;
DROP TABLE IF EXISTS idempotency_records CASCADE;
DROP TABLE IF EXISTS session_logs CASCADE;

DROP FUNCTION IF EXISTS cleanup_expired_idempotency_records();
DROP FUNCTION IF EXISTS cleanup_old_rate_limit_hits();
DROP FUNCTION IF EXISTS cleanup_old_session_logs();

-- Success message
SELECT 'Cleanup completed successfully!' as message;
