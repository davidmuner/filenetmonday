// config.js
// Este archivo ya NO se importa en producción.
// Los valores de configuración vienen de monday.get("settings") en runtime.
//
// Para desarrollo local (IS_DEV_MOCK), los valores equivalentes
// están definidos como DEV_MOCK_SETTINGS en App.jsx.
//
// ─── Settings a definir en el Developer Center de Monday ──────────────────────
//
//   folio_column_id      column-picker   Columna que contiene el número de folio
//   folio_api_url        text            Webhook URL de Make.com
//   subtitle_column_id   column-picker   Columna de subtítulo (opcional)
//   kpi_col_1            column-picker   KPI 1
//   kpi_col_2            column-picker   KPI 2
//   kpi_col_3            column-picker   KPI 3
//   kpi_col_4            column-picker   KPI 4
//   pipeline_status_col  column-picker   Columna de estado del pipeline (type: status)
