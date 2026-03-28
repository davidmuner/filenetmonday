# Guía de desarrollo local

Tienes dos opciones para probar la app antes de publicarla.

---

## Opción A — Mock local (sin Monday)

La más rápida. La app carga datos reales del tablero "Folios" directamente
desde el navegador, usando tu sesión activa de Monday.

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Levantar el servidor de desarrollo
npm run dev
# → http://localhost:8301
```

El archivo `.env.local` ya tiene configurado:
- `VITE_DEV_BOARD_ID=8429194188`  (tablero "Folios")
- `VITE_DEV_ITEM_ID=8754333304`   (ítem "Vidassistance")

**Para probar con otro ítem:** abre cualquier elemento en Monday,
copia el número al final de la URL (`/pulses/XXXXXXXXXX`) y
pégalo en `VITE_DEV_ITEM_ID` en `.env.local`. Guarda → Vite recarga automáticamente.

**Banner visual:** cuando el mock está activo verás una barra oscura en la parte
superior con el board_id e item_id activos. En producción no aparece.

> ⚠️ Necesitas tener la sesión de Monday abierta en el mismo navegador,
> porque `monday.api()` usa tu token de sesión para las queries GraphQL.

---

## Opción B — Tunnel ngrok (prueba real dentro de Monday)

Prueba la experiencia 100% real: la app embebida dentro del panel de Monday,
con el SDK inyectando el contexto automáticamente.

### Paso 1 — Instalar ngrok

```bash
# Con npm (global)
npm install -g ngrok

# O descarga el binario desde https://ngrok.com/download
```

Crea una cuenta gratuita en ngrok.com y autentica:
```bash
ngrok config add-authtoken TU_TOKEN_DE_NGROK
```

### Paso 2 — Levantar la app y el tunnel

```bash
# Terminal 1
npm run dev        # → http://localhost:8301

# Terminal 2
ngrok http 8301    # → https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

Copia la URL `https://` que muestra ngrok.

### Paso 3 — Crear la app en Monday Developer Center

1. Ve a **https://suramx.monday.com/apps/manage**
2. Click **"Crear app"** → ponle nombre (ej: "Folio Item View Dev")
3. En el menú izquierdo: **"Features"** → **"Add feature"** → **"Item view"**
4. En **"Build URL"**: pega la URL de ngrok → **Save**
5. En **"OAuth & Permissions"** asegúrate de tener:
   - `boards:read`
   - `boards:write`
   - `me:read`
6. Click **"Install"** → selecciona el tablero "Folios"

### Paso 4 — Ver la app en Monday

1. Abre el tablero **"Folios"** en suramx.monday.com
2. Haz click en cualquier elemento
3. En el panel derecho verás la pestaña de tu app
4. Cada cambio que hagas en el código se refleja al recargar el panel

### Paso 5 — Build para producción

Cuando la app esté lista:

```bash
npm run build
# → genera la carpeta dist/
```

Sube `dist/` a hosting estático (GitHub Pages, Netlify, S3, etc.)
y cambia la URL en el Developer Center de ngrok a la URL final.

---

## Resumen rápido

| | Opción A (mock) | Opción B (ngrok) |
|---|---|---|
| Velocidad de setup | Inmediato | ~10 min |
| SDK de Monday | No (mock) | Sí (real) |
| Contexto real | Configurable en .env.local | Automático |
| Notificaciones (`notice`) | No funcionan | Sí |
| Recomendado para | Iterar diseño y lógica | Validación final |
