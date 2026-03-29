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
      // Los campos Column devuelven el ID directamente como string.
      // Si por alguna razón devuelven un objeto, extraemos el ID.
      const raw = res.data ?? {};
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [
          k,
          v && typeof v === "object" && !Array.isArray(v) ? (v.id ?? v.columnId ?? String(v)) : v,
        ])
      );
      setSettings(normalized);
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
      `);
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

  return (
    <div className="app">
      {IS_DEV_MOCK && <DevBanner />}
      <KpiCards item={item} boardColumns={boardColumns} onSave={handleSave} settings={settings} />
      <FolioSearch item={item} settings={settings} />
      <ItemForm item={item} boardColumns={boardColumns} onSave={handleSave} />
    </div>
  );
}
