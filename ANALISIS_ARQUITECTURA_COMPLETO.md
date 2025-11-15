# 🔍 Análisis Completo de DeonPay - Arquitectura y Endpoints

## Resumen Ejecutivo

DeonPay consta de dos proyectos principales:
1. **DeonPay Master** - El backend principal con API Worker (Cloudflare), Dashboard y Landing
2. **DeonPay Elements** - SDK de pagos tipo Stripe Elements con playground de pruebas

**Problema Principal Identificado**: Existe una duplicación de endpoints entre el playground de Elements (endpoints mock) y el API Worker real. El SDK de Elements está configurado para llamar a endpoints que no coinciden con las rutas del API Worker.

## 1. Inventario de Endpoints

### DeonPay Master - API Worker (Cloudflare Worker en api.deonpay.mx)

| Ruta | Método | Propósito | Estado | Parámetros | Respuesta |
|------|--------|-----------|--------|------------|-----------|
| `/` | GET | Health check | ✅ Funcional | - | `{service, version, status, environment}` |
| **Payment Intents** |
| `/api/v1/payment_intents` | POST | Crear payment intent | ✅ Funcional | `{amount, currency, description, metadata}` | Payment Intent object |
| `/api/v1/payment_intents/:id` | GET | Obtener payment intent | ✅ Funcional | - | Payment Intent object |
| `/api/v1/payment_intents` | GET | Listar payment intents | ✅ Funcional | Query params: limit, starting_after | Payment Intent list |
| `/api/v1/payment_intents/:id` | PATCH | Actualizar payment intent | ✅ Funcional | `{amount?, description?, metadata?}` | Updated Payment Intent |
| `/api/v1/payment_intents/:id/confirm` | POST | Confirmar payment intent | ✅ Funcional | `{payment_method, return_url?}` | Confirmed Payment Intent |
| `/api/v1/payment_intents/:id/capture` | POST | Capturar payment intent | ✅ Funcional | `{amount_to_capture?}` | Captured Payment Intent |
| `/api/v1/payment_intents/:id/cancel` | POST | Cancelar payment intent | ✅ Funcional | `{cancellation_reason?}` | Cancelled Payment Intent |
| **Customers** |
| `/api/v1/customers` | POST | Crear customer | ✅ Funcional | `{email, name, phone?, metadata?}` | Customer object |
| `/api/v1/customers/:id` | GET | Obtener customer | ✅ Funcional | - | Customer object |
| `/api/v1/customers` | GET | Listar customers | ✅ Funcional | Query params: limit, starting_after | Customer list |
| `/api/v1/customers/:id` | PATCH | Actualizar customer | ✅ Funcional | `{email?, name?, phone?, metadata?}` | Updated Customer |
| `/api/v1/customers/:id` | DELETE | Eliminar customer | ✅ Funcional | - | Deleted Customer |
| **Refunds** |
| `/api/v1/refunds` | POST | Crear refund | ✅ Funcional | `{charge, amount?, reason?, metadata?}` | Refund object |
| `/api/v1/refunds/:id` | GET | Obtener refund | ✅ Funcional | - | Refund object |
| `/api/v1/refunds` | GET | Listar refunds | ✅ Funcional | Query params: limit, starting_after | Refund list |
| **Balance** |
| `/api/v1/balance/transactions/:id` | GET | Obtener transacción | ✅ Funcional | - | Transaction object |
| `/api/v1/balance/transactions` | GET | Listar transacciones | ✅ Funcional | Query params: limit, starting_after | Transaction list |
| `/api/v1/balance/summary` | GET | Resumen de balance | ✅ Funcional | - | Balance summary |
| **Elements/Tokens** |
| `/api/v1/elements/tokens` | POST | Tokenizar tarjeta | ✅ Funcional | `{card: {number, exp_month, exp_year, cvv}, billing_details?}` | `{token: {id, card}}` |

### DeonPay Master - Dashboard (Next.js App)

| Ruta | Método | Propósito | Estado |
|------|--------|-----------|--------|
| `/api/account` | GET/PATCH | Gestión de cuenta | ✅ Funcional |
| `/api/account/change-password` | POST | Cambiar contraseña | ✅ Funcional |
| `/api/account/delete` | DELETE | Eliminar cuenta | ✅ Funcional |
| `/api/keys` | GET | Listar API keys | ✅ Funcional |
| `/api/keys/generate` | POST | Generar nueva API key | ✅ Funcional |
| `/api/keys/revoke` | POST | Revocar API key | ✅ Funcional |
| `/api/webhooks` | GET/POST | Gestión de webhooks | ✅ Funcional |
| `/api/webhooks/:id` | PATCH/DELETE | Actualizar/eliminar webhook | ✅ Funcional |
| `/api/webhooks/:id/test` | POST | Probar webhook | ✅ Funcional |

### DeonPay Master - Landing (Next.js App)

| Ruta | Método | Propósito | Estado |
|------|--------|-----------|--------|
| `/api/signup` | POST | Registro de usuarios | ✅ Funcional |
| `/api/login` | POST | Inicio de sesión | ✅ Funcional |
| `/api/forgot-password` | POST | Recuperar contraseña | ✅ Funcional |
| `/api/reset-password` | POST | Restablecer contraseña | ✅ Funcional |
| `/api/test` | GET | Endpoint de prueba | ✅ Funcional |

### DeonPay Master - Hub (Next.js App)

| Ruta | Método | Propósito | Estado |
|------|--------|-----------|--------|
| `/api/auth/login` | POST | Login hub | ✅ Funcional |
| `/api/auth/logout` | POST | Logout hub | ✅ Funcional |

### DeonPay Elements - Playground (Next.js App) - ENDPOINTS MOCK

| Ruta | Método | Propósito | Estado | Problema |
|------|--------|-----------|--------|----------|
| `/api/elements/tokens` | POST | Tokenizar tarjeta (MOCK) | ⚠️ Mock | Duplicado con API Worker |
| `/api/payment-intents` | POST | Crear payment intent (MOCK) | ⚠️ Mock | Duplicado con API Worker |
| `/api/payment-intents/:id/confirm` | POST | Confirmar payment (MOCK) | ⚠️ Mock | Duplicado con API Worker |

### SDK de Elements - Endpoints Esperados

El SDK (`packages/sdk/src`) espera las siguientes rutas:

| Endpoint Esperado | Configuración Actual | Problema |
|-------------------|---------------------|----------|
| `${apiUrl}/api/elements/tokens` | Default: `https://api.deonpay.mx/api/elements/tokens` | ❌ Ruta incorrecta - debería ser `/api/v1/elements/tokens` |
| `${apiUrl}/api/payment-intents/${id}/confirm` | Default: `https://api.deonpay.mx/api/payment-intents/${id}/confirm` | ❌ Ruta incorrecta - debería ser `/api/v1/payment_intents/${id}/confirm` |

## 2. Problemas Identificados

### 🔴 Duplicaciones Críticas

1. **Tokenización de Tarjetas**
   - **Playground**: `/api/elements/tokens` (MOCK en memoria)
   - **API Worker**: `/api/v1/elements/tokens` (Real con KV/DB)
   - **Problema**: El playground usa su propia implementación mock en lugar del API real

2. **Payment Intents**
   - **Playground**: `/api/payment-intents` y `/api/payment-intents/:id/confirm` (MOCK)
   - **API Worker**: `/api/v1/payment_intents` y `/api/v1/payment_intents/:id/confirm` (Real)
   - **Problema**: Rutas y formatos diferentes

### 🟡 Inconsistencias de Rutas

1. **Versioning**: API Worker usa `/api/v1/` pero SDK espera `/api/`
2. **Naming Convention**:
   - API Worker usa `payment_intents` (snake_case)
   - SDK/Playground usa `payment-intents` (kebab-case)
3. **Base URL**: SDK por defecto apunta a `https://api.deonpay.mx` pero necesita configuración correcta

### 🔴 Endpoints Faltantes

No hay endpoints faltantes, pero las rutas están mal configuradas en el SDK.

### ⚠️ Endpoints Mock vs Real

Todos los endpoints del playground son mock y deberían usar el API Worker real:
- `/api/elements/tokens` → debe llamar a API Worker
- `/api/payment-intents` → debe llamar a API Worker
- `/api/payment-intents/:id/confirm` → debe llamar a API Worker

## 3. Arquitectura Actual vs Recomendada

### Arquitectura Actual (Problemática)

```
┌─────────────────┐         ┌──────────────────┐
│  DeonPay        │         │   DeonPay        │
│  Elements SDK   │────────►│   Playground     │
│                 │ Llama a  │   (Mock APIs)    │
└─────────────────┘         └──────────────────┘
                                     │
                                     │ NO SE CONECTA
                                     ▼
┌─────────────────────────────────────────────┐
│         DeonPay API Worker                  │
│         (api.deonpay.mx)                    │
│         APIs Reales con Multi-Acquirer      │
└─────────────────────────────────────────────┘
```

**Problemas**:
- Elements SDK llama a endpoints mock del playground
- No hay conexión real con el API Worker
- Duplicación de lógica entre playground y API Worker
- Rutas incompatibles entre SDK y API Worker

### Arquitectura Recomendada

```
┌─────────────────┐         ┌──────────────────┐
│  DeonPay        │         │   DeonPay        │
│  Elements SDK   │────────►│   API Worker     │
│                 │ Llama a  │  (api.deonpay.mx)│
└─────────────────┘         │   APIs Reales    │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   Multi-Acquirer │
                            │   (CyberSource,  │
                            │    Adyen, etc)   │
                            └─────────────────┘

┌──────────────────┐
│   Playground     │────► Solo para demos y testing
│   (Sin APIs)     │      usa SDK configurado con
└──────────────────┘      API Worker real
```

## 4. Plan de Implementación

### Fase 1: Limpieza y Preparación

1. **Eliminar endpoints mock del playground**
   ```bash
   # Eliminar estos archivos:
   rm -rf apps/playground/app/api/elements
   rm -rf apps/playground/app/api/payment-intents
   ```

2. **Actualizar configuración del SDK**
   - Modificar `packages/sdk/src/DeonPay.ts`:
     - Cambiar ruta default de `/api/elements/tokens` a `/api/v1/elements/tokens`
     - Cambiar ruta de `/api/payment-intents/` a `/api/v1/payment_intents/`

### Fase 2: Unificación de Rutas

1. **Opción A: Actualizar SDK para usar rutas v1** (RECOMENDADO)
   ```typescript
   // En packages/sdk/src/tokenization/api.ts
   const url = `${this.apiUrl}/api/v1/elements/tokens`

   // En packages/sdk/src/DeonPay.ts
   const url = `${this.config.apiUrl}/api/v1/payment_intents/${paymentIntentId}/confirm`
   ```

2. **Opción B: Agregar alias en API Worker** (Alternativa)
   ```typescript
   // En api-worker/src/index.ts
   // Agregar alias para compatibilidad
   app.route('/api/elements/tokens', elementsTokensRouter)
   app.route('/api/payment-intents', paymentIntentsRouter)
   ```

### Fase 3: Integración Elements con API Real

1. **Configurar playground para usar API real**
   ```typescript
   // En apps/playground/app/page.tsx
   const deonpay = new DeonPay('pk_test_xxxxx', {
     apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.deonpay.mx'
   })
   ```

2. **Agregar CORS adecuado en API Worker**
   - Ya está configurado para permitir todos los orígenes
   - En producción, restringir a dominios específicos

3. **Configurar autenticación**
   - Asegurar que playground use API keys válidas
   - Crear API keys de prueba específicas para playground

### Fase 4: Testing y Validación

1. **Tests de integración**
   ```bash
   # Desde playground
   npm run test:integration
   ```

2. **Validar flujo completo**
   - Crear payment intent desde playground
   - Tokenizar tarjeta
   - Confirmar pago
   - Verificar en dashboard

3. **Monitoreo**
   - Revisar logs en Cloudflare Workers
   - Verificar métricas de API
   - Validar webhooks

## 5. Endpoints API - Especificación Completa

### Tokenización de Tarjetas

**Endpoint**: `POST /api/v1/elements/tokens`

**Headers**:
```
Authorization: Bearer pk_test_xxxxx
Content-Type: application/json
```

**Body**:
```json
{
  "card": {
    "number": "4111111111111111",
    "exp_month": 12,
    "exp_year": 2025,
    "cvv": "123"
  },
  "billing_details": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Respuesta exitosa** (201):
```json
{
  "token": {
    "id": "tok_xxxxxxxxxxxxxxxx",
    "card": {
      "brand": "visa",
      "last4": "1111",
      "exp_month": 12,
      "exp_year": 2025
    }
  }
}
```

**Ejemplo curl**:
```bash
curl -X POST https://api.deonpay.mx/api/v1/elements/tokens \
  -H "Authorization: Bearer pk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "card": {
      "number": "4111111111111111",
      "exp_month": 12,
      "exp_year": 2025,
      "cvv": "123"
    }
  }'
```

### Crear Payment Intent

**Endpoint**: `POST /api/v1/payment_intents`

**Headers**:
```
Authorization: Bearer sk_test_xxxxx
Content-Type: application/json
Idempotency-Key: unique_key_123
```

**Body**:
```json
{
  "amount": 10000,
  "currency": "MXN",
  "description": "Orden #123",
  "metadata": {
    "order_id": "123"
  }
}
```

**Respuesta exitosa** (201):
```json
{
  "id": "pi_xxxxxxxxxxxxxxxx",
  "client_secret": "pi_xxxxxxxxxxxxxxxx_secret_yyyyyyyy",
  "amount": 10000,
  "currency": "MXN",
  "status": "requires_payment_method",
  "description": "Orden #123",
  "metadata": {
    "order_id": "123"
  },
  "created": 1699920000
}
```

### Confirmar Payment Intent

**Endpoint**: `POST /api/v1/payment_intents/{id}/confirm`

**Headers**:
```
Authorization: Bearer sk_test_xxxxx
Content-Type: application/json
```

**Body**:
```json
{
  "payment_method": "tok_xxxxxxxxxxxxxxxx",
  "return_url": "https://example.com/success"
}
```

**Respuesta exitosa** (200):
```json
{
  "id": "pi_xxxxxxxxxxxxxxxx",
  "status": "succeeded",
  "charges": [{
    "id": "ch_xxxxxxxxxxxxxxxx",
    "amount": 10000,
    "status": "succeeded"
  }]
}
```

## 6. Configuración de Entorno Recomendada

### Para DeonPay Elements (playground)

```env
# .env.local
NEXT_PUBLIC_DEONPAY_PUBLIC_KEY=pk_test_xxxxx
NEXT_PUBLIC_API_URL=https://api.deonpay.mx
```

### Para DeonPay API Worker

```env
# .dev.vars
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
ENVIRONMENT=development
DEFAULT_ADAPTER=cybersource
```

## 7. Siguientes Pasos Inmediatos

1. **Actualizar SDK** para usar rutas `/api/v1/` correctas
2. **Eliminar endpoints mock** del playground
3. **Configurar playground** con API key real de prueba
4. **Probar flujo completo** de pago con API real
5. **Documentar** la nueva arquitectura para el equipo

## 8. Recomendaciones Adicionales

1. **Versionado de API**: Mantener `/api/v1/` para permitir futuras versiones
2. **Rate Limiting**: Implementar rate limiting diferenciado para playground
3. **Logging**: Agregar logging detallado para debug en desarrollo
4. **Monitoreo**: Configurar alertas para errores de integración
5. **Documentación**: Crear OpenAPI/Swagger spec para la API
6. **Testing**: Implementar suite de tests E2E para validar integración

## Conclusión

El principal problema es la desconexión entre DeonPay Elements y el API Worker real. Los endpoints mock en el playground deben eliminarse y el SDK debe configurarse para usar las rutas correctas del API Worker (`/api/v1/`). Con estos cambios, Elements podrá funcionar correctamente con el backend de producción.