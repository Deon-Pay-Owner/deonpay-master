# Guía de Migración - DeonPay Database

## 🚨 PROBLEMA ACTUAL

Error de recursión infinita en las políticas RLS:
```
infinite recursion detected in policy for relation "merchants" (42P17)
```

## ✅ SOLUCIÓN

Ejecutar la migración 003 que corrige las políticas RLS.

---

## 📋 PASOS PARA EJECUTAR LA MIGRACIÓN

### 1. Ve al SQL Editor de Supabase
```
https://supabase.com/dashboard/project/exhjlvaocapbtgvqxnhr/sql/new
```

### 2. Copia y ejecuta TODO el contenido del archivo:
```
infra/migrations/003_fix_rls_policies.sql
```

### 3. Verifica que se ejecutó correctamente
Deberías ver: `Success. No rows returned`

---

## 🎯 QUÉ HACE ESTA MIGRACIÓN

La migración 003 **elimina la recursión infinita** al:

1. ✅ Eliminar todas las políticas antiguas problemáticas
2. ✅ Crear políticas simplificadas **sin referencias circulares**
3. ✅ Usar solo `owner_user_id` directamente (sin JOIN a `merchant_members`)
4. ✅ Agregar políticas para DELETE que faltaban

---

## 📝 POLÍTICAS CORREGIDAS

### **merchants**
- ✅ `SELECT`: Solo si eres el owner (auth.uid() = owner_user_id)
- ✅ `INSERT`: Solo si eres el owner
- ✅ `UPDATE`: Solo si eres el owner
- ✅ `DELETE`: Solo si eres el owner

### **users_profile**
- ✅ `SELECT`: Solo tu propio perfil
- ✅ `INSERT`: Solo tu propio perfil
- ✅ `UPDATE`: Solo tu propio perfil
- ✅ `DELETE`: Solo tu propio perfil

### **merchant_members**
- ✅ `SELECT`: Solo tus propias membresías
- ✅ `INSERT`: Owners pueden agregar + usuarios pueden ser agregados
- ✅ `UPDATE`: Solo owners
- ✅ `DELETE`: Owners pueden eliminar + usuarios pueden salirse

---

## ⚠️ IMPORTANTE

**NO ejecutes la migración 002 otra vez**, ya que tiene las políticas problemáticas.

Solo ejecuta la migración **003** para corregir el problema.

---

## 🧪 DESPUÉS DE LA MIGRACIÓN

Prueba estos flujos:

1. **Signup nuevo usuario:**
   - Ve a https://deonpay.mx/signup
   - Completa el formulario
   - Debería crear merchant exitosamente

2. **Login usuario existente:**
   - Ve a https://deonpay.mx/signin
   - Login con `hectortemichescobedo@gmail.com`
   - Debería crear merchant automáticamente

3. **Eliminar cuenta:**
   - Ve al dashboard
   - Sección General → Zona de peligro
   - Eliminar cuenta

Si todavía hay errores, revisa los logs en la consola del navegador (F12) y avísame.
