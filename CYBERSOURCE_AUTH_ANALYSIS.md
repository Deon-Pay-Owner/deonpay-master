# CyberSource Authentication Failed - Análisis Detallado

## Datos del Request

### Request Details
```
Date: Wed, 12 Nov 2025 06:32:38 GMT  ❌ INCORRECTO
Digest: SHA-256=LgSyI8tGfiXAk4OYoDb22F1X9tDN7UqCNwQoer3LIbw=
Request Body Length: 551
Merchant ID: deon_pay_1761432252
API Key: dd960ee9-6c12-490d-bd69-de31766459be
```

### Signature
```
keyid="dd960ee9-6c12-490d-bd69-de31766459be",
algorithm="HmacSHA256",
headers="host date (request-target) digest v-c-merchant-id",
signature="bo23OaqXocGWQY1eQzTtrWOtROjyAFaqcLFS0G3BcGU="
```

### Response from CyberSource
```json
{
  "response": {
    "rmsg": "Authentication Failed"
  }
}
```

## Problema Identificado

### ❌ Fecha Incorrecta

La fecha del request es: **"Wed, 12 Nov 2025"**

Pero la fecha actual es: **Noviembre 12, 2024**

El año está incorrecto (2025 en lugar de 2024), lo cual hace que:
1. El día de la semana sea incorrecto (Wed en lugar de Tue)
2. La firma HMAC sea inválida (usa la fecha como parte del signature string)

## Causa Raíz

El código usa `new Date().toUTCString()` que depende del reloj del sistema.

Posibles causas:
1. El reloj del sistema está configurado incorrectamente (año 2025)
2. Zona horaria incorrecta causando overflow
3. Worker de Cloudflare usando time incorrecto

## Solución

### Verificar Fecha del Sistema

La environment variable `Today's date: 2025-11-12` indica que el sistema cree que estamos en 2025.

### Opciones:

1. **Corregir el reloj del sistema** (recomendado si es un error local)
2. **Usar fecha fija para testing** (temporal)
3. **Sincronizar con servidor NTP** (producción)

## Impacto

La firma HMAC se calcula como:
```
host: apitest.cybersource.com
date: Wed, 12 Nov 2025 06:32:38 GMT  ← ESTO ESTÁ MAL
(request-target): post /pts/v2/payments
digest: SHA-256=...
v-c-merchant-id: deon_pay_1761432252
```

Como la fecha es incorrecta, toda la firma es inválida y CyberSource rechaza el request con 401.

## Siguiente Paso

Necesitas corregir la fecha del sistema o ajustar el código para usar la fecha correcta.
