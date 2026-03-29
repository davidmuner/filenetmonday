import { useEffect, useState } from "react";

// Colores e íconos por defecto para cada posición KPI (1-4)
const KPI_COLORS   = ["#0073ea", "#e67e22", "#9b59b6", "#00c875"];
const KPI_ICONS    = ["status", "person", "percent", "money"];

/**
 * Intenta derivar un ícono apropiado según el tipo de columna de Monday.
 */
function guessIcon(type) {
  const map = {
    status: "status",
    color:  "status",
    numbers: "money",
    date:   "calendar",
    people: "person",
    text:   "tag",
  };
  return map[type] ?? "tag";
}

/**
 * Deriva las opciones del pipeline a partir del settings_str de la columna status.
 */
function derivePipelineOptions(boardCol) {
  if (!boardCol?.settings_str) return [];
  try {
    const s = JSON.parse(boardCol.settings_str);
    return Object.entries(s.labels ?? {}).map(([idx, label]) => ({
      label,
      icon:  getPipelineIcon(label),
      color: s.labels_colors?.[idx]?.color ?? "#0073ea",
    }));
  } catch {
    return [];
  }
}

function getPipelineIcon(label) {
  const l = label.toLowerCase();
  if (l.includes("pend") || l.includes("progres") || l.includes("proceso")) return "clock";
  if (l.includes("gan") || l.includes("win") || l.includes("done") || l.includes("complet")) return "check";
  if (l.includes("perd") || l.includes("lost") || l.includes("cancel") || l.includes("fail")) return "x";
  return "status";
}

/**
 * Busca el index numérico de Monday para un label de estado dado,
 * parseando el settings_str de la columna status.
 */
function findStatusIndex(label, boardCol) {
  if (!boardCol?.settings_str) return null;
  try {
    const settings = JSON.parse(boardCol.settings_str);
    const entry = Object.entries(settings.labels ?? {}).find(
      ([, l]) => l.toLowerCase() === label.toLowerCase()
    );
    return entry ? parseInt(entry[0], 10) : null;
  } catch {
    return null;
  }
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function Icon({ name, size = 18, color = "currentColor" }) {
  const paths = {
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    person: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    money: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    percent: (
      <>
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </>
    ),
    status: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    tag: (
      <>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? null}
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusColor(columnValue, boardColumn) {
  if (!columnValue?.value || !boardColumn?.settings_str) return "#0073ea";
  try {
    const val = JSON.parse(columnValue.value);
    const settings = JSON.parse(boardColumn.settings_str);
    const idx = String(val.index);
    if (settings.labels_colors?.[idx]?.color) {
      return settings.labels_colors[idx].color;
    }
  } catch {
    // silencioso
  }
  return "#0073ea";
}

function formatKpiValue(cv) {
  if (!cv) return "—";
  return cv.text?.trim() || "—";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function KpiCards({ item, boardColumns, onSave, settings }) {
  const [visible, setVisible] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Índices O(1)
  const colValueMap = {};
  item?.column_values?.forEach((cv) => { colValueMap[cv.id] = cv; });

  const boardColMap = {};
  boardColumns?.forEach((bc) => { boardColMap[bc.id] = bc; });

  // Subtítulo desde columna configurada en settings
  const subtitleValue = settings.subtitle_column_id
    ? colValueMap[settings.subtitle_column_id]?.text?.trim() ?? null
    : null;

  // KPI cards derivadas de settings + títulos del tablero
  const kpiColumnIds = [
    settings.kpi_col_1,
    settings.kpi_col_2,
    settings.kpi_col_3,
    settings.kpi_col_4,
  ];

  const cards = kpiColumnIds
    .map((colId, i) => {
      if (!colId) return null;
      const cv = colValueMap[colId];
      if (!cv) return null;
      const boardCol = boardColMap[colId];
      const isStatus = cv.type === "status";
      const icon = guessIcon(boardCol?.type) ?? KPI_ICONS[i];
      const accentColor = isStatus
        ? getStatusColor(cv, boardCol)
        : KPI_COLORS[i];
      return {
        id:    colId,
        label: boardCol?.title ?? colId,
        icon,
        accentColor,
        isStatus,
        cv,
      };
    })
    .filter(Boolean);

  // Pipeline status derivado de settings + settings_str de la columna
  const pipelineColumnId = settings.pipeline_status_col;
  const pipelineBoardCol = boardColMap[pipelineColumnId];
  const pipelineOptions  = derivePipelineOptions(pipelineBoardCol);
  const pipelineLabel    = pipelineBoardCol?.title ?? "Estado del Pipeline";

  const statusCv = colValueMap[pipelineColumnId];
  const currentStatusLabel = statusCv?.text?.trim().toLowerCase() ?? "";

  const handleStatusClick = async (opt) => {
    if (!onSave || savingStatus) return;
    const index = findStatusIndex(opt.label, pipelineBoardCol);
    if (index === null) return;
    setSavingStatus(true);
    setSavedOk(false);
    try {
      await onSave({ [pipelineColumnId]: { index } });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } finally {
      setSavingStatus(false);
    }
  };

  // Siempre mostrar el encabezado aunque no haya cards configuradas
  if (!cards.length && !item?.name) return null;

  return (
    <div className={`kpi-section${visible ? " kpi-section--visible" : ""}`}>
      {/* Nombre e ítem — siempre visible */}
      <div className="kpi-header">
        <h1 className="kpi-item-name">{item?.name ?? ""}</h1>
        {subtitleValue && (
          <p className="kpi-item-subtitle">{subtitleValue}</p>
        )}
      </div>

      {/* Grid 2×2 de KPI cards — solo si hay columnas configuradas */}
      {!cards.length && (
        <p className="kpi-empty-hint">
          Configura los indicadores en los ajustes de la app para ver las métricas del ítem.
        </p>
      )}
      <div className="kpi-grid">
        {cards.map((card, i) => (
          <div
            key={card.id}
            className="kpi-card"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div
              className="kpi-card__icon"
              style={{
                color: card.accentColor,
                background: `${card.accentColor}1a`,
              }}
            >
              <Icon name={card.icon} size={18} color={card.accentColor} />
            </div>
            <span className="kpi-card__label">{card.label}</span>
            <span
              className="kpi-card__value"
              style={card.isStatus ? { color: card.accentColor } : undefined}
            >
              {formatKpiValue(card.cv)}
            </span>
          </div>
        ))}
      </div>

      {/* Estado del pipeline */}
      {pipelineOptions.length > 0 && (
        <div className="pipeline-status">
          <div className="pipeline-status__header">
            <p className="pipeline-status__title">{pipelineLabel}</p>
            {savingStatus && (
              <span className="ps-saving">
                <span className="search-spinner" />
              </span>
            )}
            {savedOk && (
              <span className="ps-saved">
                <Icon name="check" size={13} color="#00c875" /> Guardado
              </span>
            )}
          </div>

          <div className="pipeline-status__options">
            {pipelineOptions.map((opt) => {
              const isActive   = currentStatusLabel === opt.label.toLowerCase();
              const isDisabled = savingStatus;
              return (
                <button
                  key={opt.label}
                  className={`ps-opt${isActive ? " ps-opt--active" : ""}${isDisabled ? " ps-opt--disabled" : ""}`}
                  onClick={() => handleStatusClick(opt)}
                  disabled={isDisabled}
                  title={isActive ? opt.label : `Cambiar a ${opt.label}`}
                >
                  <div
                    className="ps-opt__circle"
                    style={
                      isActive
                        ? { background: opt.color, borderColor: opt.color }
                        : undefined
                    }
                  >
                    <Icon
                      name={opt.icon}
                      size={22}
                      color={isActive ? "#fff" : "#c5c7d4"}
                    />
                  </div>
                  <span
                    className="ps-opt__label"
                    style={isActive ? { color: opt.color, fontWeight: 700 } : undefined}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
