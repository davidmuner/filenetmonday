import { useState, useEffect } from "react";
import mondaySdk from "monday-sdk-js";
import KpiCards from "./components/KpiCards";
import ItemForm from "./components/ItemForm";
import FolioSearch from "./components/FolioSearch";
import "./styles/global.css";

// El SDK se inicializa UNA sola vez fuera del componente
const monday = mondaySdk();

// ─── Dev mock (Opción A) ──────────────────────────────────────────────────────
// En producción (dentro de Monday) estas variables están vacías → no tienen efecto.
// En local, define VITE_DEV_BOARD_ID, VITE_DEV_ITEM_ID y VITE_DEV_API_TOKEN en .env.local.
const IS_DEV_MOCK =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_BOARD_ID &&
  import.meta.env.VITE_DEV_ITEM_ID;

// Inyectar el token personal para que monday.api() funcione fuera del iframe
if (IS_DEV_MOCK && import.meta.env.VITE_DEV_API_TOKEN) {
  monday.setToken(import.meta.env.VITE_DEV_API_TOKEN);
}

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

// ─── Skeletons ───────────────────────────────────────────────────────────────

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
  const [context, setContext] = useState(null);
  const [item, setItem] = useState(null);
  const [boardColumns, setBoardColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Contexto: mock local (dev) o SDK real (producción Monday) ──
  useEffect(() => {
    if (IS_DEV_MOCK) {
      // Opción A — inyectar contexto desde .env.local sin necesitar Monday
      setContext({
        boardId: import.meta.env.VITE_DEV_BOARD_ID,
        itemId:  import.meta.env.VITE_DEV_ITEM_ID,
      });
      return;
    }

    // Opción B / Producción — SDK real de Monday
    monday.listen("context", (res) => {
      const { boardId, itemId } = res.data ?? {};
      if (boardId && itemId) {
        setContext({ boardId: String(boardId), itemId: String(itemId) });
      }
    });
  }, []);

  // ── Cargar datos cada vez que cambia el contexto ──
  useEffect(() => {
    if (context?.boardId && context?.itemId) {
      loadItemData(context.boardId, context.itemId);
    }
  }, [context]);

  // ── Query GraphQL: item + columnas del tablero en una sola llamada ──
  const loadItemData = async (boardId, itemId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await monday.api(`
        query {
          items(ids: [${itemId}]) {
            id
            name
            column_values {
              id
              type
              text
              value
            }
          }
          boards(ids: [${boardId}]) {
            columns {
              id
              title
              type
              settings_str
            }
          }
        }
      `);

      if (res.errors?.length) {
        throw new Error(res.errors[0].message);
      }

      const fetchedItem = res.data?.items?.[0];
      const fetchedCols = res.data?.boards?.[0]?.columns ?? [];

      if (!fetchedItem) throw new Error("No se encontró el elemento.");

      setItem(fetchedItem);
      setBoardColumns(fetchedCols);
    } catch (err) {
      console.error("[FolioItemView] Error cargando datos:", err);
      setError("No se pudieron cargar los datos del registro.");
    } finally {
      setLoading(false);
    }
  };

  // ── Mutación: guardar cambios en las columnas del ítem ──
  const handleSave = async (columnValues) => {
    const { boardId, itemId } = context;

    // Monday espera column_values como string JSON escapado dentro del GQL
    const colValsStr = JSON.stringify(columnValues);

    const res = await monday.api(`
      mutation {
        change_multiple_column_values(
          board_id: ${boardId},
          item_id: ${itemId},
          column_values: ${JSON.stringify(colValsStr)}
        ) {
          id
        }
      }
    `);

    if (res.errors?.length) {
      monday.execute("notice", {
        message: "Error al guardar: " + res.errors[0].message,
        type: "error",
        timeout: 4000,
      });
      throw new Error(res.errors[0].message);
    }

    monday.execute("notice", {
      message: "Cambios guardados correctamente",
      type: "success",
      timeout: 3000,
    });

    // Refrescar los datos para mostrar los valores actualizados
    await loadItemData(boardId, itemId);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={
          context
            ? () => loadItemData(context.boardId, context.itemId)
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

      {/* 1. KPI Cards — parte superior con animación */}
      <KpiCards item={item} boardColumns={boardColumns} onSave={handleSave} />

      {/* 2. Consulta externa por número de folio */}
      <FolioSearch item={item} />

      {/* 3. Formulario editable con todos los campos */}
      <ItemForm
        item={item}
        boardColumns={boardColumns}
        onSave={handleSave}
      />
    </div>
  );
}
