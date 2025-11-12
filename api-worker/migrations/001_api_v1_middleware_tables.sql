-- ============================================================================
-- DeonPay API v1 - Middleware Tables Migration
-- ============================================================================

-- Drop existing tables if needed (uncomment for clean reinstall)
-- DROP TABLE IF EXISTS rate_limit_hits CASCADE;
-- DROP TABLE IF EXISTS idempotency_records CASCADE;
-- DROP TABLE IF EXISTS session_logs CASCADE;

-- ============================================================================
-- Table 1: Rate Limit Hits
-- ============================================================================

CREATE TABLE rate_limit_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  route_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_hits_lookup ON rate_limit_hits(merchant_id, route_key, created_at DESC);
CREATE INDEX idx_rate_limit_hits_cleanup ON rate_limit_hits(created_at);

-- ============================================================================
-- Table 2: Idempotency Records
-- ============================================================================

CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  status INTEGER NOT NULL,
  response JSONB NOT NULL,
  headers JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl TIMESTAMPTZ NOT NULL,
  UNIQUE (merchant_id, endpoint, idempotency_key)
);

CREATE INDEX idx_idempotency_lookup ON idempotency_records(merchant_id, endpoint, idempotency_key);
CREATE INDEX idx_idempotency_ttl ON idempotency_records(ttl);

-- ============================================================================
-- Table 3: Session Logs
-- ============================================================================

CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  merchant_id UUID,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL,
  duration_ms INTEGER,
  ip TEXT,
  user_agent TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_logs_merchant ON session_logs(merchant_id, created_at DESC);
CREATE INDEX idx_session_logs_request_id ON session_logs(request_id);
CREATE INDEX idx_session_logs_route ON session_logs(route, created_at DESC);
CREATE INDEX idx_session_logs_created_at ON session_logs(created_at DESC);

-- ============================================================================
-- Cleanup Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_records()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_records WHERE ttl < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_hits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limit_hits WHERE created_at < NOW() - INTERVAL '2 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_session_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM session_logs WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Enable RLS (without policies for now)
-- ============================================================================

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
