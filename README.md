# V79 KPI Dashboard - Digicel St. Lucia Service Delivery

An enterprise-grade, browser-based operational dashboard designed specifically for **Digicel St. Lucia Service Delivery** to parse, clean, analyze, and visualize Konnexx job exports.

---

## 🌟 Key Features

- **Zero-Backend Architecture**: Runs 100% in client-side Vanilla JavaScript (ES6 Modules). No Node backend or external database required.
- **Instant Deployment**: Simply copy the root folder to any web server (Apache, Nginx, IIS, GitHub Pages, AWS S3, or local browser).
- **Multi-File Processing & Auto-Merge**: Drag and drop multiple `.csv` or `.xlsx` Konnexx job exports simultaneously. Files are merged automatically, deduplicating records by `Job Number`.
- **Automatic Data Sanitization**:
  - Trims white space & normalizes column headers.
  - Parses flexible date formats (`DD/MM/YYYY HH:mm:ss`, `YYYY-MM-DD`, Excel serials).
  - Detects anomalies (missing created dates, missing finish dates, negative durations).
  - Provides a comprehensive **Data Validation Health Audit Report**.
- **Department-Specific Metrics**:
  - **MTTI (Mean Time To Install)**: Dedicated analytics for `St. Lucia Installations`.
  - **MTTR (Mean Time To Repair)**: Dedicated analytics for `St. Lucia Fault Repair External`.
- **Top 10 KPI Cards**: Instant visibility into Total Jobs, Completed, Created, Confirmed, Open Jobs, Avg MTTI, Avg MTTR, Backlog, and SLA Attainment %.
- **Granular Global Filters**: Date range presets, Department, Engineer, Status, Region, Technology, Priority, Customer, Category, and Sub-Category.
- **Interactive Drill-Down Modals**: Click any KPI card, status pill, chart bar, or engineer row to inspect matching job details in a searchable modal.
- **Week-on-Week (WoW) Analytics**: Weekly comparisons with color-coded directional arrows (Green ↑/↓ for improvement, Red ↑/↓ for decline).
- **10 Animated Chart.js Visualizations**:
  1. Weekly MTTI Trend
  2. Weekly MTTR Trend
  3. Jobs Created vs Completed Volume
  4. Open Backlog Age Distribution (<24h, 24-48h, 2-7d, 7-30d, >30d)
  5. Status Share (Doughnut Chart)
  6. Engineer Completion Leaderboard (Horizontal Bar)
  7. Department Comparison
  8. Regional SLA Attainment
  9. Monthly Job Volume
  10. Rolling 7-Day & 30-Day Moving Average
- **Plain-English Executive Summary Generator**: Converts filter state into concise, executive-level narrative insights.
- **Multi-Format Export Engine**: Export filtered data to CSV, multi-tab Excel (`.xlsx`), PDF print report, or high-res PNG chart images.
- **TV Operations / NOC Mode**: Full-screen mode optimized for wall monitors in Operations rooms.
- **LocalStorage Auto-Save**: Persistent browser caching of ingested exports.

---

## 🚀 Installation & Deployment

### Option 1: Direct Web Server Deployment
1. Copy all project files and folders (`index.html`, `/css`, `/js`, `/assets`) to your web server's document root (e.g., `/var/www/html` or `public_html`).
2. Open the URL in any modern web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local Development with Vite
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`.

---

## 📁 File Structure

```
├── index.html                 # Main dashboard layout
├── css/
│   ├── style.css             # Base reset, theme variables, glassmorphism, TV mode
│   ├── dashboard.css         # Filters, table styles, modals, layout
│   └── cards.css             # Large KPI cards, status pills, scorecards
├── js/
│   ├── app.js                # App controller module
│   ├── upload.js             # Drag-and-drop & file parsing (PapaParse / SheetJS)
│   ├── parser.js             # Data cleaning, normalization & validation
│   ├── dashboard.js          # Core KPI card & table rendering
│   ├── filters.js            # Global filter state controller
│   ├── charts.js             # Chart.js visualization engine
│   ├── reports.js            # Executive summary & validation report generator
│   ├── export.js             # CSV, Excel XLSX, PDF, PNG export engine
│   ├── utils.js              # Date, duration & math utility functions
│   ├── mtti.js               # Mean Time To Install calculation module
│   └── mttr.js               # Mean Time To Repair calculation module
├── assets/
│   ├── sample_konnexx.csv    # Real April Konnexx sample dataset
│   └── sample-data.js        # Embedded sample module for instant load
└── README.md                 # System documentation
```

---

## 📊 How KPIs Are Calculated

### 1. MTTI (Mean Time To Install)
- **Scope**: Completed jobs where `Department` = `St. Lucia Installations`.
- **Formula**: `Date Finished` - `Date Created` (in Calendar Hours or Business Hours 8 AM - 5 PM).
- **SLA Target**: <= 48 Hours.

### 2. MTTR (Mean Time To Repair)
- **Scope**: Completed jobs where `Department` = `St. Lucia Fault Repair External`.
- **Formula**: `Date Finished` - `Date Created` (in Calendar Hours or Business Hours).
- **SLA Target**: <= 24 Hours.

### 3. Open Jobs & Backlog Aging
- **Scope**: Jobs with status `Created`, `Confirmed`, `Open`, `Pending`, `Manager Hold`, or `En Route`.
- **Formula**: `Reference Evaluation Date` (or Max Date in Export) - `Date Created`.
- **Age Buckets**: `<24h`, `24-48h`, `2-7 days`, `7-30 days`, `>30 days`.

---

## 🛠️ Troubleshooting & FAQs

- **Q: What file formats are supported?**
  - **A**: CSV (`.csv`) and Excel (`.xlsx`, `.xls`).
- **Q: What columns does the dashboard expect?**
  - **A**: Standard names (`Job Number`, `Department`, `Status`, `Engineer`, `Customer`, `Technology`, `Date Created`, `Date Finished`, `Region`, `Priority`, `Category`, `Sub Category`) OR raw Konnexx field names (`JobNumber`, `DepartmentName`, `JobStatusFull`, `Engineers`, `CustomerName`, `JobTypes`, `DateCreated`, `DateFinished`, `City`, `FailureType`, `FailureReason`). Unknown columns are safely ignored.
- **Q: How does deduplication work?**
  - **A**: If multiple uploaded files contain the same `Job Number`, the parser merges them automatically and retains the record with complete finish dates.

---

&copy; 2026 Digicel St. Lucia Service Delivery Operations
