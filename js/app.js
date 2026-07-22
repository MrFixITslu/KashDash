/**
 * Main Application Controller for V79 KPI Dashboard
 */
import { UploadManager } from './upload.js';
import { FilterController } from './filters.js';
import { dashboardManager } from './dashboard.js';
import { exportEngine } from './export.js';

class App {
  constructor() {
    this.uploadManager = null;
    this.filterController = null;
    this.parsedData = null;
    this.isTvMode = false;
  }

  init() {
    console.log('Initializing V79 KPI Dashboard...');

    // 1. Initialize Upload Manager
    this.uploadManager = new UploadManager((parsedResult) => {
      this.handleNewDataParsed(parsedResult);
    });
    this.uploadManager.init();

    // 2. Initialize Filter Controller
    this.filterController = new FilterController((filterState) => {
      this.handleFiltersChanged(filterState);
    });
    this.filterController.bindEvents();

    // 3. Setup UI Control Buttons (Export, TV Mode, Tabs, Theme)
    this.bindGlobalUIEvents();
    dashboardManager.bindDOMListeners();

    // 4. Load initial data (cached or sample dataset)
    const hasCache = this.uploadManager.loadCachedData();
    if (!hasCache) {
      this.uploadManager.loadSampleData();
    }
  }

  /**
   * Callback when new file data is parsed
   */
  handleNewDataParsed(parsedResult) {
    this.parsedData = parsedResult;

    // Populate dynamic filter options
    this.filterController.populateOptions(parsedResult.jobs);

    // Initialize Dashboard
    dashboardManager.init(parsedResult);

    // Filter and render
    const filteredJobs = this.filterController.filterJobs(parsedResult.jobs);
    dashboardManager.render(filteredJobs);
  }

  /**
   * Callback when global filters change
   */
  handleFiltersChanged() {
    if (!this.parsedData || !this.parsedData.jobs) return;
    const filtered = this.filterController.filterJobs(this.parsedData.jobs);
    dashboardManager.render(filtered);
  }

  /**
   * Setup UI Action Buttons
   */
  bindGlobalUIEvents() {
    // Export CSV
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        exportEngine.exportToCSV(dashboardManager.filteredJobs);
      });
    }

    // Export Excel
    const exportExcelBtn = document.getElementById('btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        exportEngine.exportToExcel(dashboardManager.filteredJobs);
      });
    }

    // Export PDF / Print
    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        exportEngine.printPDFReport();
      });
    }

    // Export PNG Charts dropdown / button
    const exportPngBtn = document.getElementById('btn-export-png');
    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => {
        exportEngine.downloadChartPNG('chart-weekly-mtti', 'V79_Weekly_MTTI_Trend.png');
      });
    }

    // Department Tab Switcher
    const deptTabs = document.querySelectorAll('.dept-tab-btn');
    deptTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const targetDept = e.currentTarget.dataset.dept;

        deptTabs.forEach((t) => {
          t.classList.remove('bg-emerald-600', 'text-white', 'shadow-lg');
          t.classList.add('bg-slate-800', 'text-slate-400', 'hover:bg-slate-700');
        });

        e.currentTarget.classList.remove('bg-slate-800', 'text-slate-400', 'hover:bg-slate-700');
        e.currentTarget.classList.add('bg-emerald-600', 'text-white', 'shadow-lg');

        // Set filter
        const deptSelect = document.getElementById('filter-department');
        if (deptSelect) {
          deptSelect.value = targetDept;
          this.filterController.state.department = targetDept;
          this.handleFiltersChanged();
        }
      });
    });

    // TV Dashboard Mode Toggle
    const tvModeBtn = document.getElementById('btn-toggle-tv-mode');
    if (tvModeBtn) {
      tvModeBtn.addEventListener('click', () => {
        this.toggleTvDashboardMode();
      });
    }

    // Dark/Light Mode Toggle
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        dashboardManager.render();
      });
    }
  }

  toggleTvDashboardMode() {
    this.isTvMode = !this.isTvMode;
    const body = document.body;

    if (this.isTvMode) {
      body.classList.add('tv-dashboard-mode');
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      body.classList.remove('tv-dashboard-mode');
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }

    setTimeout(() => {
      dashboardManager.render();
    }, 200);
  }
}

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.v79App = app;
});
