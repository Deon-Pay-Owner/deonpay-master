-- Products and Checkout System for DeonPay
-- This migration creates tables for managing products, checkout sessions, and payment links
-- Similar to Stripe's product and checkout system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Basic product information
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,

  -- Pricing
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0), -- Amount in minor units (e.g., cents)
  currency TEXT NOT NULL DEFAULT 'MXN' CHECK (LENGTH(currency) = 3),

  -- Product type
  type TEXT NOT NULL DEFAULT 'one_time' CHECK (type IN ('one_time', 'recurring')),

  -- Recurring product settings (for subscriptions)
  recurring_interval TEXT CHECK (
    type = 'one_time' OR recurring_interval IN ('day', 'week', 'month', 'year')
  ),
  recurring_interval_count INTEGER CHECK (
    type = 'one_time' OR (recurring_interval_count IS NOT NULL AND recurring_interval_count > 0)
  ),

  -- Inventory management (optional)
  inventory_type TEXT DEFAULT 'infinite' CHECK (inventory_type IN ('infinite', 'finite', 'bucket')),
  inventory_quantity INTEGER CHECK (
    inventory_type = 'infinite' OR inventory_quantity IS NOT NULL
  ),

  -- Images and media
  images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs

  -- Additional settings
  metadata JSONB DEFAULT '{}'::jsonb,
  tax_code TEXT, -- For tax calculation integrations
  statement_descriptor TEXT, -- Custom descriptor for bank statements
  unit_label TEXT, -- Display label for the unit (e.g., "seat", "license")

  -- URL slug for public access
  slug TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_merchant_slug UNIQUE(merchant_id, slug),
  CONSTRAINT recurring_settings_check CHECK (
    (type = 'one_time' AND recurring_interval IS NULL AND recurring_interval_count IS NULL) OR
    (type = 'recurring' AND recurring_interval IS NOT NULL AND recurring_interval_count IS NOT NULL)
  )
);

-- ============================================================================
-- PRICE TIERS TABLE (for volume pricing)
-- ============================================================================

CREATE TABLE product_price_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Tier boundaries
  up_to INTEGER, -- NULL means infinity
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0),
  flat_amount INTEGER CHECK (flat_amount >= 0), -- Optional flat fee for this tier

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_product_tier UNIQUE(product_id, up_to)
);

-- ============================================================================
-- CHECKOUT SESSIONS TABLE
-- ============================================================================

CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Session configuration
  mode TEXT NOT NULL DEFAULT 'payment' CHECK (mode IN ('payment', 'subscription', 'setup')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete', 'expired')),

  -- Customer information
  customer_id UUID REFERENCES customers(id),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,

  -- URLs for redirect
  success_url TEXT NOT NULL,
  cancel_url TEXT NOT NULL,
  return_url TEXT, -- Optional return URL after processing

  -- Payment configuration
  currency TEXT NOT NULL DEFAULT 'MXN' CHECK (LENGTH(currency) = 3),
  amount_total INTEGER, -- Total amount (calculated from line items)
  amount_subtotal INTEGER, -- Subtotal before tax/shipping
  amount_tax INTEGER, -- Tax amount
  amount_shipping INTEGER, -- Shipping amount

  -- Payment collection
  payment_intent_id UUID REFERENCES payment_intents(id),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'no_payment_required')),

  -- Session settings
  allow_promotion_codes BOOLEAN DEFAULT false,
  billing_address_collection TEXT CHECK (billing_address_collection IN ('auto', 'required')),
  shipping_address_collection JSONB, -- Countries to collect shipping for
  shipping_options JSONB DEFAULT '[]'::jsonb, -- Available shipping options

  -- Tax settings
  automatic_tax JSONB DEFAULT '{"enabled": false}'::jsonb,
  tax_id_collection JSONB DEFAULT '{"enabled": false}'::jsonb,

  -- Consent collection
  consent_collection JSONB DEFAULT '{}'::jsonb,

  -- Custom fields
  custom_fields JSONB DEFAULT '[]'::jsonb,

  -- Line items are stored separately

  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  locale TEXT DEFAULT 'es',

  -- Unique session URL
  url_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- CHECKOUT LINE ITEMS TABLE
-- ============================================================================

CREATE TABLE checkout_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checkout_session_id UUID NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,

  -- Product reference (optional - can have ad-hoc items)
  product_id UUID REFERENCES products(id),

  -- Price information (can override product price)
  price_data JSONB, -- For ad-hoc pricing
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Calculated amounts
  amount_subtotal INTEGER NOT NULL,
  amount_total INTEGER NOT NULL,
  amount_tax INTEGER DEFAULT 0,
  amount_discount INTEGER DEFAULT 0,

  -- Display information
  name TEXT NOT NULL,
  description TEXT,
  images JSONB DEFAULT '[]'::jsonb,

  -- Tax configuration
  tax_rates JSONB DEFAULT '[]'::jsonb,

  -- Discounts applied
  discounts JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT LINKS TABLE
-- ============================================================================

CREATE TABLE payment_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Link configuration
  active BOOLEAN NOT NULL DEFAULT true,
  type TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('payment', 'subscription')),

  -- Product association
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {product_id, quantity, price_data}

  -- URL configuration
  url_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  custom_url TEXT, -- Optional custom URL slug

  -- Redirect URLs
  after_completion_url TEXT,
  after_completion_message TEXT,

  -- Payment configuration
  currency TEXT NOT NULL DEFAULT 'MXN' CHECK (LENGTH(currency) = 3),
  allow_promotion_codes BOOLEAN DEFAULT false,

  -- Collection settings
  billing_address_collection TEXT CHECK (billing_address_collection IN ('auto', 'required')),
  shipping_address_collection JSONB,
  phone_number_collection BOOLEAN DEFAULT false,

  -- Tax settings
  automatic_tax JSONB DEFAULT '{"enabled": false}'::jsonb,
  tax_id_collection JSONB DEFAULT '{"enabled": false}'::jsonb,

  -- Custom fields
  custom_fields JSONB DEFAULT '[]'::jsonb,
  custom_text JSONB DEFAULT '{}'::jsonb, -- Custom submit button text, etc.

  -- Consent settings
  consent_collection JSONB DEFAULT '{}'::jsonb,

  -- Restrictions
  restrictions JSONB DEFAULT '{}'::jsonb, -- e.g., quantity limits, time restrictions

  -- Analytics
  click_count INTEGER DEFAULT 0,
  completed_sessions_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- QR code (generated)
  qr_code_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_merchant_custom_url UNIQUE(merchant_id, custom_url)
);

-- ============================================================================
-- PAYMENT LINK ANALYTICS TABLE
-- ============================================================================

CREATE TABLE payment_link_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_link_id UUID NOT NULL REFERENCES payment_links(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'checkout_started', 'checkout_completed')),

  -- Session tracking
  session_id TEXT,
  checkout_session_id UUID REFERENCES checkout_sessions(id),

  -- User information
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,

  -- Location information (from IP)
  country TEXT,
  city TEXT,

  -- Device information
  device_type TEXT,
  browser TEXT,
  os TEXT,

  -- UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- COUPONS TABLE (for promotions)
-- ============================================================================

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Coupon code
  code TEXT NOT NULL,
  name TEXT NOT NULL,

  -- Discount configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  currency TEXT CHECK (
    discount_type = 'percentage' OR (discount_type = 'fixed_amount' AND LENGTH(currency) = 3)
  ),

  -- Usage limits
  max_redemptions INTEGER,
  times_redeemed INTEGER DEFAULT 0,

  -- Time restrictions
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,

  -- Product restrictions
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products')),
  product_ids UUID[] DEFAULT '{}',

  -- Customer restrictions
  first_time_transaction BOOLEAN DEFAULT false,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_merchant_coupon_code UNIQUE(merchant_id, code)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Products indexes
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_created_at ON products(created_at);

-- Price tiers indexes
CREATE INDEX idx_price_tiers_product_id ON product_price_tiers(product_id);

-- Checkout sessions indexes
CREATE INDEX idx_checkout_sessions_merchant_id ON checkout_sessions(merchant_id);
CREATE INDEX idx_checkout_sessions_status ON checkout_sessions(status);
CREATE INDEX idx_checkout_sessions_payment_intent_id ON checkout_sessions(payment_intent_id);
CREATE INDEX idx_checkout_sessions_customer_id ON checkout_sessions(customer_id);
CREATE INDEX idx_checkout_sessions_url_key ON checkout_sessions(url_key);
CREATE INDEX idx_checkout_sessions_expires_at ON checkout_sessions(expires_at);
CREATE INDEX idx_checkout_sessions_created_at ON checkout_sessions(created_at);

-- Line items indexes
CREATE INDEX idx_line_items_checkout_session_id ON checkout_line_items(checkout_session_id);
CREATE INDEX idx_line_items_product_id ON checkout_line_items(product_id);

-- Payment links indexes
CREATE INDEX idx_payment_links_merchant_id ON payment_links(merchant_id);
CREATE INDEX idx_payment_links_active ON payment_links(active);
CREATE INDEX idx_payment_links_url_key ON payment_links(url_key);
CREATE INDEX idx_payment_links_custom_url ON payment_links(custom_url);
CREATE INDEX idx_payment_links_created_at ON payment_links(created_at);

-- Analytics indexes
CREATE INDEX idx_link_analytics_payment_link_id ON payment_link_analytics(payment_link_id);
CREATE INDEX idx_link_analytics_event_type ON payment_link_analytics(event_type);
CREATE INDEX idx_link_analytics_created_at ON payment_link_analytics(created_at);
CREATE INDEX idx_link_analytics_session_id ON payment_link_analytics(session_id);

-- Coupons indexes
CREATE INDEX idx_coupons_merchant_id ON coupons(merchant_id);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(active);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checkout_sessions_updated_at BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON payment_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_link_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Merchants can manage their products"
  ON products FOR ALL
  USING (merchant_id IN (
    SELECT merchant_id FROM merchant_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Public can view active products (for checkout pages)
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (active = true);

-- Price tiers policies
CREATE POLICY "Merchants can manage price tiers"
  ON product_price_tiers FOR ALL
  USING (product_id IN (
    SELECT id FROM products WHERE merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- Checkout sessions policies
CREATE POLICY "Merchants can manage their checkout sessions"
  ON checkout_sessions FOR ALL
  USING (merchant_id IN (
    SELECT merchant_id FROM merchant_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Public can view their own checkout sessions (by URL key)
CREATE POLICY "Public can view checkout sessions by URL"
  ON checkout_sessions FOR SELECT
  USING (true); -- Will be filtered by URL key in application

-- Line items policies
CREATE POLICY "Merchants can manage checkout line items"
  ON checkout_line_items FOR ALL
  USING (checkout_session_id IN (
    SELECT id FROM checkout_sessions WHERE merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- Public can view line items for their checkout sessions
CREATE POLICY "Public can view checkout line items"
  ON checkout_line_items FOR SELECT
  USING (true); -- Will be filtered by checkout session in application

-- Payment links policies
CREATE POLICY "Merchants can manage their payment links"
  ON payment_links FOR ALL
  USING (merchant_id IN (
    SELECT merchant_id FROM merchant_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Public can view active payment links
CREATE POLICY "Public can view active payment links"
  ON payment_links FOR SELECT
  USING (active = true);

-- Analytics policies
CREATE POLICY "Merchants can view their analytics"
  ON payment_link_analytics FOR SELECT
  USING (payment_link_id IN (
    SELECT id FROM payment_links WHERE merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- Public can insert analytics (tracking)
CREATE POLICY "Public can insert analytics"
  ON payment_link_analytics FOR INSERT
  WITH CHECK (true);

-- Coupons policies
CREATE POLICY "Merchants can manage their coupons"
  ON coupons FOR ALL
  USING (merchant_id IN (
    SELECT merchant_id FROM merchant_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate a unique slug for products
CREATE OR REPLACE FUNCTION generate_product_slug(p_name TEXT, p_merchant_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from name
  base_slug := LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := TRIM(BOTH '-' FROM base_slug);

  final_slug := base_slug;

  -- Check for uniqueness and add counter if needed
  WHILE EXISTS(SELECT 1 FROM products WHERE merchant_id = p_merchant_id AND slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate checkout session totals
CREATE OR REPLACE FUNCTION calculate_checkout_totals(p_session_id UUID)
RETURNS TABLE(subtotal INTEGER, tax INTEGER, total INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount_subtotal), 0)::INTEGER as subtotal,
    COALESCE(SUM(amount_tax), 0)::INTEGER as tax,
    COALESCE(SUM(amount_total), 0)::INTEGER as total
  FROM checkout_line_items
  WHERE checkout_session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check and expire checkout sessions
CREATE OR REPLACE FUNCTION expire_checkout_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE checkout_sessions
  SET status = 'expired'
  WHERE status = 'open'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to increment payment link analytics
CREATE OR REPLACE FUNCTION increment_payment_link_stats(
  p_link_id UUID,
  p_event_type TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_event_type = 'click' THEN
    UPDATE payment_links
    SET click_count = click_count + 1
    WHERE id = p_link_id;
  ELSIF p_event_type = 'checkout_completed' THEN
    UPDATE payment_links
    SET completed_sessions_count = completed_sessions_count + 1
    WHERE id = p_link_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Add sample product categories to metadata
-- This is just a convention, actual categories can be stored in metadata

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE products IS 'Products catalog for merchants';
COMMENT ON TABLE checkout_sessions IS 'Checkout sessions for processing payments';
COMMENT ON TABLE payment_links IS 'Shareable payment links for products';
COMMENT ON TABLE coupons IS 'Discount coupons for promotions';

COMMENT ON COLUMN products.unit_amount IS 'Price in minor units (e.g., cents for USD, centavos for MXN)';
COMMENT ON COLUMN checkout_sessions.url_key IS 'Unique key for public checkout URL access';
COMMENT ON COLUMN payment_links.url_key IS 'Unique key for public payment link URL';