# CyberSource Correct Integration Flow

## Executive Summary

Basado en la investigación de la documentación oficial de CyberSource, aquí está el flujo correcto de integración para procesar pagos de manera segura y completa.

## Flujos de Integración Disponibles

### 1. **Direct API Integration (Current Implementation)**
**Flujo Actual**: Backend envía datos de tarjeta directamente a CyberSource
- ✅ Más simple de implementar
- ❌ Requiere PCI DSS SAQ D compliance (más estricto)
- ✅ Apropiado para testing/sandbox
- ⚠️ Para producción necesita certificación PCI completa

### 2. **Flex Microform / Flex API (Recommended for Production)**
**Flujo Recomendado**: Cliente tokeniza en frontend, backend usa token
- ✅ Reduce scope de PCI a SAQ A (menos estricto)
- ✅ Datos sensibles nunca tocan tu servidor
- ✅ Token válido por 15 minutos, reusable
- ⚠️ Requiere configuración adicional en frontend

## Flow Correcto para Direct API (Current)

### Payment Intent Creation Flow

```
CLIENT                    DEONPAY API              CYBERSOURCE
  |                            |                         |
  |-- POST /payment_intents -->|                         |
  |    { amount, currency }    |                         |
  |                            |                         |
  |<-- 201 Created ------------|                         |
  |    { id: "pi_xxx",         |                         |
  |      status:               |                         |
  |      "requires_payment_    |                         |
  |       method" }            |                         |
```

### Payment Confirmation Flow (Direct API - NO 3DS)

```
CLIENT                    DEONPAY API                    CYBERSOURCE
  |                            |                               |
  |-- POST /payment_intents/   |                               |
  |     {id}/confirm           |                               |
  |    {                       |                               |
  |      payment_method: {     |                               |
  |        type: "card",       |                               |
  |        number: "4111...",  |                               |
  |        exp_month: 12,      |                               |
  |        exp_year: 2025,     |                               |
  |        cvv: "123"          |                               |
  |      },                    |                               |
  |      billing_details: {    |                               |
  |        name: "John Doe",   |                               |
  |        email: "...",       |                               |
  |        address: {          |                               |
  |          line1: "...",     |                               |
  |          city: "...",      |                               |
  |          state: "...",     |                               |
  |          postal_code: "...",|                              |
  |          country: "MX"     |                               |
  |        }                   |                               |
  |      }                     |                               |
  |    }                       |                               |
  |                            |                               |
  |                            |-- POST /pts/v2/payments ----->|
  |                            |    {                          |
  |                            |      clientReferenceInfo: {   |
  |                            |        code: "pi_xxx"         |
  |                            |      },                       |
  |                            |      processingInformation: { |
  |                            |        capture: false,        |
  |                            |        commerceIndicator:     |
  |                            |          "internet"           |
  |                            |      },                       |
  |                            |      orderInformation: {      |
  |                            |        amountDetails: {       |
  |                            |          totalAmount: "100.00",|
  |                            |          currency: "MXN"      |
  |                            |        },                     |
  |                            |        billTo: {              |
  |                            |          firstName: "John",   |
  |                            |          lastName: "Doe",     |
  |                            |          email: "...",        |
  |                            |          address1: "...",     |
  |                            |          locality: "...",     |
  |                            |          administrativeArea:  |
  |                            |            "...",             |
  |                            |          postalCode: "...",   |
  |                            |          country: "MX"        |
  |                            |        }                      |
  |                            |      },                       |
  |                            |      paymentInformation: {    |
  |                            |        card: {                |
  |                            |          number: "4111...",   |
  |                            |          expirationMonth:"12",|
  |                            |          expirationYear:"2025",|
  |                            |          securityCode: "123"  |
  |                            |        }                      |
  |                            |      }                        |
  |                            |    }                          |
  |                            |                               |
  |                            |<-- 201 AUTHORIZED ------------|
  |                            |    {                          |
  |                            |      status: "AUTHORIZED",    |
  |                            |      id: "6516...",          |
  |                            |      processorInformation: {  |
  |                            |        approvalCode: "...",   |
  |                            |        responseCode: "100"    |
  |                            |      }                        |
  |                            |    }                          |
  |                            |                               |
  |<-- 200 OK -----------------|                               |
  |    {                       |                               |
  |      id: "pi_xxx",         |                               |
  |      status: "succeeded",  |                               |
  |      charges: [{           |                               |
  |        id: "ch_xxx",       |                               |
  |        status: "captured"  |                               |
  |      }]                    |                               |
  |    }                       |                               |
```

### Payment Confirmation Flow (Direct API - WITH 3DS)

```
CLIENT                    DEONPAY API                    CYBERSOURCE              3DS Server
  |                            |                               |                         |
  |-- POST /confirm         -->|                               |                         |
  |    (same request)          |                               |                         |
  |                            |                               |                         |
  |                            |-- POST /risk/v1/           -->|                         |
  |                            |     authentication-setups     |                         |
  |                            |    (Setup payer auth)         |                         |
  |                            |                               |                         |
  |                            |<-- 201 Created ----------------|                         |
  |                            |    { accessToken }            |                         |
  |                            |                               |                         |
  |                            |-- POST /risk/v1/           -->|                         |
  |                            |     authentications           |                         |
  |                            |    (Check enrollment)         |                         |
  |                            |                               |                         |
  |                            |                               |-- Check enrollment ---->|
  |                            |                               |<-- Enrolled ------------|
  |                            |                               |                         |
  |                            |<-- 201 Created ----------------|                         |
  |                            |    {                          |                         |
  |                            |      consumerAuthReqInfo: {   |                         |
  |                            |        accessToken,           |                         |
  |                            |        stepUpUrl,             |                         |
  |                            |        acsUrl                 |
  |                            |      }                        |                         |
  |                            |    }                          |                         |
  |                            |                               |                         |
  |<-- 200 OK (requires     ---|                               |                         |
  |     action)                |                               |                         |
  |    {                       |                               |                         |
  |      status:               |                               |                         |
  |        "requires_action",  |                               |                         |
  |      next_action: {        |                               |                         |
  |        type:               |                               |                         |
  |          "redirect_to_url",|                               |                         |
  |        redirect_to_url: {  |                               |                         |
  |          url: "...",       |                               |                         |
  |          return_url: "..." |                               |                         |
  |        }                   |                               |                         |
  |      }                     |                               |                         |
  |    }                       |                               |                         |
  |                            |                               |                         |
  |-- REDIRECT to 3DS ---------|--------------------------------|------------------------>|
  |                            |                               |                         |
  |    (User completes 3DS)    |                               |                         |
  |                            |                               |                         |
  |<-- REDIRECT back -----------|--------------------------------|------------------------|
  |    to return_url           |                               |                         |
  |                            |                               |                         |
  |-- POST /confirm again   -->|                               |                         |
  |    (with 3DS result)       |                               |                         |
  |                            |                               |                         |
  |                            |-- POST /pts/v2/payments ----->|                         |
  |                            |    (with 3DS CAVV/ECI)        |                         |
  |                            |                               |                         |
  |                            |<-- 201 AUTHORIZED ------------|                         |
  |                            |                               |                         |
  |<-- 200 OK (succeeded) -----|                               |                         |
```

## Campos Requeridos

### Billing Information (billTo)

**Campos MÍNIMOS requeridos por CyberSource:**
- `firstName` - REQUERIDO
- `lastName` - REQUERIDO
- `email` - REQUERIDO
- `country` - REQUERIDO (código ISO 2 letras: MX, US, etc.)

**Campos RECOMENDADOS para AVS (Address Verification Service):**
- `address1` (line1)
- `locality` (city)
- `administrativeArea` (state)
- `postalCode` - MUY IMPORTANTE para AVS
- `phoneNumber`

**Impacto de Billing Info en 3DS:**
- La información de billing NO determina si se usa 3DS
- 3DS se determina por:
  1. Configuración del merchant
  2. Tipo de tarjeta
  3. Monto de la transacción
  4. Reglas de riesgo configuradas
  5. País emisor de la tarjeta

### Payment Information (card)

**Campos REQUERIDOS:**
- `number` - Número de tarjeta (13-19 dígitos)
- `expirationMonth` - Mes de expiración (01-12, formato string)
- `expirationYear` - Año de expiración (YYYY, formato string)
- `securityCode` - CVV/CVC (3-4 dígitos)

## Decisión de Implementación

### Para Sandbox/Testing (Actual):
✅ **Direct API con datos completos de billing**
- Enviar tarjeta directamente
- Incluir billing completo en cada request
- Implementar soporte para 3DS challenge redirect

### Para Producción (Futuro):
✅ **Migrar a Flex API + Tokenization**
- Frontend usa Flex Microform para tokenizar
- Backend recibe token (15 min validity)
- Usar token en authorization
- Reduce PCI scope significativamente

## Próximos Pasos

1. ✅ Arreglar RLS policies (DONE)
2. ⬜ Actualizar endpoint confirm para:
   - Aceptar billing_details completo
   - Pasar datos de tarjeta real al adapter
   - Manejar 3DS redirect
3. ⬜ Actualizar CyberSource adapter para:
   - Usar datos reales de tarjeta
   - Mapear billing correctamente
   - Implementar enrollment check para 3DS
4. ⬜ Testing completo en sandbox
5. ⬜ Documentar para producción

## Referencias

- [CyberSource Payments API](https://developer.cybersource.com/api-reference-assets/index.html#payments)
- [Payer Authentication (3DS)](https://developer.cybersource.com/docs/cybs/en-us/payer-authentication/developer/all/so/payer-auth/pa-intro.html)
- [Flex API Tokenization](https://developer.cybersource.com/docs/cybs/en-us/digital-accept-flex/developer/all/rest/digital-accept-flex/flex-api-2/flex-api-2-intro.html)
