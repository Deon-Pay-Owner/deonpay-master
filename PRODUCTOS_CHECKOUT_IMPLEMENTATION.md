# Sistema de Productos y Checkout - DeonPay

## Resumen del Sistema

Este documento describe la implementación completa del sistema de productos y checkout para DeonPay, similar a cómo funciona Stripe. El sistema permite a los merchants crear productos, generar payment links, y procesar pagos a través de una página de checkout hospedada.

## Características Implementadas

### 1. API de Productos
- ✅ Crear, editar, eliminar y listar productos
- ✅ Soporte para productos únicos y recurrentes (suscripciones)
- ✅ Inventario opcional (infinito, finito, bucket)
- ✅ Metadata personalizada
- ✅ Imágenes de productos
- ✅ Precios por niveles (price tiers)
- ✅ Validaciones de seguridad con RLS

### 2. Sistema de Checkout
- ✅ Crear checkout sessions con producto(s)
- ✅ URL única para cada checkout
- ✅ Página de checkout hospedada responsive
- ✅ Integración preparada para DeonPay Elements
- ✅ Soporte para múltiples productos
- ✅ Webhooks al completar el pago
- ✅ Expiración automática de sesiones

### 3. Payment Links
- ✅ Generación de URLs únicas para productos
- ✅ URLs personalizadas opcionales
- ✅ Códigos QR automáticos
- ✅ Botones de pago embebibles
- ✅ Analytics de clicks y conversiones
- ✅ Restricciones configurables

### 4. Dashboard de Gestión
- ✅ Sección de productos con CRUD completo
- ✅ Búsqueda y filtros de productos
- ✅ Generación de payment links desde el dashboard
- ✅ Vista previa de QR codes
- ✅ Estadísticas de productos y conversiones

## Estructura de Archivos

### Base de Datos
```
/supabase/migrations/
  └── 20250115_products_checkout_system.sql   # Migración completa del sistema
```

### API Worker (Cloudflare Worker con Hono)
```
/api-worker/src/
  ├── index.ts                                # Rutas principales actualizadas
  └── routes/
      ├── products.ts                         # API de productos
      ├── checkout.ts                         # API de checkout sessions
      └── payment-links.ts                    # API de payment links
```

### Dashboard (Next.js)
```
/apps/dashboard/
  ├── components/
  │   └── Sidebar.tsx                         # Actualizado con sección de Productos
  └── app/
      ├── [merchantId]/
      │   └── productos/
      │       ├── page.tsx                    # Página principal de productos
      │       ├── ProductosClient.tsx         # Componente cliente principal
      │       ├── CreateProductModal.tsx      # Modal para crear productos
      │       └── CreatePaymentLinkModal.tsx  # Modal para payment links + QR
      └── checkout/
          └── [sessionId]/
              ├── page.tsx                    # Página de checkout hospedada
              └── CheckoutClient.tsx          # Checkout con Elements (placeholder)
```

## Esquema de Base de Datos

### Tablas Principales

#### `products`
```sql
- id (UUID)
- merchant_id (UUID)
- name (TEXT)
- description (TEXT)
- unit_amount (INTEGER) -- Precio en centavos
- currency (TEXT)
- type ('one_time' | 'recurring')
- recurring_interval ('day' | 'week' | 'month' | 'year')
- recurring_interval_count (INTEGER)
- inventory_type ('infinite' | 'finite' | 'bucket')
- inventory_quantity (INTEGER)
- images (JSONB)
- metadata (JSONB)
- active (BOOLEAN)
- slug (TEXT) -- URL-friendly
- created_at, updated_at
```

#### `checkout_sessions`
```sql
- id (UUID)
- merchant_id (UUID)
- mode ('payment' | 'subscription' | 'setup')
- status ('open' | 'complete' | 'expired')
- customer_id (UUID)
- customer_email, customer_name, customer_phone
- success_url, cancel_url
- currency (TEXT)
- amount_total, amount_subtotal, amount_tax (INTEGER)
- payment_intent_id (UUID)
- payment_status ('unpaid' | 'paid' | 'no_payment_required')
- url_key (TEXT) -- Unique URL identifier
- expires_at (TIMESTAMP)
- metadata (JSONB)
- created_at, updated_at, completed_at
```

#### `checkout_line_items`
```sql
- id (UUID)
- checkout_session_id (UUID)
- product_id (UUID) -- Optional
- price_data (JSONB) -- For ad-hoc pricing
- quantity (INTEGER)
- amount_subtotal, amount_total, amount_tax (INTEGER)
- name, description (TEXT)
- images (JSONB)
```

#### `payment_links`
```sql
- id (UUID)
- merchant_id (UUID)
- active (BOOLEAN)
- type ('payment' | 'subscription')
- line_items (JSONB)
- url_key (TEXT) -- Unique identifier
- custom_url (TEXT) -- Optional custom slug
- after_completion_url, after_completion_message
- currency (TEXT)
- qr_code_url (TEXT) -- Generated QR code
- click_count, completed_sessions_count (INTEGER)
- metadata (JSONB)
- created_at, updated_at
```

#### `payment_link_analytics`
```sql
- id (UUID)
- payment_link_id (UUID)
- event_type ('view' | 'click' | 'checkout_started' | 'checkout_completed')
- session_id, checkout_session_id
- ip_address, user_agent, referrer
- utm_source, utm_medium, utm_campaign
- created_at
```

#### `coupons`
```sql
- id (UUID)
- merchant_id (UUID)
- code, name (TEXT)
- discount_type ('percentage' | 'fixed_amount')
- discount_value (INTEGER)
- max_redemptions, times_redeemed (INTEGER)
- valid_from, valid_until (TIMESTAMP)
- active (BOOLEAN)
- metadata (JSONB)
```

## API Endpoints

### Productos

#### POST `/api/v1/products`
Crear un nuevo producto.

**Request:**
```json
{
  "name": "Plan Pro Mensual",
  "description": "Acceso completo a todas las funcionalidades",
  "unit_amount": 99900,
  "currency": "MXN",
  "type": "recurring",
  "recurring_interval": "month",
  "recurring_interval_count": 1,
  "active": true,
  "images": ["https://example.com/image.jpg"],
  "metadata": {
    "features": ["feature1", "feature2"]
  }
}
```

**Response:**
```json
{
  "id": "prod_abc123",
  "merchant_id": "merch_xyz",
  "name": "Plan Pro Mensual",
  "slug": "plan-pro-mensual",
  "unit_amount": 99900,
  "currency": "MXN",
  "type": "recurring",
  "recurring_interval": "month",
  "recurring_interval_count": 1,
  "active": true,
  "created_at": "2025-01-15T00:00:00Z",
  "updated_at": "2025-01-15T00:00:00Z"
}
```

#### GET `/api/v1/products`
Listar productos del merchant.

**Query Parameters:**
- `limit` (default: 10, max: 100)
- `starting_after` (UUID)
- `ending_before` (UUID)
- `active` (boolean)
- `type` ('one_time' | 'recurring')

**Response:**
```json
{
  "object": "list",
  "data": [...],
  "has_more": false,
  "url": "/api/v1/products"
}
```

#### GET `/api/v1/products/:id`
Obtener un producto específico.

#### PATCH `/api/v1/products/:id`
Actualizar un producto.

#### DELETE `/api/v1/products/:id`
Eliminar (soft delete) un producto.

### Checkout Sessions

#### POST `/api/v1/checkout/sessions`
Crear una sesión de checkout.

**Request:**
```json
{
  "mode": "payment",
  "line_items": [
    {
      "product_id": "prod_abc123",
      "quantity": 1
    }
  ],
  "success_url": "https://tusitio.com/success",
  "cancel_url": "https://tusitio.com/cancel",
  "customer_email": "cliente@example.com",
  "currency": "MXN",
  "expires_after_hours": 24,
  "metadata": {
    "order_id": "ORD-123"
  }
}
```

**Response:**
```json
{
  "id": "cs_abc123",
  "url": "https://checkout.deonpay.mx/session/xyz789",
  "url_key": "xyz789",
  "mode": "payment",
  "status": "open",
  "amount_total": 99900,
  "currency": "MXN",
  "expires_at": "2025-01-16T00:00:00Z",
  "line_items": [...],
  "created_at": "2025-01-15T00:00:00Z"
}
```

#### GET `/api/v1/checkout/sessions/:id`
Obtener una sesión de checkout.

**Query Parameters:**
- `expand` (array): ['line_items', 'payment_intent', 'customer']

#### GET `/api/v1/checkout/sessions/by-url/:url_key`
Obtener sesión por URL key (público, sin autenticación).

#### POST `/api/v1/checkout/sessions/:id/complete`
Marcar sesión como completada (llamado internamente después del pago).

**Request:**
```json
{
  "payment_intent_id": "pi_abc123",
  "customer_email": "cliente@example.com",
  "customer_name": "Juan Pérez"
}
```

#### POST `/api/v1/checkout/sessions/:id/expire`
Expirar manualmente una sesión.

### Payment Links

#### POST `/api/v1/payment_links`
Crear un payment link.

**Request:**
```json
{
  "line_items": [
    {
      "product_id": "prod_abc123",
      "quantity": 1
    }
  ],
  "custom_url": "plan-pro",
  "after_completion": {
    "type": "hosted_confirmation",
    "hosted_confirmation": {
      "custom_message": "¡Gracias por tu compra!"
    }
  },
  "phone_number_collection": true,
  "billing_address_collection": "required"
}
```

**Response:**
```json
{
  "id": "plink_abc123",
  "url": "https://pay.deonpay.mx/l/plan-pro",
  "url_key": "xyz789",
  "custom_url": "plan-pro",
  "qr_code_url": "https://chart.googleapis.com/chart?...",
  "active": true,
  "click_count": 0,
  "completed_sessions_count": 0,
  "created_at": "2025-01-15T00:00:00Z"
}
```

#### GET `/api/v1/payment_links`
Listar payment links.

#### GET `/api/v1/payment_links/:id`
Obtener un payment link específico.

#### PATCH `/api/v1/payment_links/:id`
Actualizar un payment link.

#### GET `/api/v1/payment_links/by-url/:url_key`
Obtener payment link por URL (público).

#### POST `/api/v1/payment_links/:id/create-session`
Crear checkout session desde un payment link (público).

**Request:**
```json
{
  "customer_email": "cliente@example.com",
  "quantities": {
    "prod_abc123": 2
  },
  "locale": "es"
}
```

## Flujo de Pago Completo

### 1. Crear Producto
```bash
curl -X POST https://api.deonpay.mx/api/v1/products \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Plan Pro",
    "unit_amount": 99900,
    "currency": "MXN",
    "type": "recurring",
    "recurring_interval": "month",
    "recurring_interval_count": 1
  }'
```

### 2. Crear Payment Link
```bash
curl -X POST https://api.deonpay.mx/api/v1/payment_links \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "line_items": [{"product_id": "prod_abc123", "quantity": 1}],
    "custom_url": "plan-pro"
  }'
```

### 3. Cliente Abre el Link
El cliente visita: `https://pay.deonpay.mx/l/plan-pro`

### 4. Se Crea Checkout Session
Automáticamente o vía API:
```javascript
// Frontend del payment link
const response = await fetch(`/api/v1/payment_links/${linkId}/create-session`, {
  method: 'POST',
  body: JSON.stringify({
    customer_email: 'cliente@example.com'
  })
})

const session = await response.json()
// Redirige a: session.url
```

### 5. Cliente Completa el Pago
En la página de checkout (`/checkout/[sessionId]`):

1. Cliente ingresa información de tarjeta (DeonPay Elements)
2. Se crea Payment Intent
3. Se confirma el pago
4. Se completa la checkout session
5. Se disparan webhooks
6. Se muestra página de confirmación

### 6. Webhook al Merchant
```json
{
  "type": "checkout.session.completed",
  "data": {
    "id": "cs_abc123",
    "payment_intent_id": "pi_xyz789",
    "amount_total": 99900,
    "customer_email": "cliente@example.com",
    "metadata": {...}
  }
}
```

## Configuración e Instalación

### 1. Ejecutar Migración de Base de Datos

Conéctate a tu instancia de Supabase y ejecuta:

```bash
psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/20250115_products_checkout_system.sql
```

O desde el dashboard de Supabase:
1. Ve a SQL Editor
2. Copia el contenido de `20250115_products_checkout_system.sql`
3. Ejecuta el script

### 2. Configurar Variables de Entorno

En tu Cloudflare Worker (`wrangler.toml`), agrega:

```toml
[vars]
CHECKOUT_BASE_URL = "https://checkout.deonpay.mx"
PAYMENT_LINK_BASE_URL = "https://pay.deonpay.mx"
```

### 3. Desplegar API Worker

```bash
cd api-worker
npm install
npm run deploy
```

### 4. Desplegar Dashboard

```bash
cd apps/dashboard
npm install
npm run build
npm run deploy
```

### 5. Configurar DNS

Configura los siguientes subdominios:

- `checkout.deonpay.mx` → Dashboard app (ruta `/checkout/*`)
- `pay.deonpay.mx` → Dashboard app (ruta `/pay/*` o payment links handler)

## Seguridad

### Row Level Security (RLS)

Todas las tablas tienen políticas RLS habilitadas:

1. **Products**: Solo merchants con permisos pueden ver/editar sus productos
2. **Checkout Sessions**: Merchants ven solo sus sesiones; público accede por URL
3. **Payment Links**: Merchants gestionan sus links; público accede a links activos
4. **Analytics**: Solo merchants ven sus analytics; público puede insertar eventos

### API Key Validation

Todos los endpoints (excepto públicos) requieren autenticación:

```
Authorization: Bearer sk_test_abc123...
```

### Rate Limiting

Implementado via middleware en el worker:
- 60 requests/minuto por merchant+ruta

### Validaciones

- UUID format validation
- Input sanitization
- Zod schema validation
- Business logic validation (inventory, recurring settings, etc.)

## Analytics y Tracking

### Events Tracked

1. **view**: Cuando alguien ve un payment link
2. **click**: Cuando se hace click en "comprar"
3. **checkout_started**: Cuando se crea una checkout session
4. **checkout_completed**: Cuando se completa un pago

### Información Capturada

- IP address (anonimizada)
- User agent
- Referrer
- UTM parameters
- Device type, browser, OS
- Geolocation (país, ciudad)

### Consultar Analytics

```sql
SELECT
  event_type,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as day
FROM payment_link_analytics
WHERE payment_link_id = 'plink_abc123'
GROUP BY event_type, day
ORDER BY day DESC;
```

## Webhooks

Los siguientes eventos se disparan automáticamente:

### checkout.session.created
Cuando se crea una nueva sesión de checkout.

### checkout.session.completed
Cuando se completa un pago exitosamente.

### payment_link.created
Cuando se crea un nuevo payment link.

## Próximos Pasos y Mejoras

### Funcionalidades Pendientes

1. **Integración Real con DeonPay Elements**
   - Montar componente de tarjeta en checkout
   - Manejar tokenización
   - Confirmar pagos

2. **Coupons/Promociones**
   - Aplicar descuentos en checkout
   - Validar códigos promocionales
   - Tracking de uso

3. **Suscripciones Recurrentes**
   - Billing automático
   - Gestión de ciclos de facturación
   - Cancelaciones y actualizaciones

4. **Shipping**
   - Cálculo de envío
   - Múltiples opciones de envío
   - Tracking de envíos

5. **Tax Calculation**
   - Integración con servicios de impuestos
   - Cálculo automático por región
   - Validación de tax IDs

6. **Customer Portal**
   - Gestión de suscripciones
   - Historial de pagos
   - Actualización de métodos de pago

7. **Advanced Analytics**
   - Dashboard de conversiones
   - Análisis de abandono
   - A/B testing de checkout

8. **Multi-currency**
   - Conversión automática
   - Precios en múltiples monedas
   - FX rate management

### Optimizaciones

1. **Caching**
   - Cache de productos populares
   - CDN para imágenes
   - Redis para sessions

2. **Performance**
   - Lazy loading de productos
   - Optimización de queries
   - Índices adicionales

3. **UX Improvements**
   - Preview de checkout antes de publicar
   - Templates de payment links
   - Bulk operations

## Soporte

Para preguntas o issues:
- Email: dev@deonpay.mx
- Documentación: https://docs.deonpay.mx
- GitHub Issues: https://github.com/deonpay/deonpay-master/issues

## Licencia

Propietario - DeonPay © 2025
