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
  const hasAny = prevItemId || nextItemId;
  if (!hasAny) return null;

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
  const [context, setContext]         = useState(null);
  const [item, setItem]               = useState(null);
  const [boardColumns, setBoardColumns] = useState([]);
  const [prevItemId, setPrevItemId]   = useState(null);
  const [nextItemId, setNextItemId]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Ref para evitar que una navegación lenta sobreescriba una más reciente
  const currentLoadRef = useRef(null);

  // ── 1. Escuchar el contexto de Monday — fuente única de verdad ──
  // Cuando el usuario abre otro ítem en el tablero, aplica un filtro o
  // navega en Monday, el SDK dispara este evento con el nuevo itemId.
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

  // ── 2. Reaccionar a cada cambio de contexto ──
  useEffect(() => {
    if (!context?.boardId || !context?.itemId) return;
    const token = Symbol();
    currentLoadRef.current = token;
    loadItemData(context.boardId, context.itemId, token);
    findAdjacentItems(context.boardId, context.itemId); // sin await — corre en paralelo
  }, [context]);

  // ── Carga de datos del ítem ──
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

      // Si mientras cargaba se inició otra navegación, descartar este resultado
      if (currentLoadRef.current !== token) return;

      if (res.errors?.length) throw new Error(res.errors[0].message);
      const fetchedItem = res.data?.items?.[0];
      const fetchedCols = res.data?.boards?.[0]?.columns ?? [];
      if (!fetchedItem) throw new Error("No se encontró el elemento.");
      setItem(fetchedItem);
      setBoardColumns(fetchedCols);
    } catch (err) {
      if (currentLoadRef.current !== token) return;
      console.error("[FolioItemView] Error cargando datos:", err);
      setError("No se pudieron cargar los datos del registro.");
    } finally {
      if (currentLoadRef.current === token) setLoading(false);
    }
  };

  // ── Búsqueda de ítems adyacentes con paginación cursor ──
  // Recorre el tablero página a página (100 ítems/página) hasta encontrar
  // el ítem actual — sin asumir un límite fijo. Respeta el orden del tablero.
  const findAdjacentItems = async (boardId, currentId) => {
    setPrevItemId(null);
    setNextItemId(null);
    const PAGE = 100;
    let cursor = null;
    let prevId = null;
    const target = String(currentId);

    try {
      for (let page = 0; page < 50; page++) { // máx 5 000 ítems como protección
        const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
        const res = await monday.api(`
          query {
            boards(ids: [${boardId}]) {
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
          const id = String(items[i].id);

          if (id === target) {
            // Ítem encontrado — el anterior ya lo tenemos en prevId
            setPrevItemId(prevId);

            // Siguiente: si es el último del bloque y hay más páginas, pedimos uno más
            if (i + 1 < items.length) {
              setNextItemId(String(items[i + 1].id));
            } else if (pageData?.cursor) {
              const nextRes = await monday.api(`
                query {
                  boards(ids: [${boardId}]) {
                    items_page(limit: 1, cursor: "${pageData.cursor}") {
                      items { id }
                    }
                  }
                }
              `);
              const first = nextRes.data?.boards?.[0]?.items_page?.items?.[0];
              setNextItemId(first ? String(first.id) : null);
            } else {
              setNextItemId(null);
            }
            return; // listo
          }

          prevId = id;
        }

        cursor = pageData?.cursor;
        if (!cursor) break; // fin del tablero
      }
    } catch {
      // silencioso — los botones simplemente no aparecen
    }
  };

  // ── Guardar cambios en Monday ──
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

    await loadItemData(boardId, itemId, currentLoadRef.current);
  };

  // ── Navegar a otro ítem ──
  // Llama al SDK de Monday para que abra el ítem nativo → Monday actualiza
  // el contexto → nuestro listener lo recibe → la vista se recarga sola.
  const handleNavigate = (itemId) => {
    monday.execute("openItemCard", { itemId: Number(itemId) });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={
          context
            ? () => loadItemData(context.boardId, context.itemId, currentLoadRef.current)
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
