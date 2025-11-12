# DeonPay API - Migraciones de Base de Datos

## Orden de Ejecución de Migraciones

Para implementar la arquitectura basada en Secret Key (SK), ejecuta las siguientes migraciones en orden:

### 1. Migration 002: RLS Policies basadas en SK

**Archivo:** `002_sk_based_rls_policies.sql`

**Qué hace:**
- Crea funciones helper para obtener el `merchant_id` y `key_type` del contexto de sesión
- Implementa políticas RLS que diferencian entre PK y SK:
  - **Secret Key (SK)**: Acceso completo (SELECT, INSERT, UPDATE, DELETE) a payment_intents, customers, refunds, balance
  - **Public Key (PK)**: Solo lectura (SELECT) a payment_intents, customers, refunds
  - **Balance**: Solo SK puede acceder
- Aplica políticas RLS a las tablas de middleware (rate_limit_hits, idempotency_records, session_logs)

**Cómo ejecutar:**
1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard/project/_
2. Haz clic en "SQL Editor" en el menú izquierdo
3. Haz clic en "New query"
4. Copia y pega todo el contenido de `002_sk_based_rls_policies.sql`
5. Haz clic en "Run" (o presiona Ctrl+Enter)
6. Verifica que veas el mensaje: "SK-based RLS policies migration completed successfully!"

### 2. Migration 003: Función Set Config

**Archivo:** `003_set_config_function.sql`

**Qué hace:**
- Crea la función `set_merchant_context(p_merchant_id, p_key_type)` que permite al API establecer variables de sesión de PostgreSQL
- Otorga permisos de ejecución a los roles `anon` y `authenticated` (usados por Supabase)

**Cómo ejecutar:**
1. En el mismo SQL Editor de Supabase
2. Haz clic en "New query"
3. Copia y pega todo el contenido de `003_set_config_function.sql`
4. Haz clic en "Run" (o presiona Ctrl+Enter)
5. Verifica que veas el mensaje: "Set config function created successfully!"

## Verificación de las Migraciones

Después de ejecutar las migraciones, puedes verificar que todo está correcto:

### Verificar funciones creadas:

```sql
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'current_merchant_id',
    'current_api_key_type',
    'is_secret_key',
    'set_merchant_context'
  );
```

Deberías ver 4 funciones.

### Verificar políticas RLS:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN (
  'payment_intents',
  'customers',
  'refunds',
  'balance',
  'rate_limit_hits',
  'idempotency_records',
  'session_logs'
)
ORDER BY tablename, policyname;
```

Deberías ver múltiples políticas para cada tabla.

## Arquitectura Implementada

### Secret Key (SK) - Para operaciones de servidor

**Formato:** `sk_test_...` o `sk_live_...` o `key_type = 'test'/'live'`

**Permisos:**
- ✅ Crear payment intents
- ✅ Actualizar payment intents
- ✅ Eliminar payment intents
- ✅ Leer payment intents
- ✅ CRUD completo en customers
- ✅ CRUD completo en refunds
- ✅ Acceso a balance

**Uso recomendado:** Backend de tu aplicación

### Public Key (PK) - Para operaciones de cliente

**Formato:** `pk_test_...` o `pk_live_...`

**Permisos:**
- ❌ No puede crear payment intents
- ❌ No puede actualizar payment intents
- ❌ No puede eliminar payment intents
- ✅ Solo lectura de payment intents
- ✅ Solo lectura de customers
- ✅ Solo lectura de refunds
- ❌ Sin acceso a balance

**Uso recomendado:** Frontend de tu aplicación (solo para consultas)

## Flujo de Trabajo Recomendado

```
┌─────────────┐
│   Frontend  │
│  (React/JS) │
└──────┬──────┘
       │
       │ 1. Tokeniza tarjeta con Stripe/Conekta directamente
       │
       ▼
┌─────────────┐
│  Adquirente │
│(Stripe/etc) │
└──────┬──────┘
       │
       │ 2. Devuelve token
       │
       ▼
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ 3. Envía token a tu backend
       │
       ▼
┌─────────────┐
│  Tu Backend │
│  (Node/etc) │
└──────┬──────┘
       │
       │ 4. Crea payment intent en DeonPay API usando SK
       │    Authorization: Bearer sk_test_...
       │
       ▼
┌─────────────┐
│ DeonPay API │
│  (api.deon) │
└──────┬──────┘
       │
       │ 5. RLS verifica que es SK y permite crear payment intent
       │
       ▼
┌─────────────┐
│   Supabase  │
│  PostgreSQL │
└─────────────┘
```

## Próximos Pasos

1. ✅ Ejecutar migraciones 002 y 003 en Supabase
2. ⏳ Hacer typecheck del código: `npm run typecheck`
3. ⏳ Hacer deploy del Worker a Cloudflare: `wrangler deploy`
4. ⏳ Probar creación de payment intent con tu SK: `sk_test_iwieUKsh...`
5. ⏳ Verificar que PK ahora da error al intentar crear payment intent

## Notas Importantes

- **NUNCA** uses Secret Key (SK) en el frontend
- **SIEMPRE** usa Secret Key (SK) en tu backend
- Public Key (PK) es solo para lectura y tokenización con el adquirente
- Las variables de sesión (`app.merchant_id`, `app.api_key_type`) se establecen automáticamente por el middleware de autenticación
