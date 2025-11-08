-- =============================================
-- SOLO WEBHOOKS - NO TOCAR API_KEYS
-- =============================================

-- Eliminar solo tablas de webhooks si existen
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;

-- =============================================
-- Crear tablas de Webhooks
-- =============================================

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
-- Crear índices
-- =============================================

CREATE INDEX idx_webhooks_merchant ON webhooks(merchant_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;

CREATE INDEX idx_webhook_events_webhook ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_merchant ON webhook_events(merchant_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_delivered ON webhook_events(delivered);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- =============================================
-- Triggers para updated_at
-- =============================================

-- Crear función si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para webhooks
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Habilitar RLS
-- =============================================

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Políticas RLS para webhooks
-- =============================================

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

-- =============================================
-- Políticas RLS para webhook_events
-- =============================================

CREATE POLICY "Merchants can view their own webhook events"
  ON webhook_events FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- =============================================
-- Función helper para generar webhook secret
-- =============================================

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
