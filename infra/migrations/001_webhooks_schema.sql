-- =============================================
-- LIMPIEZA: Eliminar tablas existentes
-- =============================================

DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- =============================================
-- PASO 1: Crear tablas
-- =============================================

-- Tabla de API Keys para los merchants
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK (key_type IN ('publishable', 'secret')),
  key_value TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Webhooks
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Webhook Events (Log de intentos de envío)
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 1,
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PASO 2: Crear índices
-- =============================================

CREATE INDEX idx_api_keys_merchant ON api_keys(merchant_id);
CREATE INDEX idx_api_keys_value ON api_keys(key_value);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

CREATE INDEX idx_webhooks_merchant ON webhooks(merchant_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;

CREATE INDEX idx_webhook_events_webhook ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_merchant ON webhook_events(merchant_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_delivered ON webhook_events(delivered);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- =============================================
-- PASO 3: Crear funciones y triggers
-- =============================================

-- Función para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PASO 4: Habilitar RLS
-- =============================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PASO 5: Crear políticas RLS
-- =============================================

-- Políticas para api_keys
CREATE POLICY "Merchants can view their own API keys"
  ON api_keys FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Merchants can create their own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their own API keys"
  ON api_keys FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Merchants can delete their own API keys"
  ON api_keys FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- Políticas para webhooks
CREATE POLICY "Merchants can view their own webhooks"
  ON webhooks FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Merchants can create their own webhooks"
  ON webhooks FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their own webhooks"
  ON webhooks FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "Merchants can delete their own webhooks"
  ON webhooks FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- Políticas para webhook_events
CREATE POLICY "Merchants can view their own webhook events"
  ON webhook_events FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- =============================================
-- PASO 6: Funciones helper
-- =============================================

-- Función para generar API Keys
CREATE OR REPLACE FUNCTION generate_api_key(
  p_merchant_id UUID,
  p_key_type TEXT,
  p_environment TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_random TEXT;
  v_key TEXT;
BEGIN
  -- Determinar prefijo
  IF p_key_type = 'publishable' THEN
    v_prefix := 'pk_' || p_environment || '_';
  ELSIF p_key_type = 'secret' THEN
    v_prefix := 'sk_' || p_environment || '_';
  ELSE
    RAISE EXCEPTION 'Invalid key_type. Must be publishable or secret';
  END IF;

  -- Generar parte aleatoria (32 caracteres)
  v_random := encode(gen_random_bytes(24), 'base64');
  v_random := replace(replace(replace(v_random, '/', ''), '+', ''), '=', '');
  v_random := substring(v_random, 1, 32);

  -- Combinar prefijo y parte aleatoria
  v_key := v_prefix || v_random;

  -- Insertar en la tabla
  INSERT INTO api_keys (merchant_id, key_type, key_value, key_prefix, environment)
  VALUES (p_merchant_id, p_key_type, v_key, v_prefix, p_environment);

  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para generar webhook secret
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS TEXT AS $$
DECLARE
  v_secret TEXT;
BEGIN
  v_secret := 'whsec_' || encode(gen_random_bytes(32), 'base64');
  v_secret := replace(replace(replace(v_secret, '/', ''), '+', ''), '=', '');
  RETURN substring(v_secret, 1, 44);
END;
$$ LANGUAGE plpgsql;
