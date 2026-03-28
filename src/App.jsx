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

function ItemNavigator({ prevItemId, nextItemId, onNavigate, loading }) {
  if (!prevItemId && !nextItemId) return null;

  return (
    <div className="item-nav">
      <button
        className="item-nav__btn"
        disabled={!prevItemId || loading}
        onClick={() => prevItemId && onNavigate(prevItemId)}
        title="Item anterior"
        aria-label="Item anterior"
      >
        <ChevronUp />
      </button>
      <button
        className="item-nav__btn"
        disabled={!nextItemId || loading}
        onClick={() => nextItemId && onNavigate(nextItemId)}
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
  const [boardId, setBoardId]           = useState(null);
  const [currentItemId, setCurrentItemId] = useState(null);
  const [item, setItem]                 = useState(null);
  const [boardColumns, setBoardColumns] = useState([]);
  const [prevItemId, setPrevItemId]     = useState(null);
  const [nextItemId, setNextItemId]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  // Protección ante race conditions de cargas concurrentes
  const loadTokenRef = useRef(null);

  // ── 1. Escuchar contexto de Monday ──────────────────────────────────────────
  // Cuando Monday cambia el ítem activo (filtro, selección externa, etc.)
  // este listener dispara y actualiza currentItemId.
  useEffect(() => {
    if (IS_DEV_MOCK) {
      setBoardId(import.meta.env.VITE_DEV_BOARD_ID);
      setCurrentItemId(import.meta.env.VITE_DEV_ITEM_ID);
      return;
    }
    monday.listen("context", (res) => {
      const { boardId: bid, itemId: iid } = res.data ?? {};
      if (bid) setBoardId(String(bid));
      if (iid) setCurrentItemId(String(iid));
    });
  }, []);

  // ── 2. Cargar datos cada vez que cambia el ítem actual ──────────────────────
  useEffect(() => {
    if (!boardId || !currentItemId) return;
    const token = Symbol();
    loadTokenRef.current = token;
    // Carga de datos e ítems adyacentes en paralelo
    loadItemData(boardId, currentItemId, token);
    findAdjacentItems(boardId, currentItemId);
  }, [boardId, currentItemId]);

  // ── Carga completa del ítem ──────────────────────────────────────────────────
  const loadItemData = async (bid, itemId, token) => {
    setLoading(true);
    setError(null);
    try {
      const res = await monday.api(`
        query {
          items(ids: [${itemId}]) {
            id name
            column_values { id type text value }
          }
          boards(ids: [${bid}]) {
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

  // ── Busca el ítem anterior y siguiente con paginación cursor ─────────────────
  // Recorre el tablero de 100 en 100 sin asumir ningún límite total.
  const findAdjacentItems = async (bid, targetId) => {
    setPrevItemId(null);
    setNextItemId(null);
    const PAGE = 100;
    let cursor = null;
    let prevId = null;
    const target = String(targetId);

    try {
      for (;;) {
        const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
        const res = await monday.api(`
          query {
            boards(ids: [${bid}]) {
              items_page(limit: ${PAGE}${cursorArg}) {
                cursor
                items { id }
              }
            }
          }
        `);

        const pageData = res.data?.boards?.[0]?.items_page;
        const items    = pageData?.items ?? [];

        for (let i = 0; i < items.length; i++) {
          if (String(items[i].id) === target) {
            setPrevItemId(prevId);

            if (i + 1 < items.length) {
              setNextItemId(String(items[i + 1].id));
            } else if (pageData?.cursor) {
              // El ítem actual es el último de esta página — pedir uno de la siguiente
              const nextRes = await monday.api(`
                query {
                  boards(ids: [${bid}]) {
                    items_page(limit: 1, cursor: "${pageData.cursor}") {
                      items { id }
                    }
                  }
                }
              `);
              const first = nextRes.data?.boards?.[0]?.items_page?.items?.[0];
              setNextItemId(first ? String(first.id) : null);
            }
            return;
          }
          prevId = String(items[i].id);
        }

        cursor = pageData?.cursor;
        if (!cursor) break;
      }
    } catch {
      // silencioso — los botones no aparecen si falla
    }
  };

  // ── Navegación interna — cambia estado sin llamar al SDK ────────────────────
  const handleNavigate = (itemId) => {
    setCurrentItemId(String(itemId));
  };

  // ── Guardar cambios ──────────────────────────────────────────────────────────
  const handleSave = async (columnValues) => {
    const colValsStr = JSON.stringify(columnValues);
    const res = await monday.api(`
      mutation {
        change_multiple_column_values(
          board_id: ${boardId},
          item_id: ${currentItemId},
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
    await loadItemData(boardId, currentItemId, token);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          const token = Symbol();
          loadTokenRef.current = token;
          loadItemData(boardId, currentItemId, token);
        }}
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

      <ItemNavigator
        prevItemId={prevItemId}
        nextItemId={nextItemId}
        onNavigate={handleNavigate}
        loading={loading}
      />

      <KpiCards item={item} boardColumns={boardColumns} onSave={handleSave} />
      <FolioSearch item={item} />
      <ItemForm item={item} boardColumns={boardColumns} onSave={handleSave} />
    </div>
  );
}
