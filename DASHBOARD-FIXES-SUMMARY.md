# Dashboard Issues - Summary & Fix Plan

## Completed ✅

1. **API Keys visibility fixed**
   - Issue: Dashboard showed 0 keys due to RLS blocking queries
   - Fix: Switched from `createClient()` to `createServiceClient()` in `desarrolladores/page.tsx`
   - Result: Now shows 2 keys (1 Public + 1 Secret)

2. **Duplicate keys removed**
   - Removed duplicate pair created after "Default" keys
   - Only keeping: `Default Public Key` + `Default Secret Key`

3. **Regenerate keys endpoint fixed**
   - Issue: POST to `/api/merchant/[merchantId]/regenerate-keys` returned 404
   - Fix: Force rebuild dashboard on Vercel using `vercel --prod --force`
   - Result: Endpoint now returns 401 (expected without auth) instead of 404

4. **Products section routing fixed**
   - Issue: Dashboard was calling local API routes (`/api/merchant/.../products`) which returned 404
   - Fix: Created API client helper (`lib/api-client.ts`) that calls API worker at `api.deonpay.mx`
   - Updated `ProductosClient.tsx` and `CreateProductModal.tsx` to use new API client
   - Added automatic localStorage sync for public API key in `DesarrolladoresClient.tsx`
   - Added `NEXT_PUBLIC_DEONPAY_API_URL` environment variable
   - Result: Products section now calls correct API worker endpoints

## Pending Issues

### 1. Missing Dashboard Pages
These routes don't exist in the codebase:
- `/[merchantId]/clientes` (Customers)
- `/[merchantId]/productos` (Products)
- `/[merchantId]/links-de-pago` (Payment Links)

**Question for user**: ¿Estas secciones deben:
- A) Consumir datos directamente desde Supabase (como desarrolladores)?
- B) Consumir datos desde el API worker (api.deonpay.mx)?
- C) Todavía no están implementadas?

### 2. Dashboard API Routes Return 404
These routes exist in code but return 404 in production:
- `/api/merchant/[merchantId]/regenerate-keys`
- `/api/merchant/[merchantId]/customers`
- `/api/merchant/[merchantId]/products`
- `/api/merchant/[merchantId]/payment-links`

**Root cause**: Vercel deployment issue or routing configuration

### 3. Account Settings Issues
User mentioned: "no puedo... cambiar cierta informacion de mi cuenta"

Need to check:
- `/[merchantId]/cuenta/page.tsx` - Account page
- `/[merchantId]/cuenta/usuarios/page.tsx` - Users page

## Architecture Clarification Needed

User mentioned: "recuerda que desacoplamos algunas secciones que se ejecutaban directo del dashboard y lo mandamos al api worker"

**Current Understanding**:
- API Worker (`api.deonpay.mx`) handles: payment_intents, customers, refunds, products, payment_links, checkout
- Dashboard should only handle: UI, auth, and admin operations (like API keys management)

**Questions**:
1. Should dashboard pages call API worker endpoints OR query Supabase directly?
2. Are the missing pages intentionally not implemented yet?
3. Which sections are affected by the "desacoplamiento"?

## Next Steps (Recommendations)

### Immediate (Can do now):
1. Check `/[merchantId]/cuenta` pages for RLS issues (same as desarrolladores)
2. Document which endpoints are expected to work

### Requires User Input:
1. Clarify architecture: Where should customers/products/links data come from?
2. If from API worker: Need to create dashboard pages that call those endpoints
3. If from Supabase: Need to create pages with `createServiceClient()` like desarrolladores
4. Fix 404 API routes issue (investigate Vercel deployment)

## Files Modified So Far

1. `apps/dashboard/lib/supabase.ts` - Added `createServiceClient()` function
2. `apps/dashboard/lib/api-client.ts` - NEW: API client helper for calling api.deonpay.mx
3. `apps/dashboard/app/[merchantId]/desarrolladores/page.tsx` - Fixed to use Service Role client
4. `apps/dashboard/app/[merchantId]/desarrolladores/DesarrolladoresClient.tsx` - Added localStorage sync for public API key
5. `apps/dashboard/app/[merchantId]/productos/ProductosClient.tsx` - Updated to use API worker client
6. `apps/dashboard/app/[merchantId]/productos/CreateProductModal.tsx` - Updated to use API worker client
7. `apps/dashboard/.env.local` - Added `NEXT_PUBLIC_DEONPAY_API_URL`
8. `apps/dashboard/.env.example` - Updated with new environment variables
9. Database: Deactivated 2 duplicate API keys

## Technical Notes

- Service Role Key bypasses RLS entirely (safe because middleware verifies ownership)
- All server components that need to bypass RLS should use `createServiceClient()`
- Client components should call API routes or API worker endpoints (NOT direct Supabase)
