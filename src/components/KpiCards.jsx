import { useEffect, useState } from "react";
import { KPI_COLUMNS, PIPELINE_STATUS, SUBTITLE_COLUMN_ID } from "../config";

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

export default function KpiCards({ item, boardColumns, onSave }) {
  const [visible, setVisible] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false); // guardando estado
  const [savedOk, setSavedOk] = useState(false);           // feedback éxito

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Índices O(1)
  const colValueMap = {};
  item?.column_values?.forEach((cv) => { colValueMap[cv.id] = cv; });

  const boardColMap = {};
  boardColumns?.forEach((bc) => { boardColMap[bc.id] = bc; });

  // Subtítulo desde columna configurable
  const subtitleValue = SUBTITLE_COLUMN_ID
    ? colValueMap[SUBTITLE_COLUMN_ID]?.text?.trim() ?? null
    : null;

  // KPI cards
  const cards = KPI_COLUMNS.map((kpi) => {
    const cv = colValueMap[kpi.id];
    if (!cv) return null;
    const boardCol = boardColMap[kpi.id];
    const isStatus = cv.type === "status";
    const accentColor = isStatus
      ? getStatusColor(cv, boardCol)
      : kpi.color ?? "#0073ea";
    return { ...kpi, cv, accentColor, isStatus };
  }).filter(Boolean);

  // Estado del pipeline
  const statusCv = colValueMap[PIPELINE_STATUS.columnId];
  const currentStatusLabel = statusCv?.text?.trim().toLowerCase() ?? "";

  const handleStatusClick = async (opt) => {
    if (!onSave || savingStatus) return;
    const boardCol = boardColMap[PIPELINE_STATUS.columnId];
    const index = findStatusIndex(opt.label, boardCol);
    if (index === null) return;
    setSavingStatus(true);
    setSavedOk(false);
    try {
      await onSave({ [PIPELINE_STATUS.columnId]: { index } });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } finally {
      setSavingStatus(false);
    }
  };

  if (!cards.length) return null;

  return (
    <div className={`kpi-section${visible ? " kpi-section--visible" : ""}`}>
      {/* Nombre e ítem */}
      <div className="kpi-header">
        <h1 className="kpi-item-name">{item?.name ?? ""}</h1>
        {subtitleValue && (
          <p className="kpi-item-subtitle">{subtitleValue}</p>
        )}
      </div>

      {/* Grid 2×2 de KPI cards */}
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
      {PIPELINE_STATUS.options.length > 0 && (
        <div className="pipeline-status">
          <div className="pipeline-status__header">
            <p className="pipeline-status__title">
              {PIPELINE_STATUS.sectionLabel}
            </p>
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
            {PIPELINE_STATUS.options.map((opt) => {
              const isActive = currentStatusLabel === opt.label.toLowerCase();
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
