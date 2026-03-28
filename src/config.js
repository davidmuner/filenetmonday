// config.js
// ⚠️ IDs detectados automáticamente por MCP desde el tablero: "Folios" (board_id: 8429194188)
// ⚠️ Workspace: LOGISTICA (id: 3211870) — suramx.monday.com
// ✅ board_id NO está aquí — se obtiene en runtime desde el SDK de Monday
// 🔧 Si instalas en otro tablero, actualiza los IDs de columna según corresponda

// Columna que sirve como clave de búsqueda por folio
// Detectada por MCP: columna "Folio" (type: text)
export const FOLIO_COLUMN_ID = "folio_mkm8zvz3";

// Webhook de Make.com para consulta externa por número de folio
export const FOLIO_API_URL =
  "https://hook.us1.make.com/qmhc1yz9eptyjdcoug5gm6e6ugfdq9sa";

// Columna opcional para mostrar como subtítulo debajo del nombre del ítem.
// null = no se muestra subtítulo.
export const SUBTITLE_COLUMN_ID = "agente_mkm8symv";

// Las 4 KPI cards detectadas por MCP del tablero "Folios"
// icon: nombre del ícono SVG — opciones: "document" | "calendar" | "person" |
//       "money" | "percent" | "status" | "clock" | "check" | "x" | "tag"
// color: color del ícono y acento (hex)
export const KPI_COLUMNS = [
  {
    id: "soluci_n_mkm819r",
    label: "Solicitud",
    icon: "status",
    color: "#0073ea",
  },
  {
    id: "ejecutivo_mkm8dzk6",
    label: "Ejecutivo",
    icon: "status",
    color: "#e67e22",
  },
  {
    id: "__posible_cierre_mkm8xq51",
    label: "%Posible cierre",
    icon: "percent",
    color: "#9b59b6",
  },
  {
    id: "prima_cotizaci_n_mkm8efja",
    label: "Cotización",
    icon: "money",
    color: "#00c875",
  },
];

// Cuántos campos de la respuesta API mostrar antes del acordeón "Ver más"
export const API_VISIBLE_FIELDS = 4;

// ─── Estado del Pipeline ───────────────────────────────────────────────────────
// Columna de estado que se muestra como selector visual con los posibles valores.
// columnId : ID de la columna status en Monday
// sectionLabel : título de la sección en la UI
// options : valores posibles — el `label` DEBE coincidir con el texto que
//           devuelve Monday en column_values[].text (insensible a mayúsculas)
//   icon  → "clock" | "check" | "x" | "status" | "tag" | ...
//   color → color activo del estado (hex)
export const PIPELINE_STATUS = {
  columnId: "estado_mkm8v4ry",
  sectionLabel: "Estado del Pipeline",
  options: [
    { label: "Pendiente", icon: "clock", color: "#e8b000" },
    { label: "Ganada",    icon: "check", color: "#00c875" },
    { label: "Perdida",   icon: "x",     color: "#df2f4a" },
  ],
};
