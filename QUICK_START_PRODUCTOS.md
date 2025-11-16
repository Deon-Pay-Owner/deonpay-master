# Quick Start: Sistema de Productos y Checkout

Esta guía rápida te ayudará a implementar el sistema de productos y checkout de DeonPay en minutos.

## Paso 1: Ejecutar Migración de Base de Datos

### Opción A: Desde Supabase Dashboard

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido de `supabase/migrations/20250115_products_checkout_system.sql`
5. Ejecuta el script (Run)

### Opción B: Desde CLI

```bash
supabase db push
```

## Paso 2: Verificar las Tablas

Verifica que las siguientes tablas se hayan creado:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'products',
  'checkout_sessions',
  'checkout_line_items',
  'payment_links',
  'payment_link_analytics',
  'coupons'
);
```

Deberías ver 6 tablas.

## Paso 3: Crear tu Primer Producto

### Desde el Dashboard

1. Navega a `https://dashboard.deonpay.mx/{merchantId}/productos`
2. Click en "Nuevo Producto"
3. Llena el formulario:
   - Nombre: "Plan Básico"
   - Precio: 499.00
   - Moneda: MXN
   - Tipo: Pago único
4. Click en "Crear Producto"

### Desde la API

```bash
curl -X POST https://api.deonpay.mx/api/v1/products \
  -H "Authorization: Bearer sk_test_YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Plan Básico",
    "description": "Perfecto para empezar",
    "unit_amount": 49900,
    "currency": "MXN",
    "type": "one_time",
    "active": true
  }'
```

## Paso 4: Crear un Payment Link

### Desde el Dashboard

1. En la página de productos, encuentra tu producto
2. Click en "Crear Link"
3. Configura el payment link:
   - URL personalizada (opcional): "plan-basico"
   - Después del pago: "Mostrar confirmación de DeonPay"
   - Mensaje personalizado: "¡Gracias por tu compra!"
4. Click en "Crear Payment Link"
5. Copia la URL y el código QR

### Desde la API

```bash
curl -X POST https://api.deonpay.mx/api/v1/payment_links \
  -H "Authorization: Bearer sk_test_YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "line_items": [
      {
        "product_id": "PRODUCT_ID_FROM_STEP_3",
        "quantity": 1
      }
    ],
    "custom_url": "plan-basico",
    "after_completion": {
      "type": "hosted_confirmation",
      "hosted_confirmation": {
        "custom_message": "¡Gracias por tu compra!"
      }
    }
  }'
```

## Paso 5: Compartir el Payment Link

Ahora puedes compartir tu payment link:

- **URL**: `https://pay.deonpay.mx/l/plan-basico`
- **QR Code**: Descarga desde el dashboard o usa el `qr_code_url` de la respuesta

### Embeber en tu Sitio Web

```html
<!-- Opción 1: Link simple -->
<a href="https://pay.deonpay.mx/l/plan-basico" class="buy-button">
  Comprar Plan Básico
</a>

<!-- Opción 2: Botón estilizado -->
<a href="https://pay.deonpay.mx/l/plan-basico"
   style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
  Comprar ahora - $499 MXN
</a>

<!-- Opción 3: Con QR Code -->
<div class="payment-options">
  <a href="https://pay.deonpay.mx/l/plan-basico" class="buy-button">
    Comprar Plan Básico
  </a>
  <p>O escanea el código QR:</p>
  <img src="QR_CODE_URL" alt="Código QR" width="200">
</div>
```

## Paso 6: Crear Checkout Programático (Opcional)

Si prefieres crear checkout sessions programáticamente:

```javascript
// En tu backend
const response = await fetch('https://api.deonpay.mx/api/v1/checkout/sessions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_YOUR_SECRET_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'payment',
    line_items: [
      {
        product_id: 'prod_abc123',
        quantity: 1,
      },
    ],
    success_url: 'https://tusitio.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://tusitio.com/cancel',
    customer_email: 'cliente@example.com',
    metadata: {
      order_id: 'ORD-12345',
    },
  }),
})

const session = await response.json()

// Redirige al cliente a session.url
window.location.href = session.url
```

## Paso 7: Configurar Webhooks (Recomendado)

Para recibir notificaciones cuando se complete un pago:

1. Ve a `https://dashboard.deonpay.mx/{merchantId}/webhooks`
2. Click en "Crear Webhook"
3. Configura:
   - URL: `https://tusitio.com/webhooks/deonpay`
   - Eventos: `checkout.session.completed`
4. Guarda el webhook secret

### Manejar Webhooks en tu Backend

```javascript
// Node.js/Express example
app.post('/webhooks/deonpay', async (req, res) => {
  const signature = req.headers['deonpay-signature']
  const event = req.body

  // Verifica la firma (ver documentación de webhooks)

  if (event.type === 'checkout.session.completed') {
    const session = event.data

    // Cumple el pedido
    await fulfillOrder(session.id, session.customer_email, session.metadata)

    console.log('Pago completado:', session.id)
  }

  res.json({ received: true })
})
```

## Casos de Uso Comunes

### Producto con Precio Variable

Para productos donde el cliente puede ingresar la cantidad:

```javascript
// Crear producto
const product = await createProduct({
  name: "Donación",
  description: "Apoya nuestro proyecto",
  unit_amount: 10000, // Precio base: $100
  currency: "MXN",
  type: "one_time",
})

// Crear payment link con cantidad ajustable
const paymentLink = await createPaymentLink({
  line_items: [{
    product_id: product.id,
    quantity: 1,
    adjustable_quantity: {
      enabled: true,
      minimum: 1,
      maximum: 100,
    },
  }],
})
```

### Suscripción Mensual

```javascript
const subscription = await createProduct({
  name: "Plan Pro",
  description: "Acceso completo mensual",
  unit_amount: 99900, // $999/mes
  currency: "MXN",
  type: "recurring",
  recurring_interval: "month",
  recurring_interval_count: 1,
})
```

### Checkout con Múltiples Productos

```javascript
const session = await createCheckoutSession({
  mode: 'payment',
  line_items: [
    { product_id: 'prod_1', quantity: 2 },
    { product_id: 'prod_2', quantity: 1 },
    {
      // Producto ad-hoc (sin crear producto en DB)
      price_data: {
        unit_amount: 5000,
        currency: 'MXN',
        product_data: {
          name: 'Envío Express',
          description: 'Entrega en 24 horas',
        },
      },
      quantity: 1,
    },
  ],
  success_url: 'https://tusitio.com/success',
  cancel_url: 'https://tusitio.com/cancel',
})
```

### Aplicar Cupón de Descuento

```javascript
// Primero crea el cupón
const coupon = await createCoupon({
  code: 'VERANO2025',
  name: 'Descuento de Verano',
  discount_type: 'percentage',
  discount_value: 20, // 20%
  max_redemptions: 100,
  valid_until: '2025-08-31T23:59:59Z',
})

// Luego aplícalo al checkout
const session = await createCheckoutSession({
  mode: 'payment',
  line_items: [{ product_id: 'prod_1', quantity: 1 }],
  discounts: [{ coupon: 'VERANO2025' }],
  allow_promotion_codes: true,
  success_url: 'https://tusitio.com/success',
  cancel_url: 'https://tusitio.com/cancel',
})
```

## Testing

### Modo de Prueba

Usa las API keys de test:
- `sk_test_...` - Secret Key
- `pk_test_...` - Public Key

### Tarjetas de Prueba

(Pendiente de integración con procesadores)

Visa: `4242 4242 4242 4242`
Mastercard: `5555 5555 5555 4444`
Amex: `3782 822463 10005`

Cualquier CVV y fecha futura funcionará.

### Webhook Testing

Usa [ngrok](https://ngrok.com) para probar webhooks localmente:

```bash
ngrok http 3000
# Usa la URL de ngrok en la configuración del webhook
```

## Monitoreo

### Ver Analytics de Payment Links

```sql
-- Conversión rate
SELECT
  pl.id,
  pl.custom_url,
  pl.click_count,
  pl.completed_sessions_count,
  CASE
    WHEN pl.click_count > 0
    THEN (pl.completed_sessions_count::float / pl.click_count * 100)
    ELSE 0
  END as conversion_rate
FROM payment_links pl
WHERE pl.merchant_id = 'YOUR_MERCHANT_ID'
ORDER BY pl.completed_sessions_count DESC;
```

### Ver Productos Más Vendidos

```sql
SELECT
  p.name,
  COUNT(cli.id) as times_sold,
  SUM(cli.quantity) as units_sold,
  SUM(cli.amount_total) as total_revenue
FROM products p
JOIN checkout_line_items cli ON cli.product_id = p.id
JOIN checkout_sessions cs ON cs.id = cli.checkout_session_id
WHERE cs.status = 'complete'
  AND p.merchant_id = 'YOUR_MERCHANT_ID'
GROUP BY p.id, p.name
ORDER BY total_revenue DESC
LIMIT 10;
```

## Solución de Problemas

### Error: "Product not found"

Verifica que:
1. El producto existe en la base de datos
2. El producto está activo (`active = true`)
3. El product_id es correcto
4. Estás usando la API key del merchant correcto

### Error: "Checkout session expired"

Las sesiones expiran después de 24 horas por defecto. Crea una nueva sesión.

### Payment Link No Funciona

1. Verifica que el link está activo
2. Revisa que el producto asociado está activo
3. Comprueba la URL (custom_url vs url_key)

### Webhooks No se Reciben

1. Verifica la URL del webhook
2. Asegúrate de que tu servidor responde 200 OK
3. Revisa los logs en el dashboard de webhooks
4. Verifica la firma del webhook

## Próximos Pasos

1. **Personaliza el Checkout**
   - Agrega tu logo
   - Personaliza colores
   - Agrega custom fields

2. **Implementa Webhooks**
   - Cumple pedidos automáticamente
   - Envía emails de confirmación
   - Actualiza tu base de datos

3. **Analiza el Rendimiento**
   - Revisa las conversiones
   - Optimiza los precios
   - A/B test diferentes payment links

4. **Expande la Funcionalidad**
   - Agrega más productos
   - Crea bundles
   - Implementa suscripciones

## Recursos Adicionales

- [Documentación Completa](./PRODUCTOS_CHECKOUT_IMPLEMENTATION.md)
- [API Reference](https://docs.deonpay.mx/api)
- [Ejemplos de Código](https://github.com/deonpay/examples)
- [Community Forum](https://community.deonpay.mx)

## Soporte

¿Necesitas ayuda?
- Email: support@deonpay.mx
- Chat: dashboard.deonpay.mx (esquina inferior derecha)
- Discord: [DeonPay Community](https://discord.gg/deonpay)

---

¡Felicidades! Ya tienes un sistema completo de productos y checkout funcionando. 🎉
