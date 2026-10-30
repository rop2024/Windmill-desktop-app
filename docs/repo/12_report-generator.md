# Report Generator — System Execution Report

## Summary

**Report Generator is not implemented in this codebase.**

There is no system that turns internal data into shareable, polished output documents. The codebase has no PDF export, no HTML report generation, no Markdown export, and no report templates (Weekly Chess Report, Monthly Progress, Opening Report, Tournament Summary). Data is viewed only inside the Electron UI.

This report documents:
1. What the Report Generator system should do (per the specification).
2. What analysis infrastructure actually exists today that could feed it.
3. What is missing and would need to be built.

---

## 1. Report Generator Specification

| Capability | Purpose |
|---|---|
| Export formats: PDF | Render reports to PDF for sharing/printing |
| Export formats: HTML | Render reports to HTML for web viewing |
| Export formats: Markdown | Render reports to Markdown for notes/docs |
| Weekly Chess Report | Past week's games, blunders, rating change, key insights |
| Monthly Progress | Month-over-month rating trend, accuracy, win rate |
| Opening Report | Opening performance, win %, mistakes per opening |
| Tournament Summary | Tournament results, performance rating, key games |

### Expected execution flow

```
Internal data (games, analysis, weaknesses, stats)  ──►  Report Generator
                                                                │
                                                                ▼
                                                    Select report type + date range
                                                                │
                                                                ▼
                                                    Aggregate data + render template
                                                                │
                                                                ▼
                                                    Export to PDF / HTML / Markdown
```

---

## 2. What Exists in the System Today

### A. Statistics Aggregation — IMPLEMENTED (partial data source)
- **File:** `src/main/services/statistics/StatisticsService.ts`
- **Purpose:** Win rates, ratings, streaks, openings, opponents, time controls, calendar
- **Limitation:** Data is consumed only by the in-app Statistics page; no export or report rendering.

### B. Per-Game Analysis — IMPLEMENTED (partial data source)
- **Files:** `src/main/services/stockfish/AnalysisQueue.ts`, `AnalysisRepository.ts`
- **Purpose:** Per-ply eval, classification, accuracy
- **Limitation:** Stored per-game; no report assembly.

### C. Game Storage — IMPLEMENTED (raw material)
- **File:** `src/main/services/database/connection.ts`, `GameRepository.ts`
- **Purpose:** `chess.db` with all games, PGN, results, metadata
- **Limitation:** No query/report assembly layer on top.

---

## 3. What Is Missing

The following capabilities from the specification are **not implemented**:

| Capability | Status | Notes |
|---|---|---|
| Export: PDF | ❌ Missing | No PDF generation library or code |
| Export: HTML | ❌ Missing | No HTML report rendering |
| Export: Markdown | ❌ Missing | No Markdown report rendering |
| Weekly Chess Report | ❌ Missing | No weekly report template or assembly |
| Monthly Progress | ❌ Missing | No monthly progress report |
| Opening Report | ❌ Missing | No opening-specific report |
| Tournament Summary | ❌ Missing | No tournament summary report |
| Report Generator UI | ❌ Missing | No export page, no report selection |
| Report templates | ❌ Missing | No template system for any report type |

---

## 4. Where the Pieces Would Live (if built)

If Report Generator were implemented, the natural integration points are:

- **Route:** `/reports` nested inside `AppLayout` (like Statistics, Games, Sync)
- **Service:** `src/main/services/report/ReportGenerator.ts` — queries data, renders templates, exports files
- **Export libraries:** PDF (`pdfkit` or `puppeteer`), HTML (template strings), Markdown (string building)
- **Report templates:** Weekly report, monthly progress, opening report, tournament summary — each with defined sections and data requirements
- **File output:** Saved to user's downloads or documents directory via Electron `dialog.showSaveDialog`
- **IPC channel:** `report.generate` / `report.list` in `src/main/ipc/index.ts`
- **Renderer API:** `window.api.report.{generate, list}` in `src/preload/index.ts`

---

## 5. Execution Verdict

**Report Generator does not execute in this system.** The only adjacent operations that run are:

1. `StatisticsService.*()` — read-only statistics (no export)
2. `AnalysisRepository.getAnalysisForGame()` — per-game analysis data (no report assembly)
3. Game storage in `chess.db` (raw material only)

No PDF, HTML, or Markdown export exists. No report templates exist. No Report Generator UI exists. Nothing turns internal data into shareable, polished output documents.
