# Folio Item View — Monday.com App

App de tipo **Item View** para Monday.com. Al abrir un elemento en cualquier tablero, muestra:

1. **KPI Cards** — 4 indicadores visuales en la parte superior
2. **Consulta por folio** — Búsqueda en API externa (Make.com)
3. **Formulario editable** — Todos los campos del ítem con botón "Guardar cambios"

---

## FASE 0 — Setup automático via MCP (ya ejecutado)

El MCP de Monday inspeccionó el tablero **"Folios"** (`board_id: 8429194188`, workspace: `LOGISTICA`) y detectó automáticamente los siguientes IDs:

| Columna detectada         | ID en Monday                    | Tipo      | Uso               |
|---------------------------|---------------------------------|-----------|-------------------|
| Folio                     | `texto_mkmycpjw`                | text      | `FOLIO_COLUMN_ID` |
| Estado                    | `estado_mkmy6jeb`               | status    | KPI Card 1 🔵     |
| Fecha de solicitud        | `fecha_mkmy4ew5`                | date      | KPI Card 2 📅     |
| Gestor                    | `multiple_person_mkng7rdd`      | people    | KPI Card 3 👤     |
| Monto de la factura       | `n_mero_mkmyn41j`               | numbers   | KPI Card 4 💰     |

> **Por qué se eligieron estas columnas:** la prioridad fue status > date > people > numbers, tomando la primera coincidencia de cada tipo disponible en el tablero.

---

## Instalación

```bash
cd folio-item-view
npm install
npm run dev      # desarrollo en http://localhost:8301
npm run build    # producción → carpeta dist/
```

---

## Arquitectura

```
folio-item-view/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── config.js               ← IDs detectados por MCP (editar aquí para otro tablero)
    ├── main.jsx
    ├── App.jsx                 ← SDK dinámico: boardId + itemId en runtime
    ├── components/
    │   ├── KpiCards.jsx        ← 4 tarjetas con colores de estado Monday
    │   ├── ItemForm.jsx        ← Formulario editable + mutation
    │   └── FolioSearch.jsx     ← Búsqueda Make.com + acordeón
    └── styles/
        └── global.css
```

---

## Configuración (`src/config.js`)

El `board_id` **NUNCA** está en el código — viene del SDK en runtime. Solo se configuran los IDs de columna:

```js
export const FOLIO_COLUMN_ID = "texto_mkmycpjw";   // columna de búsqueda

export const KPI_COLUMNS = [
  { id: "estado_mkmy6jeb",          label: "Estado",              icon: "🔵" },
  { id: "fecha_mkmy4ew5",           label: "Fecha de solicitud",  icon: "📅" },
  { id: "multiple_person_mkng7rdd", label: "Gestor",              icon: "👤" },
  { id: "n_mero_mkmyn41j",          label: "Monto de la factura", icon: "💰" },
];
```

### Si instalas en otro tablero

1. Obtén los IDs de columna desde: Tablero → Menú → Columnas → "¿Qué es esto?"
   (o vía la API de Monday: `boards(ids: [TU_BOARD_ID]) { columns { id title type } }`)
2. Actualiza `FOLIO_COLUMN_ID` con la columna que sirva como clave de búsqueda
3. Actualiza los 4 elementos de `KPI_COLUMNS` con los IDs reales
4. Si una KPI_COLUMN no existe en el tablero destino, la card se oculta automáticamente (sin errores)

---

## Runtime — SDK dinámico

```js
// App.jsx — boardId e itemId SIEMPRE vienen del SDK, nunca hardcodeados
const monday = mondaySdk();

monday.listen("context", (res) => {
  const { boardId, itemId } = res.data;
  // Se usan para la query y la mutation
});
```

---

## API externa de consulta por folio

- **URL**: `https://hook.us1.make.com/qmhc1yz9eptyjdcoug5gm6e6ugfdq9sa`
- **Método**: GET con query param `?folio=NUMERO`
- **Respuesta esperada**: JSON plano `{ campo: valor, ... }`
- Los primeros 4 campos siempre visibles; el resto bajo acordeón animado

---

## Tipos de columna soportados en el formulario

| Tipo Monday  | Input renderizado          | Editable |
|--------------|----------------------------|----------|
| `text`       | input text                 | ✅        |
| `numbers`    | input number               | ✅        |
| `status`     | select con opciones        | ✅        |
| `date`       | input date                 | ✅        |
| `email`      | input email                | ✅        |
| `link`       | input text (URL)           | ✅        |
| `people`     | display solo               | —         |
| `file`       | oculto                     | —         |
| `formula`    | oculto                     | —         |
| `subtasks`   | oculto                     | —         |
