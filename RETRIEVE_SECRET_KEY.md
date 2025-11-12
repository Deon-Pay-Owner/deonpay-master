# Cómo Recuperar tu Secret Key

## Situación Actual

Mencionaste que tienes `sk_test_iwieUKsh...` pero no puedes copiarlo del dashboard.

**Importante:** Por diseño de seguridad, el Secret Key completo solo se muestra UNA VEZ cuando se genera. Después, solo se almacena el hash (no el valor completo) en la base de datos.

## Opciones para Recuperar/Obtener el Secret Key:

### Opción 1: Consultar directamente en Supabase (Si `public_key` almacena el SK completo)

Basándome en tu mensaje que dice que tienes `sk_test_iwieUKsh...`, parece que el dashboard ya te está mostrando algo. Si ese valor empieza con `sk_`, es probable que sea tu Secret Key.

**Ejecuta este query en el SQL Editor de Supabase:**

```sql
SELECT
  id,
  merchant_id,
  key_type,
  public_key,
  secret_key_prefix,
  is_active,
  created_at
FROM api_keys
WHERE merchant_id = '78974e72-8ce6-404f-8442-ecc6bf7ff57e'
  AND is_active = true
ORDER BY created_at DESC;
```

Este query te mostrará:
- `public_key`: Podría contener tu PK o SK dependiendo del diseño
- `secret_key_prefix`: Los primeros caracteres del SK (ej: "sk_test_abc...")

**Si `public_key` muestra algo como `sk_test_...`**, ese ES tu Secret Key completo y puedes copiarlo.

### Opción 2: Generar un nuevo par de llaves (RECOMENDADO)

Esta es la forma más segura y correcta:

1. Ve a tu dashboard: `https://dashboard.deonpay.mx/78974e72-8ce6-404f-8442-ecc6bf7ff57e/desarrolladores`

2. Haz clic en el botón **"Generar nuevas keys"**

3. Verás un modal de advertencia que dice que las llaves actuales serán desactivadas

4. Haz clic en **"Generar Nuevas Keys"**

5. El modal te mostrará:
   - **Public Key** (pk_test_...)
   - **Secret Key** (sk_test_...) ← **COPIA ESTA AHORA**

6. **MUY IMPORTANTE:** Copia y guarda el Secret Key inmediatamente porque **no podrás verlo de nuevo**

7. Guarda ambas llaves en un lugar seguro (ej: variables de entorno, gestor de contraseñas, etc.)

### Opción 3: Usar el SQL Editor para ver el campo completo

Si ya viste `sk_test_iwieUKsh...` en algún lado, ejecuta este query para ver el valor completo sin truncar:

```sql
-- Ver TODAS las columnas de tu API key
SELECT *
FROM api_keys
WHERE merchant_id = '78974e72-8ce6-404f-8442-ecc6bf7ff57e'
  AND key_type = 'test'
  AND is_active = true
LIMIT 1;
```

Luego, haz clic en la celda del campo `public_key` en los resultados y copia todo el valor.

## ¿Qué hacer después de obtener tu Secret Key?

Una vez que tengas tu Secret Key (sk_test_xxx), podrás:

1. **Ejecutar las migraciones** 002 y 003 en Supabase
2. **Hacer deploy del Worker** a Cloudflare
3. **Probar el API** con tu Secret Key:

```bash
curl -X POST https://api.deonpay.mx/api/v1/payment_intents \
  -H "Authorization: Bearer sk_test_TU_SECRET_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "mxn",
    "description": "Test payment"
  }'
```

## Notas de Seguridad

- ❌ **Nunca** compartas tu Secret Key públicamente
- ❌ **Nunca** incluyas tu Secret Key en el código frontend
- ✅ **Siempre** usa Secret Key solo en tu servidor/backend
- ✅ **Siempre** almacena Secret Keys en variables de entorno
- ✅ **Siempre** guarda tu Secret Key inmediatamente cuando se genera

## Si Perdiste tu Secret Key

Si ya generaste una Secret Key antes y la perdiste:
- No hay forma de recuperarla (es por diseño de seguridad)
- Debes generar un nuevo par de llaves usando la Opción 2
- Las llaves antiguas se desactivarán automáticamente
