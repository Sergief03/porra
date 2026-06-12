# ⚽ Porra Mundial 2026

App de porra para el Mundial 2026 con actualización de resultados en tiempo real.

## 🚀 Despliegue en Vercel (GRATIS, ~10 minutos)

### Paso 1 — Sube el código a GitHub

```bash
# Crea una cuenta en github.com si no tienes
# Crea un repositorio nuevo llamado "porra-mundial"

git init
git add .
git commit -m "Porra Mundial 2026"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/porra-mundial.git
git push -u origin main
```

### Paso 2 — Despliega en Vercel

1. Ve a **vercel.com** → Sign up con tu cuenta de GitHub (gratis)
2. Click **"Add New Project"**
3. Importa tu repositorio `porra-mundial`
4. Click **Deploy** → En ~2 minutos tienes la URL 🎉

### Paso 3 — Añade la base de datos (Vercel KV)

1. En tu proyecto de Vercel → pestaña **"Storage"**
2. Click **"Create Database"** → selecciona **KV** (Redis, plan gratuito)
3. Nombra la base de datos: `porra-db`
4. Click **"Connect to Project"** → selecciona tu proyecto
5. Vercel añade las variables de entorno automáticamente ✅

### Paso 4 — API de resultados en tiempo real

1. Ve a **https://www.football-data.org/client/register**
2. Regístrate gratis (plan Tier Free: 10 req/min)
3. Recibirás un email con tu **API Key**
4. En Vercel → **Settings → Environment Variables**:
   - Nombre: `FOOTBALL_API_KEY`
   - Valor: `tu_api_key`
5. Redeploy (Settings → Deployments → Redeploy)

### Paso 5 — Cambia la contraseña de admin

En **Settings → Environment Variables**:
- Nombre: `NEXT_PUBLIC_ADMIN_PASS`
- Valor: `tu_contraseña_secreta`

---

## 🏆 Cómo usar la app

### Como admin (para introducir resultados):
1. Click en el candado 🔒 arriba a la derecha
2. Introduce la contraseña (por defecto: `mundial2026`)
3. En la tabla o vista partidos → click en cualquier resultado para introducirlo
4. También puedes añadir/eliminar jugadores

### Como jugador:
1. En la **Vista Tabla** → click en tu celda para introducir tu pronóstico (ej: `2-1`)
2. Una vez el partido tiene resultado, la celda se colorea:
   - 🟢 **Verde** (3 pts): marcador exacto
   - 🟡 **Amarillo** (1 pt): ganador correcto o empate correcto
   - 🔴 **Rojo** (0 pts): error total
3. En **Clasificación** puedes ver el ranking en tiempo real

---

## 📊 Sistema de puntuación

| Color | Puntos | Condición |
|-------|--------|-----------|
| 🟢 Verde | 3 pts | Marcador exacto (ej: pronosticaste 2-1 y fue 2-1) |
| 🟡 Amarillo | 1 pt | Acertaste el ganador/empate (ej: pronosticaste 2-1 y fue 1-0) |
| 🔴 Rojo | 0 pts | Error total |

---

## 🔧 Desarrollo local

```bash
npm install
cp .env.example .env.local
# Edita .env.local con tus variables

npm run dev
# Abre http://localhost:3000
```

Sin Vercel KV configurado, la app funciona pero sin persistencia (los datos se pierden al recargar).
