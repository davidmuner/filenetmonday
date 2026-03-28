import { useState, useEffect } from "react";
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

// ─── Item Navigator ───────────────────────────────────────────────────────────

function ChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ItemNavigator({ allItems, currentItemId, onNavigate, loading }) {
  if (!allItems.length) return null;

  const idx = allItems.findIndex((i) => i.id === String(currentItemId));
  const total = allItems.length;
  const hasPrev = idx > 0;
  const hasNext = idx < total - 1;

  return (
    <div className="item-nav">
      <span className="item-nav__pos">
        {idx >= 0 ? `${idx + 1} / ${total}` : `— / ${total}`}
      </span>
      <div className="item-nav__divider" />
      <button
        className="item-nav__btn"
        disabled={!hasPrev || loading}
        onClick={() => hasPrev && onNavigate(allItems[idx - 1].id)}
        title="Item anterior"
        aria-label="Item anterior"
      >
        <ChevronUp />
      </button>
      <button
        className="item-nav__btn"
        disabled={!hasNext || loading}
        onClick={() => hasNext && onNavigate(allItems[idx + 1].id)}
        title="Item siguiente"
        aria-label="Item siguiente"
      >
        <ChevronDown />
      </button>
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
  const [item, setItem]                 = useState(null);
  const [boardColumns, setBoardColumns] = useState([]);
  const [allItems, setAllItems]         = useState([]);
  const [currentItemId, setCurrentItemId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  // ── 1. Contexto desde Monday SDK o mock de desarrollo ──
  useEffect(() => {
    if (IS_DEV_MOCK) {
      setContext({
        boardId: import.meta.env.VITE_DEV_BOARD_ID,
        itemId:  import.meta.env.VITE_DEV_ITEM_ID,
      });
      return;
    }
    monday.listen("context", (res) => {
      const { boardId, itemId } = res.data ?? {};
      if (boardId && itemId) {
        setContext({ boardId: String(boardId), itemId: String(itemId) });
      }
    });
  }, []);

  // ── 2. Al recibir el contexto: fijar item inicial y cargar lista de navegación ──
  useEffect(() => {
    if (!context?.boardId || !context?.itemId) return;
    setCurrentItemId(String(context.itemId));
    loadBoardItemIds(context.boardId);
  }, [context]);

  // ── 3. Cargar datos del item cada vez que cambia el item actual ──
  useEffect(() => {
    if (context?.boardId && currentItemId) {
      loadItemData(context.boardId, currentItemId);
    }
  }, [currentItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carga ligera: solo IDs y nombres para el navegador ──
  const loadBoardItemIds = async (boardId) => {
    try {
      const res = await monday.api(`
        query {
          boards(ids: [${boardId}]) {
            items_page(limit: 500) {
              items { id name }
            }
          }
        }
      `);
      const items = res.data?.boards?.[0]?.items_page?.items ?? [];
      setAllItems(items.map((i) => ({ id: String(i.id), name: i.name })));
    } catch {
      // silencioso — la navegación simplemente no aparece
    }
  };

  // ── Query completa: item + columnas del tablero ──
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

      if (res.errors?.length) throw new Error(res.errors[0].message);

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

  // ── Mutación: guardar cambios usando el item actualmente visible ──
  const handleSave = async (columnValues) => {
    const { boardId } = context;
    const colValsStr = JSON.stringify(columnValues);

    const res = await monday.api(`
      mutation {
        change_multiple_column_values(
          board_id: ${boardId},
          item_id: ${currentItemId},
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

    await loadItemData(boardId, currentItemId);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={
          currentItemId
            ? () => loadItemData(context.boardId, currentItemId)
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

      {/* Navegador de ítems — esquina superior derecha */}
      <ItemNavigator
        allItems={allItems}
        currentItemId={currentItemId}
        onNavigate={setCurrentItemId}
        loading={loading}
      />

      {/* 1. KPI Cards */}
      <KpiCards item={item} boardColumns={boardColumns} onSave={handleSave} />

      {/* 2. Consulta externa por folio */}
      <FolioSearch item={item} />

      {/* 3. Formulario editable */}
      <ItemForm item={item} boardColumns={boardColumns} onSave={handleSave} />
    </div>
  );
}
