# CyberSource 401 Error - Análisis y Solución

## Estado Actual

✅ **Flujo de datos funcionando correctamente**:
- `hasRawPaymentMethod: true`
- `hasBillingDetails: true`
- Los datos de tarjeta y billing llegan correctamente al adapter

❌ **Error de autenticación**:
- Status: 401 Unauthorized
- CyberSource rechaza el request debido a firma HMAC incorrecta

## Credenciales Verificadas

```
Organization ID: deon_pay_1761432252
Key: dd960ee9-6c12-490d-bd69-de31766459be
Shared secret key: VhV22d0gPVoS+XzAcdsogJpmDfUOFEj5QWVk6lhr/+Y=
```

## Problema Identificado

Según la documentación de CyberSource, el error 401 generalmente se debe a:

1. **Digest Hash incorrecto**: El hash SHA-256 del body debe coincidir exactamente
   - Cualquier espacio extra o salto de línea en el JSON causa diferente hash
   - El JSON debe estar minificado (sin espacios extras)

2. **Signature String incorrecto**: El orden y formato de los headers debe ser exacto

## Solución

### Opción 1: Usar el SDK Oficial de CyberSource

El SDK maneja toda la autenticación automáticamente:

```bash
npm install cybersource-rest-client
```

**Ventajas**:
- Autenticación manejada automáticamente
- Actualizado con últimos cambios de CyberSource
- Menos propenso a errores

**Desventajas**:
- Dependencia adicional
- Menos control sobre el request

### Opción 2: Fijar nuestra implementación actual

Agregar logs detallados y verificar:

1. Que el JSON body NO tenga espacios extras
2. Que el Digest se calcule correctamente
3. Que la Signature tenga el orden correcto de headers

```typescript
// En cybersource.ts, agregar logs:
console.log('[CyberSource] Request body:', requestBody)
console.log('[CyberSource] Digest:', digest)
console.log('[CyberSource] Signature:', signature)
```

### Opción 3: Usar mock adapter temporalmente

Para continuar con el desarrollo mientras se soluciona CyberSource:

```typescript
// En wrangler.toml o environment
DEFAULT_ADAPTER = "mock"
```

## Recomendación

**Opción 1 (SDK)** es la más confiable para producción. Muchos desarrolladores reportan problemas similares con implementaciones custom y el SDK los resuelve.

## Próximos Pasos

1. Agregar logs detallados al adapter actual
2. Verificar que el JSON esté minificado sin espacios
3. Si persiste, implementar SDK oficial de CyberSource
4. Alternativamente, usar mock adapter para testing
