# Configuración de CyberSource

## Credenciales Sandbox Configuradas

```
Organization ID: deon_pay_1761432252
Key (Merchant ID): dd960ee9-6c12-490d-bd69-de31766459be
Shared Secret Key: VhV22d0gPVoS+XzAcdsogJpmDfUOFEj5QWVk6lhr/+Y=
Endpoint: https://apitest.cybersource.com
```

## Estado Actual

✅ Credenciales configuradas en el adapter
✅ Config por defecto usa credenciales sandbox
✅ Firma HMAC-SHA256 implementada
✅ Digest SHA-256 implementado
✅ Authorize implementado
✅ Capture implementado
✅ Refund implementado
✅ Void implementado
✅ Adapter registrado en index.ts
⏳ Falta implementar handleWebhook()

## Próximos Pasos

### 1. ~~Registrar Adapter en index.ts~~ ✅ COMPLETADO

El adapter ya está registrado en `api-worker/src/index.ts`.

### 2. Configurar DEFAULT_ADAPTER

En Cloudflare Workers o wrangler.toml:

```toml
[vars]
DEFAULT_ADAPTER = "cybersource"
```

O mantener "mock" para testing y especificar cybersource en routing_config.

### 3. Configurar en Base de Datos (Opcional)

Si quieres configurar por merchant en lugar de usar defaults:

```sql
UPDATE merchants
SET routing_config = '{
  "strategy": "default",
  "defaultAdapter": "cybersource",
  "adapters": {
    "cybersource": {
      "enabled": true,
      "merchantRef": "deon_pay_1761432252",
      "config": {
        "merchantId": "deon_pay_1761432252",
        "apiKey": "dd960ee9-6c12-490d-bd69-de31766459be",
        "secretKey": "VhV22d0gPVoS+XzAcdsogJpmDfUOFEj5QWVk6lhr/+Y=",
        "endpoint": "https://apitest.cybersource.com",
        "runEnvironment": "apitest.cybersource.com"
      }
    }
  }
}'::jsonb
WHERE id = 'tu_merchant_id';
```

## Implementación HTTP Signature

CyberSource usa HTTP Signature Authentication (RFC draft). La firma se genera así:

1. **Signature String**: Concatenar headers específicos
2. **HMAC-SHA256**: Calcular HMAC del signature string
3. **Base64**: Codificar resultado en Base64
4. **Header Format**: Construir header Signature

### Formato del Header Signature

```
Signature: keyid="<API_KEY>", algorithm="HmacSHA256", headers="host date (request-target) digest v-c-merchant-id", signature="<BASE64_SIGNATURE>"
```

### Ejemplo de Signature String

```
host: apitest.cybersource.com
date: Thu, 09 Jan 2025 10:00:00 GMT
(request-target): post /pts/v2/payments
digest: SHA-256=<BASE64_SHA256_OF_BODY>
v-c-merchant-id: deon_pay_1761432252
```

## Testing con Tarjetas de Prueba

CyberSource proporciona tarjetas de prueba:

### Successful Authorization
- **Visa**: 4111111111111111
- **Mastercard**: 5555555555554444
- **Amex**: 378282246310005

### Declined
- **Visa**: 4000300011112220 (Insufficient Funds)

### CVV
- Cualquier 3 dígitos para Visa/MC
- Cualquier 4 dígitos para Amex

### Exp Date
- Cualquier fecha futura

## API Endpoints

### Authorization (Auth Only)
```
POST /pts/v2/payments
{
  "clientReferenceInformation": { "code": "payment_intent_id" },
  "processingInformation": { "capture": false },
  "orderInformation": {
    "amountDetails": { "totalAmount": "10.99", "currency": "MXN" }
  },
  "paymentInformation": {
    "card": {
      "number": "4111111111111111",
      "expirationMonth": "12",
      "expirationYear": "2025",
      "securityCode": "123"
    }
  }
}
```

### Capture
```
POST /pts/v2/payments/{id}/captures
{
  "clientReferenceInformation": { "code": "charge_id" },
  "orderInformation": {
    "amountDetails": { "totalAmount": "10.99", "currency": "MXN" }
  }
}
```

### Refund
```
POST /pts/v2/payments/{id}/refunds
{
  "clientReferenceInformation": { "code": "refund_id" },
  "orderInformation": {
    "amountDetails": { "totalAmount": "5.00", "currency": "MXN" }
  }
}
```

### Void
```
POST /pts/v2/payments/{id}/voids
{
  "clientReferenceInformation": { "code": "charge_id" }
}
```

## Response Codes

- **AUTHORIZED**: Payment approved
- **DECLINED**: Payment declined by issuer
- **INVALID_REQUEST**: Request validation failed
- **PENDING_AUTHENTICATION**: 3DS required

## Recursos

- **API Reference**: https://developer.cybersource.com/api-reference-assets/index.html
- **Test Cards**: https://developer.cybersource.com/hello-world/testing-guide/test-card-numbers.html
- **HTTP Signature Auth**: https://developer.cybersource.com/docs/cybs/en-us/platform/developer/all/rest/platform/authentication/http-signature-auth.html
- **Postman Collection**: https://developer.cybersource.com/api/developer-guides/dita-gettingstarted/authentication/createSharedKey.html

## Notas Importantes

⚠️ **NO COMMITEAR CREDENCIALES**: Las credenciales están hardcoded temporalmente en el código para testing. Para producción:
1. Moverlas a variables de entorno de Cloudflare Workers
2. O almacenarlas encriptadas en la base de datos
3. Nunca commitear credenciales reales a Git

⚠️ **SANDBOX ONLY**: Estas credenciales son para el entorno sandbox. Para producción necesitarás:
1. Cuenta productiva de CyberSource
2. Nuevas credenciales (merchant ID, API key, shared secret)
3. Cambiar endpoint a `https://api.cybersource.com`
