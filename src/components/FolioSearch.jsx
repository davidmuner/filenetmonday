import { useState, useEffect, useCallback } from "react";
import { FOLIO_API_URL, FOLIO_COLUMN_ID, API_VISIBLE_FIELDS } from "../config";

/**
 * Normaliza el valor de un campo de la respuesta API para mostrarlo legible.
 */
function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Un campo individual clave → valor de la respuesta API.
 */
function ResultField({ label, value, highlight }) {
  return (
    <div className={`result-field${highlight ? " result-field--highlight" : ""}`}>
      <span className="result-key">{label}</span>
      <span className="result-value">{formatValue(value)}</span>
    </div>
  );
}

export default function FolioSearch({ item }) {
  const [folio, setFolio] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // objeto plano con los datos
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const search = useCallback(async (query) => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setExpanded(false);

    try {
      const res = await fetch(
        `${FOLIO_API_URL}?folio=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Aceptamos tanto un objeto plano como el primer elemento de un array
      const normalized = Array.isArray(data) ? data[0] : data;
      if (!normalized || typeof normalized !== "object") {
        throw new Error("Respuesta inesperada del servidor.");
      }
      setResult(normalized);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "No se pudo conectar al servidor. Verifica tu conexión."
          : `Error al consultar el folio: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fill y auto-búsqueda cuando el ítem tiene valor en la columna de folio
  useEffect(() => {
    if (!item) return;
    const cv = item.column_values?.find((c) => c.id === FOLIO_COLUMN_ID);
    const value = cv?.text?.trim();
    if (!value) return;
    setFolio(value);
    search(value);
  }, [item, search]);

  const handleSearch = () => search(folio);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // ─── Dividir resultado en visible / oculto ─────────────────────────────────
  const entries = result ? Object.entries(result) : [];
  const visibleEntries = entries.slice(0, API_VISIBLE_FIELDS);
  const hiddenEntries = entries.slice(API_VISIBLE_FIELDS);
  const hasMore = hiddenEntries.length > 0;

  return (
    <div className="folio-search">
      <h2 className="section-title">Consulta por número de folio</h2>

      <div className="search-row">
        <input
          type="text"
          className="form-input search-input"
          placeholder="Ingresa el número de folio…"
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="btn-search"
          onClick={handleSearch}
          disabled={loading || !folio.trim()}
        >
          {loading ? (
            <span className="search-spinner" aria-label="Buscando…" />
          ) : (
            "Buscar"
          )}
        </button>
      </div>

      {error && (
        <div className="search-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="search-result">
          {/* Primeros N campos — siempre visibles y destacados */}
          <div className="result-fields result-fields--primary">
            {visibleEntries.map(([key, value]) => (
              <ResultField key={key} label={key} value={value} highlight />
            ))}
          </div>

          {/* Campos adicionales con acordeón animado */}
          {hasMore && (
            <>
              <div
                className={`result-hidden${expanded ? " result-hidden--open" : ""}`}
                aria-hidden={!expanded}
              >
                <div className="result-fields">
                  {hiddenEntries.map(([key, value]) => (
                    <ResultField key={key} label={key} value={value} />
                  ))}
                </div>
              </div>

              <button
                className="btn-toggle"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                <span
                  className={`btn-toggle__chevron${expanded ? " btn-toggle__chevron--up" : ""}`}
                />
                {expanded
                  ? `Ver menos ▲`
                  : `Ver más detalles (${hiddenEntries.length}) ▼`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
