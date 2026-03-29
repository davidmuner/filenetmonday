import { useState, useEffect, useRef } from "react";
import mondaySdk from "monday-sdk-js";
import KpiCards from "./components/KpiCards";
import ItemForm from "./components/ItemForm";
import FolioSearch from "./components/FolioSearch";
import "./styles/global.css";

const monday = mondaySdk();

const IS_DEV_MOCK =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_BOARD_ID &&
  import.meta.env.VITE_DEV_ITEM_ID;

if (IS_DEV_MOCK && import.meta.env.VITE_DEV_API_TOKEN) {
  monday.setToken(import.meta.env.VITE_DEV_API_TOKEN);
}

// Settings de desarrollo — equivalen a la configuración del tablero "Folios".
// En producción estos valores vienen de monday.get("settings") (Developer Center).
const DEV_MOCK_SETTINGS = {
  folio_column_id:     "folio_mkm8zvz3",
  folio_api_url:       "https://hook.us1.make.com/qmhc1yz9eptyjdcoug5gm6e6ugfdq9sa",
  subtitle_column_id:  "agente_mkm8symv",
  kpi_col_1:           "soluci_n_mkm819r",
  kpi_col_2:           "ejecutivo_mkm8dzk6",
  kpi_col_3:           "__posible_cierre_mkm8xq51",
  kpi_col_4:           "prima_cotizaci_n_mkm8efja",
  pipeline_status_col: "estado_mkm8v4ry",
};

// URL del webhook por defecto cuando no está configurado en settings
const FALLBACK_FOLIO_API_URL =
  "https://hook.us1.make.com/qmhc1yz9eptyjdcoug5gm6e6ugfdq9sa";

// Tipos que no deben aparecer como KPI
const NON_KPI_TYPES = new Set([
  "name", "subtasks", "formula", "auto_number",
  "creation_log", "last_updated", "button", "board_relation",
  "dependency", "mirror",
]);

// ─── Normalización de settings de Monday ─────────────────────────────────────
//
// El column-picker de Monday puede devolver el ID de varias formas según la
// versión del SDK. Esta función extrae el ID de la columna sin importar el formato.
//
function extractColumnId(v) {
  if (!v) return null;
  if (typeof v === "string") return v || null;
  if (typeof v !== "object" || Array.isArray(v)) return null;
  // Formato real de Monday column-picker: { "column_id": true }
  // El ID de la columna es la clave cuyo valor es true
  const trueKey = Object.keys(v).find((k) => v[k] === true);
  if (trueKey) return trueKey;
  // Fallback para otras versiones del SDK
  const id = v.id ?? v.columnId ?? v.column_id ?? v.value ?? v.fieldId ?? v.column?.id ?? null;
  if (id && typeof id === "string") return id;
  return null;
}

function normalizeSettings(raw) {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      v && typeof v === "object" && !Array.isArray(v) ? extractColumnId(v) : v,
    ])
  );
}

// ─── Auto-detección de settings ──────────────────────────────────────────────
//
// Toma los rawSettings del Developer Center y los complementa / corrige con
// detección automática cuando los IDs no coinciden con el tablero actual.
//
function resolveSettings(rawSettings, boardColumns, itemColumnValues) {
  const existingIds = new Set((itemColumnValues ?? []).map((cv) => cv.id));

  // Devuelve el ID solo si existe en el tablero actual
  const valid = (id) => (id && existingIds.has(id) ? id : null);

  // Busca una columna por texto en el título (case-insensitive, tipo opcional)
  const findByTitle = (keyword, type = null) =>
    boardColumns.find(
      (bc) =>
        bc.title.toLowerCase().includes(keyword.toLowerCase()) &&
        (type === null || bc.type === type) &&
        existingIds.has(bc.id)
    )?.id ?? null;

  // ── 1. Folio column ───────────────────────────────────────────────────────
  const folioColId =
    valid(rawSettings.folio_column_id) ??
    findByTitle("folio");

  // ── 2. Folio API URL ──────────────────────────────────────────────────────
  const folioApiUrl = rawSettings.folio_api_url || FALLBACK_FOLIO_API_URL;

  // ── 3. Subtitle column ────────────────────────────────────────────────────
  const subtitleColId =
    valid(rawSettings.subtitle_column_id) ??
    findByTitle("agente", "text") ??
    null;

  // ── 4. Pipeline status column ─────────────────────────────────────────────
  const pipelineColId =
    valid(rawSettings.pipeline_status_col) ??
    findByTitle("estado", "status") ??
    boardColumns.find((bc) => bc.type === "status" && existingIds.has(bc.id))?.id ??
    null;

  // ── 5. KPI columns ────────────────────────────────────────────────────────
  // Si el usuario configuró al menos un KPI en Ajustes → respetar su selección
  // (nunca mezclar settings con auto-detección).
  // Si no configuró ninguno → auto-detectar 4 columnas.
  const rawKpiIds = [
    rawSettings.kpi_col_1,
    rawSettings.kpi_col_2,
    rawSettings.kpi_col_3,
    rawSettings.kpi_col_4,
  ];
  const hasAnyConfiguredKpi = rawKpiIds.some(Boolean);

  let kpiIds;

  if (hasAnyConfiguredKpi) {
    // Respetar configuración del usuario; los no configurados quedan null
    kpiIds = rawKpiIds.map(valid);
  } else {
    // Sin configuración → auto-detectar por tipo (numbers > status > text...)
    const reserved = new Set([folioColId, subtitleColId, pipelineColId].filter(Boolean));
    const KPI_TYPE_PRIORITY = ["numbers", "status", "text", "dropdown", "email", "link"];

    const candidates = [];
    for (const type of KPI_TYPE_PRIORITY) {
      for (const bc of boardColumns) {
        if (
          !NON_KPI_TYPES.has(bc.type) &&
          bc.type === type &&
          existingIds.has(bc.id) &&
          !reserved.has(bc.id) &&
          !candidates.includes(bc.id)
        ) {
          candidates.push(bc.id);
          if (candidates.length >= 4) break;
        }
      }
      if (candidates.length >= 4) break;
    }

    kpiIds = [
      candidates[0] ?? null,
      candidates[1] ?? null,
      candidates[2] ?? null,
      candidates[3] ?? null,
    ];
  }

  return {
    folio_column_id:     folioColId,
    folio_api_url:       folioApiUrl,
    subtitle_column_id:  subtitleColId,
    pipeline_status_col: pipelineColId,
    kpi_col_1: kpiIds[0],
    kpi_col_2: kpiIds[1],
    kpi_col_3: kpiIds[2],
    kpi_col_4: kpiIds[3],
  };
}

// ─── Dev Banner ───────────────────────────────────────────────────────────────

function DevBanner() {
  return (
    <div className="dev-banner">
      <span>🛠 DEV MODE</span>
      <span>
        board&nbsp;<code>{import.meta.env.VITE_DEV_BOARD_ID}</code>
        &nbsp;·&nbsp;item&nbsp;<code>{import.meta.env.VITE_DEV_ITEM_ID}</code>
      </span>
    </div>
  );
}

// ─── Skeleton / Error ─────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="skeleton-wrapper">
      <div className="skeleton-card" style={{ height: 28, width: "60%", marginBottom: 4 }} />
      <div className="skeleton-kpi-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-card" style={{ height: 90 }} />
        ))}
      </div>
      <div className="skeleton-card" style={{ height: 96 }} />
      <div className="skeleton-block skeleton-search" />
      <div className="skeleton-block skeleton-form-block">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-field" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <span className="error-icon">⚠️</span>
      <p>{message}</p>
      {onRetry && (
        <button className="btn-retry" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────

export default function App() {
  const [context, setContext]           = useState(null);
  const [settings, setSettings]         = useState(null);
  const [item, setItem]                 = useState(null);
  const [boardColumns, setBoardColumns] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const loadTokenRef = useRef(null);

  // ── Contexto y settings desde Monday SDK o mock de desarrollo ──
  useEffect(() => {
    if (IS_DEV_MOCK) {
      setContext({
        boardId: import.meta.env.VITE_DEV_BOARD_ID,
        itemId:  import.meta.env.VITE_DEV_ITEM_ID,
      });
      setSettings(DEV_MOCK_SETTINGS);
      return;
    }
    monday.listen("context", (res) => {
      const { boardId, itemId } = res.data ?? {};
      if (boardId && itemId) {
        setContext({ boardId: String(boardId), itemId: String(itemId) });
      }
    });
    monday.get("settings").then((res) => {
      const raw = res.data ?? {};
      setSettings(normalizeSettings(raw));
    });
    monday.listen("settings", (res) => {
      const raw = res.data ?? {};
      setSettings(normalizeSettings(raw));
    });
  }, []);

  // ── Cargar datos cuando hay contexto Y settings disponibles ──
  useEffect(() => {
    if (!context?.boardId || !context?.itemId || !settings) return;
    const token = Symbol();
    loadTokenRef.current = token;
    loadItemData(context.boardId, context.itemId, token);
  }, [context, settings]);

  const loadItemData = async (boardId, itemId, token) => {
    setLoading(true);
    setError(null);
    try {
      const res = await monday.api(`
        query {
          items(ids: [${itemId}]) {
            id name
            column_values { id type text value }
          }
          boards(ids: [${boardId}]) {
            columns { id title type settings_str }
          }
        }
      `, { apiVersion: "2024-01" });
      if (loadTokenRef.current !== token) return;
      if (res.errors?.length) throw new Error(res.errors[0].message);
      const fetchedItem = res.data?.items?.[0];
      const fetchedCols = res.data?.boards?.[0]?.columns ?? [];
      if (!fetchedItem) throw new Error("No se encontró el elemento.");
      setItem(fetchedItem);
      setBoardColumns(fetchedCols);
    } catch (err) {
      if (loadTokenRef.current !== token) return;
      console.error("[FolioItemView] Error:", err);
      setError("No se pudieron cargar los datos del registro.");
    } finally {
      if (loadTokenRef.current === token) setLoading(false);
    }
  };

  const handleSave = async (columnValues) => {
    const { boardId, itemId } = context;
    const colValsStr = JSON.stringify(columnValues);

    const res = await monday.api(`
      mutation {
        change_multiple_column_values(
          board_id: ${boardId},
          item_id: ${itemId},
          column_values: ${JSON.stringify(colValsStr)}
        ) { id }
      }
    `);

    if (res.errors?.length) {
      monday.execute("notice", {
        message: "Error al guardar: " + res.errors[0].message,
        type: "error", timeout: 4000,
      });
      throw new Error(res.errors[0].message);
    }

    monday.execute("notice", {
      message: "Cambios guardados correctamente",
      type: "success", timeout: 3000,
    });

    const token = Symbol();
    loadTokenRef.current = token;
    await loadItemData(boardId, itemId, token);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={
          context
            ? () => {
                const token = Symbol();
                loadTokenRef.current = token;
                loadItemData(context.boardId, context.itemId, token);
              }
            : null
        }
      />
    );
  }

  if (!item) {
    return (
      <div className="empty-state">
        Abre un elemento del tablero para ver su detalle.
      </div>
    );
  }

  // Resuelve los settings: usa los configurados si coinciden con este tablero,
  // de lo contrario auto-detecta las columnas por nombre y tipo.
  const effectiveSettings = resolveSettings(
    settings ?? {},
    boardColumns,
    item.column_values
  );

  return (
    <div className="app">
      {IS_DEV_MOCK && <DevBanner />}
      <KpiCards item={item} boardColumns={boardColumns} onSave={handleSave} settings={effectiveSettings} />
      <FolioSearch item={item} settings={effectiveSettings} />
      <ItemForm item={item} boardColumns={boardColumns} onSave={handleSave} />
    </div>
  );
}
