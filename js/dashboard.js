/**
 * Primary Dashboard Renderer & Layout Manager
 */
import { formatNumber, formatHours, formatDays, formatDate, getISOWeekKey, getISOWeekString, calculateMean, calculatePercentageChange, escapeHTML } from './utils.js';
import { calculateMTTI } from './mtti.js';
import { calculateMTTR } from './mttr.js';
import { generateExecutiveSummary, renderValidationReport } from './reports.js';
import { chartManager } from './charts.js';

export class DashboardManager {
  constructor() {
    this.allJobs = [];
    this.filteredJobs = [];
    this.validationReport = null;
    this.useBusinessHours = false;
    this.activeDepartmentTab = 'ALL';
    this.activeDrillDownFilter = null;
    this.listenersBound = false;
  }

  init(parsedData) {
    this.allJobs = parsedData.jobs || [];
    this.validationReport = parsedData.validationReport;
    this.filteredJobs = [...this.allJobs];

    if (!this.listenersBound) {
      this.bindDOMListeners();
      this.listenersBound = true;
    }
  }

  bindDOMListeners() {
    // Hours Calculation Mode Toggle (Calendar vs Business)
    const hoursToggle = document.getElementById('toggle-hours-mode');
    if (hoursToggle) {
      hoursToggle.addEventListener('change', (e) => {
        this.useBusinessHours = e.target.checked;
        this.render();
      });
    }

    // Validation Report Drawer Toggle
    const valReportBtn = document.getElementById('btn-open-validation');
    if (valReportBtn) {
      valReportBtn.addEventListener('click', () => {
        this.openValidationReportModal();
      });
    }

    // KPI Cards Drill Down listeners
    const kpiCardElements = document.querySelectorAll('.kpi-card[data-drilldown]');
    kpiCardElements.forEach((card) => {
      card.addEventListener('click', () => {
        const target = card.dataset.drilldown;
        this.openDrillDownModal(target, card.querySelector('.kpi-title')?.textContent || target);
      });
    });

    // Delegated Close Modal Listeners (handles clicks on x icon, button, or child SVG/paths)
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.modal-close-btn');
      if (closeBtn) {
        const modal = closeBtn.closest('.modal-container');
        if (modal) {
          modal.classList.add('hidden');
        }
        return;
      }

      // Modal background backdrop click to close
      if (e.target.classList && e.target.classList.contains('modal-container')) {
        e.target.classList.add('hidden');
      }
    });

    // Close active modal on ESC key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal-container:not(.hidden)');
        activeModals.forEach((m) => m.classList.add('hidden'));
      }
    });

    // Search input in Drill-down Modal
    const modalSearch = document.getElementById('modal-drilldown-search');
    if (modalSearch) {
      modalSearch.addEventListener('input', () => {
        this.filterDrillDownTable(modalSearch.value.trim().toLowerCase());
      });
    }
  }

  /**
   * Main render trigger
   */
  render(jobs = this.filteredJobs) {
    this.filteredJobs = jobs;

    this.renderKPICards();
    this.renderStatusBreakdown();
    this.renderWeekOnWeekTable();
    this.renderEngineerLeaderboard();
    this.renderExtremeJobs();
    this.renderExecutiveSummary();
    chartManager.renderAllCharts(this.filteredJobs, this.useBusinessHours);
  }

  /**
   * Render Top KPI Cards
   */
  renderKPICards() {
    const jobs = this.filteredJobs;
    const total = jobs.length;
    const completed = jobs.filter((j) => j.isCompleted).length;
    const created = jobs.filter((j) => j.status === 'Created').length;
    const confirmed = jobs.filter((j) => j.status === 'Confirmed').length;
    const openJobs = jobs.filter((j) => j.isOpen);
    const openCount = openJobs.length;

    // MTTI & MTTR
    const mtti = calculateMTTI(jobs, 48, this.useBusinessHours);
    const mttr = calculateMTTR(jobs, 24, this.useBusinessHours);

    // Open Age Mean
    const openAges = openJobs.map((j) => j.openAgeHours || 0);
    const avgOpenHours = calculateMean(openAges);

    // Overall SLA Attainment %
    const allCompletedWithDates = jobs.filter((j) => j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration);
    let metSLA = 0;
    allCompletedWithDates.forEach((j) => {
      const isInstall = j.department.toLowerCase().includes('install');
      const target = isInstall ? 48 : 24;
      const dur = this.useBusinessHours ? j.businessHours : j.durationHours;
      if (dur <= target) metSLA++;
    });

    const overallSLA = allCompletedWithDates.length > 0 ? (metSLA / allCompletedWithDates.length) * 100 : 0;

    // Helper to safely set element text
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-total-jobs', total.toLocaleString());
    setText('kpi-completed-jobs', completed.toLocaleString());
    setText('kpi-created-jobs', created.toLocaleString());
    setText('kpi-confirmed-jobs', confirmed.toLocaleString());
    setText('kpi-open-jobs', openCount.toLocaleString());
    setText('kpi-mtti-hours', mtti.formattedAverageHours);
    setText('kpi-mtti-days', mtti.formattedAverageDays);
    setText('kpi-mttr-hours', mttr.formattedAverageHours);
    setText('kpi-mttr-days', mttr.formattedAverageDays);
    setText('kpi-open-age', formatDays(avgOpenHours));
    setText('kpi-backlog', openCount.toLocaleString());
    setText('kpi-sla-percentage', `${formatNumber(overallSLA, 1)}%`);

    // SLA Progress ring or bar update
    const slaBar = document.getElementById('kpi-sla-bar');
    if (slaBar) {
      slaBar.style.width = `${Math.min(100, Math.max(0, overallSLA))}%`;
      if (overallSLA >= 80) slaBar.className = 'h-2 rounded-full bg-emerald-500 transition-all duration-500';
      else if (overallSLA >= 60) slaBar.className = 'h-2 rounded-full bg-amber-500 transition-all duration-500';
      else slaBar.className = 'h-2 rounded-full bg-rose-500 transition-all duration-500';
    }
  }

  /**
   * Render Status Breakdown Pills/Grid
   */
  renderStatusBreakdown() {
    const container = document.getElementById('status-breakdown-container');
    if (!container) return;

    const counts = {
      'Completed': 0,
      'Created': 0,
      'Confirmed': 0,
      'Cancelled': 0,
      'Closed': 0,
      'Pending': 0,
      'Manager Hold': 0,
      'Failed': 0,
      'Fail Request': 0
    };

    // Track any additional custom status
    this.filteredJobs.forEach((j) => {
      counts[j.status] = (counts[j.status] || 0) + 1;
    });

    const statusBadgeColors = {
      'Completed': 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400',
      'Created': 'bg-blue-950/60 border-blue-700/60 text-blue-400',
      'Confirmed': 'bg-cyan-950/60 border-cyan-700/60 text-cyan-400',
      'Cancelled': 'bg-slate-800/80 border-slate-700/60 text-slate-400',
      'Closed': 'bg-teal-950/60 border-teal-700/60 text-teal-400',
      'Pending': 'bg-purple-950/60 border-purple-700/60 text-purple-400',
      'Manager Hold': 'bg-amber-950/60 border-amber-700/60 text-amber-400',
      'Failed': 'bg-rose-950/60 border-rose-700/60 text-rose-400',
      'Fail Request': 'bg-pink-950/60 border-pink-700/60 text-pink-400'
    };

    let html = '';
    for (const [status, count] of Object.entries(counts)) {
      if (count === 0 && !['Completed', 'Created', 'Confirmed', 'Open', 'Cancelled'].includes(status)) {
        continue; // Skip zero count for rare custom statuses
      }

      const styleClass = statusBadgeColors[status] || 'bg-slate-800 border-slate-700 text-slate-300';
      html += `
        <div class="cursor-pointer hover:scale-105 transition-all p-3 rounded-xl border ${styleClass} flex flex-col justify-between" onclick="window.dashboardManager.openDrillDownModal('STATUS:${status}', '${status} Jobs')">
          <span class="text-xs uppercase font-medium tracking-wide opacity-80">${status}</span>
          <span class="text-2xl font-black mt-1">${count}</span>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  /**
   * Render Week-on-Week KPI Comparison Table
   */
  renderWeekOnWeekTable() {
    const tbody = document.getElementById('week-on-week-tbody');
    if (!tbody) return;

    // Group jobs by ISO Week
    const weekMap = {};

    this.filteredJobs.forEach((j) => {
      const dateToUse = j.dateFinished || j.dateCreated;
      if (!dateToUse) return;

      const weekKey = getISOWeekKey(dateToUse);
      const weekLabel = getISOWeekString(dateToUse);

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          weekKey,
          label: weekLabel,
          created: 0,
          completed: 0,
          installDurations: [],
          faultDurations: [],
          openAges: []
        };
      }

      if (j.dateCreated && getISOWeekKey(j.dateCreated) === weekKey) {
        weekMap[weekKey].created++;
      }

      if (j.isCompleted && j.dateFinished && getISOWeekKey(j.dateFinished) === weekKey && !j.isNegativeDuration) {
        weekMap[weekKey].completed++;
        const dur = this.useBusinessHours ? j.businessHours : j.durationHours;
        if (j.department.toLowerCase().includes('install')) {
          weekMap[weekKey].installDurations.push(dur);
        } else {
          weekMap[weekKey].faultDurations.push(dur);
        }
      }

      if (j.isOpen) {
        weekMap[weekKey].openAges.push(j.openAgeHours || 0);
      }
    });

    const sortedWeekKeys = Object.keys(weekMap).sort();
    if (sortedWeekKeys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">No weekly trend data available.</td></tr>`;
      return;
    }

    let rowsHTML = '';
    let prevWeekData = null;

    sortedWeekKeys.forEach((key) => {
      const curr = weekMap[key];
      const avgMTTI = calculateMean(curr.installDurations);
      const avgMTTR = calculateMean(curr.faultDurations);
      const avgOpenAge = calculateMean(curr.openAges) / 24; // convert to days
      const backlog = curr.openAges.length;

      // Calculate WoW Change % on Completed Jobs
      let changePercent = 0;
      let arrowHTML = '';

      if (prevWeekData) {
        changePercent = calculatePercentageChange(prevWeekData.completed, curr.completed);
        if (changePercent > 0) {
          arrowHTML = `<span class="inline-flex items-center text-emerald-400 font-bold ml-1">↑ +${changePercent.toFixed(1)}%</span>`;
        } else if (changePercent < 0) {
          arrowHTML = `<span class="inline-flex items-center text-rose-400 font-bold ml-1">↓ ${changePercent.toFixed(1)}%</span>`;
        } else {
          arrowHTML = `<span class="text-slate-500 ml-1">0.0%</span>`;
        }
      } else {
        arrowHTML = `<span class="text-slate-500 ml-1">-</span>`;
      }

      rowsHTML += `
        <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
          <td class="p-3 font-semibold text-white">${escapeHTML(curr.label)}</td>
          <td class="p-3 text-right font-mono text-blue-400">${curr.created}</td>
          <td class="p-3 text-right font-mono text-emerald-400 font-bold">${curr.completed}</td>
          <td class="p-3 text-right font-mono text-slate-300">${formatHours(avgMTTI)}</td>
          <td class="p-3 text-right font-mono text-slate-300">${formatHours(avgMTTR)}</td>
          <td class="p-3 text-right font-mono text-amber-400">${formatNumber(avgOpenAge, 1)} days</td>
          <td class="p-3 text-right font-mono text-slate-300">${backlog}</td>
          <td class="p-3 text-right">${arrowHTML}</td>
        </tr>
      `;

      prevWeekData = curr;
    });

    tbody.innerHTML = rowsHTML;
  }

  /**
   * Render Engineer Performance Leaderboard Table
   */
  renderEngineerLeaderboard() {
    const tbody = document.getElementById('engineer-leaderboard-tbody');
    if (!tbody) return;

    const engMap = {};

    this.filteredJobs.forEach((j) => {
      if (!j.engineer || j.engineer === 'Unassigned') return;

      if (!engMap[j.engineer]) {
        engMap[j.engineer] = {
          engineer: j.engineer,
          completed: 0,
          open: 0,
          durations: [],
          oldestOpenAge: 0
        };
      }

      if (j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration) {
        engMap[j.engineer].completed++;
        engMap[j.engineer].durations.push(this.useBusinessHours ? j.businessHours : j.durationHours);
      }

      if (j.isOpen) {
        engMap[j.engineer].open++;
        const age = j.openAgeHours || 0;
        if (age > engMap[j.engineer].oldestOpenAge) {
          engMap[j.engineer].oldestOpenAge = age;
        }
      }
    });

    const engList = Object.values(engMap).sort((a, b) => b.completed - a.completed);

    if (engList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">No engineer field data recorded.</td></tr>`;
      return;
    }

    let rowsHTML = '';
    engList.forEach((eng, index) => {
      const rank = index + 1;
      const avgTime = calculateMean(eng.durations);

      let badgeColor = 'bg-slate-800 text-slate-300';
      if (rank === 1) badgeColor = 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
      else if (rank === 2) badgeColor = 'bg-slate-300/20 text-slate-200 border border-slate-400/40';
      else if (rank === 3) badgeColor = 'bg-amber-700/20 text-amber-400 border border-amber-700/40';

      rowsHTML += `
        <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
          <td class="p-3">
            <span class="inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${badgeColor}">
              #${rank}
            </span>
          </td>
          <td class="p-3 font-medium text-white">${escapeHTML(eng.engineer)}</td>
          <td class="p-3 text-right font-bold text-emerald-400 font-mono">${eng.completed}</td>
          <td class="p-3 text-right font-mono text-slate-300">${formatHours(avgTime)}</td>
          <td class="p-3 text-right font-mono text-amber-400">${eng.open}</td>
          <td class="p-3 text-right font-mono text-slate-400">${formatDays(eng.oldestOpenAge)}</td>
          <td class="p-3 text-center">
            <button class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors"
              onclick="window.dashboardManager.openDrillDownModal('ENGINEER:${escapeHTML(eng.engineer)}', 'Jobs for ${escapeHTML(eng.engineer)}')">
              View Jobs
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHTML;
  }

  /**
   * Render Top 10 Longest & Fastest Jobs
   */
  renderExtremeJobs() {
    const fastestContainer = document.getElementById('fastest-jobs-container');
    const slowestContainer = document.getElementById('slowest-jobs-container');
    if (!fastestContainer || !slowestContainer) return;

    const completed = this.filteredJobs.filter((j) => j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration);

    const sortedFastest = [...completed].sort((a, b) => (a.durationHours || 0) - (b.durationHours || 0)).slice(0, 10);
    const sortedSlowest = [...completed].sort((a, b) => (b.durationHours || 0) - (a.durationHours || 0)).slice(0, 10);

    const renderList = (items, colorClass) => {
      if (items.length === 0) return '<p class="text-xs text-slate-500 p-3">No jobs found.</p>';
      return items.map((j) => `
        <div class="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex justify-between items-center text-xs hover:border-slate-600 transition-all">
          <div>
            <div class="font-bold text-white font-mono">${escapeHTML(j.jobNumber)}</div>
            <div class="text-slate-400 truncate max-w-[160px]">${escapeHTML(j.customer)} | ${escapeHTML(j.engineer)}</div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold ${colorClass}">${formatHours(this.useBusinessHours ? j.businessHours : j.durationHours)}</div>
            <div class="text-[10px] text-slate-500">${escapeHTML(j.department)}</div>
          </div>
        </div>
      `).join('');
    };

    fastestContainer.innerHTML = renderList(sortedFastest, 'text-emerald-400');
    slowestContainer.innerHTML = renderList(sortedSlowest, 'text-rose-400');
  }

  /**
   * Render Plain-English Executive Summary
   */
  renderExecutiveSummary() {
    const summaryBox = document.getElementById('executive-summary-content');
    if (summaryBox) {
      summaryBox.innerHTML = generateExecutiveSummary(this.filteredJobs, this.useBusinessHours);
    }
  }

  /**
   * Open Validation Report Modal
   */
  openValidationReportModal() {
    const modal = document.getElementById('modal-validation-report');
    const body = document.getElementById('modal-validation-body');
    if (modal && body && this.validationReport) {
      body.innerHTML = renderValidationReport(this.validationReport);
      modal.classList.remove('hidden');
    }
  }

  /**
   * Open Modal Drill Down for specific metric
   */
  openDrillDownModal(filterType, title) {
    const modal = document.getElementById('modal-drilldown');
    const modalTitle = document.getElementById('modal-drilldown-title');
    const tbody = document.getElementById('modal-drilldown-tbody');
    const countBadge = document.getElementById('modal-drilldown-count');

    if (!modal || !tbody) return;

    this.activeDrillDownFilter = filterType;
    modalTitle.textContent = title || 'Matching Job Records';

    let matchingJobs = [];

    if (filterType === 'TOTAL') {
      matchingJobs = [...this.filteredJobs];
    } else if (filterType === 'COMPLETED') {
      matchingJobs = this.filteredJobs.filter((j) => j.isCompleted);
    } else if (filterType === 'CREATED') {
      matchingJobs = this.filteredJobs.filter((j) => j.status === 'Created');
    } else if (filterType === 'CONFIRMED') {
      matchingJobs = this.filteredJobs.filter((j) => j.status === 'Confirmed');
    } else if (filterType === 'OPEN') {
      matchingJobs = this.filteredJobs.filter((j) => j.isOpen);
    } else if (filterType === 'OVER24H') {
      matchingJobs = this.filteredJobs.filter((j) => j.isOpen && (j.openAgeHours || 0) > 24);
    } else if (filterType === 'OVER48H') {
      matchingJobs = this.filteredJobs.filter((j) => j.isOpen && (j.openAgeHours || 0) > 48);
    } else if (filterType === 'OVER7D') {
      matchingJobs = this.filteredJobs.filter((j) => j.isOpen && (j.openAgeHours || 0) > 168);
    } else if (filterType === 'OVER30D') {
      matchingJobs = this.filteredJobs.filter((j) => j.isOpen && (j.openAgeHours || 0) > 720);
    } else if (filterType.startsWith('STATUS:')) {
      const st = filterType.replace('STATUS:', '');
      matchingJobs = this.filteredJobs.filter((j) => j.status === st);
    } else if (filterType.startsWith('ENGINEER:')) {
      const eng = filterType.replace('ENGINEER:', '');
      matchingJobs = this.filteredJobs.filter((j) => j.engineer === eng);
    } else {
      matchingJobs = [...this.filteredJobs];
    }

    this.currentDrillDownList = matchingJobs;

    if (countBadge) countBadge.textContent = `${matchingJobs.length} records`;

    this.renderDrillDownRows(matchingJobs);
    modal.classList.remove('hidden');
  }

  filterDrillDownTable(query) {
    if (!this.currentDrillDownList) return;
    if (!query) {
      this.renderDrillDownRows(this.currentDrillDownList);
      return;
    }
    const filtered = this.currentDrillDownList.filter(
      (j) =>
        (j.jobNumber && j.jobNumber.toLowerCase().includes(query)) ||
        (j.customer && j.customer.toLowerCase().includes(query)) ||
        (j.engineer && j.engineer.toLowerCase().includes(query)) ||
        (j.department && j.department.toLowerCase().includes(query)) ||
        (j.status && j.status.toLowerCase().includes(query))
    );
    this.renderDrillDownRows(filtered);
  }

  renderDrillDownRows(jobs) {
    const tbody = document.getElementById('modal-drilldown-tbody');
    if (!tbody) return;

    if (jobs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500">No matching job records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = jobs
      .map(
        (j) => `
      <tr class="border-b border-slate-800 hover:bg-slate-800/40 text-xs transition-colors">
        <td class="p-2.5 font-bold font-mono text-emerald-400">${escapeHTML(j.jobNumber)}</td>
        <td class="p-2.5 text-white max-w-[150px] truncate">${escapeHTML(j.customer)}</td>
        <td class="p-2.5 text-slate-300 max-w-[130px] truncate">${escapeHTML(j.engineer)}</td>
        <td class="p-2.5 text-slate-400 font-mono">${formatDate(j.dateCreated)}</td>
        <td class="p-2.5 text-slate-400 font-mono">${formatDate(j.dateFinished)}</td>
        <td class="p-2.5 text-right font-mono ${j.isCompleted ? 'text-emerald-400' : 'text-slate-500'}">
          ${j.isCompleted ? formatHours(this.useBusinessHours ? j.businessHours : j.durationHours) : '-'}
        </td>
        <td class="p-2.5 text-right font-mono ${j.isOpen ? 'text-amber-400' : 'text-slate-500'}">
          ${j.isOpen ? formatDays(j.openAgeHours) : '-'}
        </td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            ${escapeHTML(j.status)}
          </span>
        </td>
        <td class="p-2.5 text-slate-300 truncate max-w-[140px]">${escapeHTML(j.department)}</td>
        <td class="p-2.5 text-slate-400">${escapeHTML(j.region)}</td>
      </tr>
    `
      )
      .join('');
  }
}

export const dashboardManager = new DashboardManager();
window.dashboardManager = dashboardManager;
