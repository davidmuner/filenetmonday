import { useState, useEffect } from "react";

// Tipos que se pueden editar con un input
const EDITABLE_TYPES = new Set(["text", "numbers", "status", "date", "email", "link"]);

// Tipos que se omiten completamente del formulario
const HIDDEN_TYPES = new Set([
  "subtasks", "file", "formula", "auto_number",
  "creation_log", "last_updated", "button", "board_relation",
  "dependency", "mirror", "name",
]);

/**
 * Extrae el valor editable de una column_value para pre-llenar el form.
 */
function parseEditableValue(cv) {
  if (!cv.value) return "";
  try {
    const v = JSON.parse(cv.value);
    switch (cv.type) {
      case "status": return v.index !== undefined ? String(v.index) : "";
      case "date":   return v.date ?? "";
      case "email":  return v.email ?? "";
      case "link":   return v.url ?? "";
      default:       return typeof v === "string" ? v : String(v ?? "");
    }
  } catch {
    return cv.text ?? "";
  }
}

/**
 * Parsea settings_str de una columna status y devuelve array de opciones.
 * Formato raw API: { labels: {"0": "Label"}, labels_colors: {"0": {color, border}} }
 */
function parseStatusOptions(settingsStr) {
  try {
    const s = JSON.parse(settingsStr || "{}");
    const labels = s.labels || {};
    const colors = s.labels_colors || {};
    return Object.entries(labels).map(([idx, label]) => ({
      index: idx,
      label,
      color: colors[idx]?.color ?? "#0073ea",
    }));
  } catch {
    return [];
  }
}

export default function ItemForm({ item, boardColumns, onSave }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Inicializa el formulario cuando llega el item
  useEffect(() => {
    if (!item) return;
    const initial = { _name: item.name };
    item.column_values.forEach((cv) => {
      if (!HIDDEN_TYPES.has(cv.type)) {
        initial[cv.id] = parseEditableValue(cv);
      }
    });
    setValues(initial);
  }, [item]);

  const set = (id, val) =>
    setValues((prev) => ({ ...prev, [id]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSavedOk(false);

    // Construir el mapa de column_values para la mutation
    const columnValues = {};

    item.column_values.forEach((cv) => {
      if (!EDITABLE_TYPES.has(cv.type)) return;
      const raw = values[cv.id];
      if (raw === undefined || raw === "") return;

      switch (cv.type) {
        case "text":
          columnValues[cv.id] = raw;
          break;
        case "numbers":
          columnValues[cv.id] = String(raw);
          break;
        case "status":
          columnValues[cv.id] = { index: parseInt(raw, 10) };
          break;
        case "date":
          columnValues[cv.id] = { date: raw };
          break;
        case "email":
          columnValues[cv.id] = { email: raw, text: raw };
          break;
        case "link":
          columnValues[cv.id] = { url: raw, text: raw };
          break;
        default:
          break;
      }
    });

    try {
      await onSave(columnValues);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch {
      // El error ya se notifica en App.jsx vía monday.execute('notice')
    } finally {
      setSaving(false);
    }
  };

  // ─── Renderizado de campos por tipo ────────────────────────────────────────

  const renderField = (cv, boardCol) => {
    if (HIDDEN_TYPES.has(cv.type)) return null;

    const val = values[cv.id] ?? "";
    const isEditable = EDITABLE_TYPES.has(cv.type);

    if (!isEditable) {
      return (
        <div key={cv.id} className="form-field">
          <label className="form-label">{boardCol?.title ?? cv.id}</label>
          <div className="form-display">{cv.text || "—"}</div>
        </div>
      );
    }

    if (cv.type === "status") {
      const options = parseStatusOptions(boardCol?.settings_str);
      return (
        <div key={cv.id} className="form-field">
          <label className="form-label">{boardCol?.title ?? cv.id}</label>
          <select
            className="form-select"
            value={val}
            onChange={(e) => set(cv.id, e.target.value)}
          >
            <option value="">— Sin seleccionar —</option>
            {options.map((opt) => (
              <option key={opt.index} value={opt.index}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (cv.type === "date") {
      return (
        <div key={cv.id} className="form-field">
          <label className="form-label">{boardCol?.title ?? cv.id}</label>
          <input
            type="date"
            className="form-input"
            value={val}
            onChange={(e) => set(cv.id, e.target.value)}
          />
        </div>
      );
    }

    if (cv.type === "numbers") {
      return (
        <div key={cv.id} className="form-field">
          <label className="form-label">{boardCol?.title ?? cv.id}</label>
          <input
            type="number"
            className="form-input"
            value={val}
            onChange={(e) => set(cv.id, e.target.value)}
            step="any"
          />
        </div>
      );
    }

    if (cv.type === "email") {
      return (
        <div key={cv.id} className="form-field">
          <label className="form-label">{boardCol?.title ?? cv.id}</label>
          <input
            type="email"
            className="form-input"
            value={val}
            onChange={(e) => set(cv.id, e.target.value)}
          />
        </div>
      );
    }

    // text, link y cualquier otro tipo editable → input text
    return (
      <div key={cv.id} className="form-field">
        <label className="form-label">{boardCol?.title ?? cv.id}</label>
        <input
          type="text"
          className="form-input"
          value={val}
          onChange={(e) => set(cv.id, e.target.value)}
        />
      </div>
    );
  };

  const boardColMap = {};
  boardColumns?.forEach((bc) => {
    boardColMap[bc.id] = bc;
  });

  return (
    <div className="item-form">
      <h2 className="section-title">Datos del registro</h2>

      {/* Nombre del elemento (display — editarlo requiere mutation distinta) */}
      <div className="form-field form-field--full">
        <label className="form-label">Nombre del elemento</label>
        <div className="form-display form-display--name">
          {item?.name || "—"}
        </div>
      </div>

      <div className="form-grid">
        {item?.column_values?.map((cv) => {
          const boardCol = boardColMap[cv.id];
          return renderField(cv, boardCol);
        })}
      </div>

      <div className="form-actions">
        <button
          className={`btn-save${saving ? " btn-save--loading" : ""}${savedOk ? " btn-save--success" : ""}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando…" : savedOk ? "✓ Guardado" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
