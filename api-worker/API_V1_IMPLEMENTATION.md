# DeonPay API v1 - Implementación Completa

## ✅ Lo que YA está implementado

### Utilidades Base (src/lib/)
1. **errors.ts** ✅ - Error helpers canónicos con todos los tipos
2. **requestId.ts** ✅ - Generación de request IDs (req_xxx)
3. **hashing.ts** ✅ - SHA-256 hashing para idempotency
4. **rateLimitStore.ts** ✅ - Store híbrido KV/DB para rate limiting
5. **idempotencyStore.ts** ✅ - Store híbrido KV/DB para idempotency

### Middlewares Existentes (ya en index.ts)
- ✅ CORS
- ✅ Logger
- ✅ Supabase client
- ✅ API Key Auth (valida y adjunta merchant_id)

### Rutas Básicas (src/routes/)
- ✅ payment-intents.ts
- ✅ customers.ts
- ✅ refunds.ts
- ✅ balance.ts

## ⏳ Lo que FALTA implementar

### 1. Middlewares Adicionales (src/middleware/)

#### requestId.ts
```typescript
import { generateRequestId } from '../lib/requestId'
import type { MiddlewareHandler } from 'hono'

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || generateRequestId()
  c.set('requestId', requestId)
  await next()
  c.header('X-Request-ID', requestId)
}
```

#### rateLimit.ts
```typescript
import { RateLimitStore } from '../lib/rateLimitStore'
import { errorResponse, rateLimitedError } from '../lib/errors'
import type { MiddlewareHandler } from 'hono'

export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const merchantId = c.get('merchantId')
  const routeKey = `${c.req.method}:${c.req.path}`

  const store = new RateLimitStore(c.get('supabase'), c.env.RATE_LIMIT_KV)
  const result = await store.checkAndIncrement(merchantId, routeKey, {
    maxRequests: parseInt(c.env.RATE_LIMIT_MAX || '60'),
    windowMs: parseInt(c.env.RATE_LIMIT_WINDOW_MS || '60000')
  })

  c.header('X-RateLimit-Limit', result.maxRequests?.toString() || '60')
  c.header('X-RateLimit-Remaining', result.remaining.toString())
  c.header('X-RateLimit-Reset', result.resetAt.toString())

  if (!result.allowed) {
    return errorResponse(c, rateLimitedError(), 429)
  }

  await next()
}
```

#### idempotency.ts
```typescript
import { IdempotencyStore } from '../lib/idempotencyStore'
import { computeBodyHash } from '../lib/hashing'
import { errorResponse, idempotencyConflictError } from '../lib/errors'
import type { MiddlewareHandler } from 'hono'

export const idempotencyMiddleware: MiddlewareHandler = async (c, next) => {
  // Solo para métodos mutadores
  if (c.req.method !== 'POST' && c.req.method !== 'PATCH') {
    return await next()
  }

  const idempotencyKey = c.req.header('Idempotency-Key')
  if (!idempotencyKey) {
    console.warn(`[${c.get('requestId')}] No idempotency key provided`)
    return await next()
  }

  const merchantId = c.get('merchantId')
  const endpoint = c.req.path
  const body = await c.req.json()
  const bodyHash = await computeBodyHash(body)

  const store = new IdempotencyStore(c.get('supabase'), c.env.IDEMPOTENCY_KV)
  const existing = await store.get(merchantId, endpoint, idempotencyKey)

  if (existing) {
    // Ya existe un registro
    if (existing.body_hash !== bodyHash) {
      // Body diferente con misma key = conflicto
      return errorResponse(c, idempotencyConflictError(), 409)
    }

    // Devolver respuesta cacheada
    c.header('Idempotency-Replayed', 'true')
    Object.entries(existing.headers).forEach(([k, v]) => {
      if (!k.toLowerCase().startsWith('set-cookie')) {
        c.header(k, v)
      }
    })
    return c.json(existing.response, existing.status)
  }

  // Procesar normalmente
  await next()

  // Guardar resultado
  try {
    const responseClone = c.res.clone()
    const responseBody = await responseClone.json()

    await store.set({
      merchant_id: merchantId,
      endpoint,
      idempotency_key: idempotencyKey,
      body_hash: bodyHash,
      status: c.res.status,
      response: responseBody,
      headers: Object.fromEntries(
        Array.from(c.res.headers.entries()).filter(([k]) =>
          !k.toLowerCase().startsWith('set-cookie')
        )
      )
    })
  } catch (err) {
    console.error(`[${c.get('requestId')}] Failed to store idempotency record:`, err)
  }
}
```

#### requestLog.ts
```typescript
import type { MiddlewareHandler } from 'hono'

export const requestLogMiddleware: MiddlewareHandler = async (c, next) => {
  const startTime = Date.now()
  const requestId = c.get('requestId')
  const merchantId = c.get('merchantId')

  await next()

  const duration = Date.now() - startTime
  const supabase = c.get('supabase')

  // Fire and forget - no esperar
  supabase.from('session_logs').insert({
    request_id: requestId,
    merchant_id: merchantId,
    route: c.req.path,
    method: c.req.method,
    status: c.res.status,
    duration_ms: duration,
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    user_agent: c.req.header('User-Agent'),
    idempotency_key: c.req.header('Idempotency-Key'),
  }).then()
}
```

### 2. Actualizar index.ts

Agregar imports y aplicar middlewares en el orden correcto:

```typescript
import { requestIdMiddleware } from './middleware/requestId'
import { rateLimitMiddleware } from './middleware/rateLimit'
import { idempotencyMiddleware } from './middleware/idempotency'
import { requestLogMiddleware } from './middleware/requestLog'

// ... después de CORS y logger ...

// Request ID (ANTES de todo)
app.use('*', requestIdMiddleware)

// Supabase client (ya existe)
app.use('*', async (c, next) => { ... })

// API Key auth (ya existe, solo para /api/v1/*)
app.use('/api/v1/*', async (c, next) => { ... })

// Rate limiting (DESPUÉS de auth)
app.use('/api/v1/*', rateLimitMiddleware)

// Idempotency (DESPUÉS de rate limit)
app.use('/api/v1/*', idempotencyMiddleware)

// Request logging (AL FINAL)
app.use('*', requestLogMiddleware)
```

### 3. Migraciones de DB

```sql
-- Rate limit hits (si no usas KV)
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  route_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_lookup
  ON rate_limit_hits(merchant_id, route_key, created_at);

-- Idempotency records
CREATE TABLE IF NOT EXISTS idempotency_records (
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

-- Session logs
CREATE TABLE IF NOT EXISTS session_logs (
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

CREATE INDEX IF NOT EXISTS idx_session_logs_merchant
  ON session_logs(merchant_id, created_at DESC);
```

### 4. Env Bindings (wrangler.toml)

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "xxx"  # Crear en Cloudflare dashboard

[[kv_namespaces]]
binding = "IDEMPOTENCY_KV"
id = "yyy"  # Crear en Cloudflare dashboard

[vars]
RATE_LIMIT_MAX = "60"
RATE_LIMIT_WINDOW_MS = "60000"
```

## 🧪 Tests Recomendados

```bash
# Test health check
curl http://localhost:8787/

# Test con API key y idempotency
curl -X POST http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-123" \
  -d '{"amount": 10000, "currency": "MXN"}'

# Repetir mismo request (debe devolver mismo resultado con header Idempotency-Replayed: true)

# Test rate limit (enviar 61+ requests rápido)
for i in {1..65}; do
  curl -X GET http://localhost:8787/api/v1/payment_intents \
    -H "Authorization: Bearer pk_test_..." &
done
```

## ✅ Checklist Final

- [x] lib/errors.ts
- [x] lib/requestId.ts
- [x] lib/hashing.ts
- [x] lib/rateLimitStore.ts
- [x] lib/idempotencyStore.ts
- [ ] middleware/requestId.ts
- [ ] middleware/rateLimit.ts
- [ ] middleware/idempotency.ts
- [ ] middleware/requestLog.ts
- [ ] Actualizar index.ts
- [ ] Migraciones DB
- [ ] Configurar KV namespaces
- [ ] Tests

## 📝 Notas de Implementación

**Reutilizando:**
- Supabase client existente
- API key auth existente
- Estructura de rutas existente
- Schemas Zod en canonical.ts

**Nuevo:**
- Request ID tracking
- Rate limiting con 60 req/min default
- Idempotency con Idempotency-Key header
- Request logging a session_logs

**merchant_id pattern**: Se mantiene en toda la implementación (viene del API key)
**Amounts**: Siempre en minor units (BIGINT)
**Error format**: Siempre canónico con request_id
