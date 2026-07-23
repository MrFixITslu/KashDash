/**
 * Multi-format Export Engine (CSV, Excel XLSX, PDF Print View, PNG Charts)
 */
import { formatDate, formatHours, formatDays, formatNumber, parseDate, getFiscalYearStartDateString } from './utils.js';
import { calculateMTTI } from './mtti.js';
import { calculateMTTR } from './mttr.js';
import { chartManager } from './charts.js';
import { generateExecutiveSummary } from './reports.js';

export class ExportEngine {
  /**
   * Export filtered jobs to CSV
   */
  exportToCSV(jobs, filename = 'V79_KPI_Dashboard_Export.csv') {
    if (!jobs || jobs.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = [
      'Job Number', 'Department', 'Status', 'Engineer', 'Customer',
      'Technology', 'Date Created', 'Date Finished', 'Duration (Hours)',
      'Business Hours', 'Open Age (Hours)', 'Region', 'Priority', 'Category', 'Sub Category'
    ];

    const rows = jobs.map((j) => [
      `"${(j.jobNumber || '').replace(/"/g, '""')}"`,
      `"${(j.department || '').replace(/"/g, '""')}"`,
      `"${(j.status || '').replace(/"/g, '""')}"`,
      `"${(j.engineer || '').replace(/"/g, '""')}"`,
      `"${(j.customer || '').replace(/"/g, '""')}"`,
      `"${(j.technology || '').replace(/"/g, '""')}"`,
      `"${formatDate(j.dateCreated)}"`,
      `"${formatDate(j.dateFinished)}"`,
      j.durationHours ? j.durationHours.toFixed(2) : '0.00',
      j.businessHours ? j.businessHours.toFixed(2) : '0.00',
      j.openAgeHours ? j.openAgeHours.toFixed(2) : '0.00',
      `"${(j.region || '').replace(/"/g, '""')}"`,
      `"${(j.priority || '').replace(/"/g, '""')}"`,
      `"${(j.category || '').replace(/"/g, '""')}"`,
      `"${(j.subCategory || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export to Excel XLSX workbook using SheetJS
   */
  exportToExcel(jobs, filename = 'V79_KPI_Operational_Report.xlsx') {
    if (!jobs || jobs.length === 0) {
      alert('No data available to export.');
      return;
    }

    if (typeof window.XLSX === 'undefined') {
      alert('SheetJS (XLSX) library is still loading or unavailable.');
      return;
    }

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // 1. KPI Summary Sheet
    const mtti = calculateMTTI(jobs, 48);
    const mttr = calculateMTTR(jobs, 48);
    const completed = jobs.filter((j) => j.isCompleted).length;
    const openJobs = jobs.filter((j) => j.isOpen && (
      j.department.toLowerCase().includes('install') ||
      (j.department.toLowerCase().includes('fault') && j.department.toLowerCase().includes('external'))
    ));
    const open = openJobs.length;

    const summaryData = [
      ['Digicel St. Lucia - D+ Service Delivery Operational KPI Summary'],
      ['Generated Date', new Date().toLocaleString()],
      ['Total Records Analyzed', jobs.length],
      [''],
      ['METRIC', 'ST. LUCIA INSTALLATIONS', 'ST. LUCIA FAULT REPAIR EXTERNAL'],
      ['Completed Jobs', mtti.totalCompleted, mttr.totalCompleted],
      ['Average Turnaround (Hours)', mtti.averageHours.toFixed(1), mttr.averageHours.toFixed(1)],
      ['Average Turnaround (Days)', mtti.averageDays.toFixed(1), mttr.averageDays.toFixed(1)],
      ['Median Turnaround (Hours)', mtti.medianHours.toFixed(1), mttr.medianHours.toFixed(1)],
      ['Fastest Job Hours', mtti.minHours.toFixed(1), mttr.minHours.toFixed(1)],
      ['Slowest Job Hours', mtti.maxHours.toFixed(1), mttr.maxHours.toFixed(1)],
      ['SLA Target (Hours)', `${mtti.slaTargetHours} hrs`, `${mttr.slaTargetHours} hrs`],
      ['SLA Attainment %', `${formatNumber(mtti.slaPercentage, 1)}%`, `${formatNumber(mttr.slaPercentage, 1)}%`],
      [''],
      ['OVERALL BACKLOG SUMMARY'],
      ['Total Open Backlog Jobs', open],
      ['Open Jobs > 24 Hours', openJobs.filter((j) => j.openAgeHours > 24).length],
      ['Open Jobs > 48 Hours', openJobs.filter((j) => j.openAgeHours > 48).length],
      ['Open Jobs > 7 Days', openJobs.filter((j) => j.openAgeHours > 168).length],
      ['Open Jobs > 30 Days', openJobs.filter((j) => j.openAgeHours > 720).length]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'KPI Summary');

    // 2. Raw Filtered Data Sheet
    const dataRows = jobs.map((j) => ({
      'Job Number': j.jobNumber,
      'Department': j.department,
      'Status': j.status,
      'Engineer': j.engineer,
      'Customer': j.customer,
      'Technology': j.technology,
      'Date Created': formatDate(j.dateCreated),
      'Date Finished': formatDate(j.dateFinished),
      'Duration (Calendar Hours)': j.durationHours ? Number(j.durationHours.toFixed(2)) : 0,
      'Business Hours': j.businessHours ? Number(j.businessHours.toFixed(2)) : 0,
      'Open Age (Hours)': j.openAgeHours ? Number(j.openAgeHours.toFixed(2)) : 0,
      'Region': j.region,
      'Priority': j.priority,
      'Category': j.category,
      'Sub Category': j.subCategory
    }));

    const wsData = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, wsData, 'Detailed Jobs Data');

    // Write file
    XLSX.writeFile(wb, filename);
  }

  /**
   * Download Chart as PNG image
   */
  downloadChartPNG(chartCanvasId, filename = 'KPI_Chart.png') {
    const canvas = document.getElementById(chartCanvasId);
    if (!canvas) {
      alert('Chart canvas element not found.');
      return;
    }

    const imageURI = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = imageURI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Print PDF report / open print preview modal with executive graphs and calculation methodology
   */
  async printPDFReport(filteredJobs = [], useBusinessHours = false) {
    const total = filteredJobs.length;
    const completed = filteredJobs.filter(j => j.isCompleted).length;
    const open = filteredJobs.filter(j => j.isOpen && (
      j.department.toLowerCase().includes('install') ||
      (j.department.toLowerCase().includes('fault') && j.department.toLowerCase().includes('external'))
    )).length;
    const mtti = calculateMTTI(filteredJobs, 48, useBusinessHours);
    const mttr = calculateMTTR(filteredJobs, 48, useBusinessHours);

    // Get active filter dates
    let startDateStr = '';
    let endDateStr = '';

    const startEl = document.getElementById('filter-start-date');
    const endEl = document.getElementById('filter-end-date');
    if (startEl && startEl.value) {
      startDateStr = startEl.value;
    }
    if (endEl && endEl.value) {
      endDateStr = endEl.value;
    }

    if (!startDateStr || !endDateStr) {
      if (window.v79App && window.v79App.filterController) {
        const state = window.v79App.filterController.state;
        if (!startDateStr) startDateStr = state.startDate;
        if (!endDateStr) endDateStr = state.endDate;
      }
    }

    // If still not present, show defaults (April 1st to Present)
    if (!startDateStr) {
      startDateStr = getFiscalYearStartDateString();
    }
    if (!endDateStr) {
      endDateStr = new Date().toISOString().substring(0, 10);
    }

    const startParsed = parseDate(startDateStr);
    const endParsed = parseDate(endDateStr);

    const startFormatted = startParsed ? formatDate(startParsed).split(' ')[0] : formatDate(parseDate(getFiscalYearStartDateString())).split(' ')[0];
    const endFormatted = endParsed ? formatDate(endParsed).split(' ')[0] : formatDate(new Date()).split(' ')[0];

    const dateRangeStr = `${startFormatted} to ${endFormatted}`;

    // Calculate Completed Jobs by Department
    const completedDepts = {};
    filteredJobs.filter(j => j.isCompleted).forEach(j => {
      const d = j.department || 'Unspecified';
      completedDepts[d] = (completedDepts[d] || 0) + 1;
    });

    // Helper to add solid light background to transparent chart canvas
    const getCanvasDataURLWithBackground = (canvas, backgroundColor = '#ffffff') => {
      if (!canvas) return '';
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill solid light background
        tempCtx.fillStyle = backgroundColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Copy original canvas contents
        tempCtx.drawImage(canvas, 0, 0);
        
        return tempCanvas.toDataURL('image/png');
      } catch (e) {
        console.error('Error adding background to canvas:', e);
        return canvas.toDataURL('image/png');
      }
    };

    // Temporarily switch chart colors for white PDF report
    const isDark = !document.body.classList.contains('light-theme');
    if (isDark && typeof chartManager !== 'undefined') {
      Object.values(chartManager.charts).forEach(chart => {
        if (chart) {
          if (chart.options?.plugins?.title) chart.options.plugins.title.color = '#0f172a';
          if (chart.options?.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = '#475569';
          if (chart.options?.scales?.x?.ticks) chart.options.scales.x.ticks.color = '#475569';
          if (chart.options?.scales?.y?.ticks) chart.options.scales.y.ticks.color = '#475569';
          if (chart.options?.scales?.x?.grid) chart.options.scales.x.grid.color = '#e2e8f0';
          if (chart.options?.scales?.y?.grid) chart.options.scales.y.grid.color = '#e2e8f0';
          chart.update('none'); // synchronous update without animation
        }
      });
      // Wait for chart rendering to complete
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Grab chart images if available
    const mttiCanvas = document.getElementById('chart-weekly-mtti');
    const mttiImg = getCanvasDataURLWithBackground(mttiCanvas, '#ffffff');

    const mttrCanvas = document.getElementById('chart-weekly-mttr');
    const mttrImg = getCanvasDataURLWithBackground(mttrCanvas, '#ffffff');

    const openAgeCanvas = document.getElementById('chart-open-age');
    const openAgeImg = getCanvasDataURLWithBackground(openAgeCanvas, '#ffffff');

    const deptCanvas = document.getElementById('chart-department');
    const deptImg = getCanvasDataURLWithBackground(deptCanvas, '#ffffff');

    const rollingAvgCanvas = document.getElementById('chart-rolling-average');
    const rollingAvgImg = getCanvasDataURLWithBackground(rollingAvgCanvas, '#ffffff');

    // Restore original chart colors
    if (isDark && typeof chartManager !== 'undefined') {
      Object.values(chartManager.charts).forEach(chart => {
        if (chart) {
          if (chart.options?.plugins?.title) chart.options.plugins.title.color = '#f8fafc';
          if (chart.options?.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = '#94a3b8';
          if (chart.options?.scales?.x?.ticks) chart.options.scales.x.ticks.color = '#94a3b8';
          if (chart.options?.scales?.y?.ticks) chart.options.scales.y.ticks.color = '#94a3b8';
          if (chart.options?.scales?.x?.grid) chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.08)';
          if (chart.options?.scales?.y?.grid) chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.08)';
          chart.update('none');
        }
      });
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const nowStr = new Date().toLocaleString();

    let printContainer = document.getElementById('print-report-container');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'print-report-container';
      document.body.appendChild(printContainer);
    }

    printContainer.className = 'fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-4 overflow-y-auto';

    let mttiImgSection = mttiImg ? `
      <div class="chart-card" style="border-top-color:#059669; page-break-inside: avoid; break-inside: avoid;">
        <div class="chart-card-eyebrow" style="color:#059669;">Trend · Weekly</div>
        <h4 class="chart-card-title">MTTI (St. Lucia Installations)</h4>
        <img src="${mttiImg}" class="chart-card-img" />
      </div>
    ` : '';

    let mttrImgSection = mttrImg ? `
      <div class="chart-card" style="border-top-color:#d97706; page-break-inside: avoid; break-inside: avoid;">
        <div class="chart-card-eyebrow" style="color:#d97706;">Trend · Weekly</div>
        <h4 class="chart-card-title">MTTR (St. Lucia Fault Repair External)</h4>
        <img src="${mttrImg}" class="chart-card-img" />
      </div>
    ` : '';

    let openAgeImgSection = openAgeImg ? `
      <div class="chart-card" style="border-top-color:#e11d48; page-break-inside: avoid; break-inside: avoid;">
        <div class="chart-card-eyebrow" style="color:#e11d48;">Backlog · Aging</div>
        <h4 class="chart-card-title">Open Jobs Backlog Age Distribution</h4>
        <img src="${openAgeImg}" class="chart-card-img" />
      </div>
    ` : '';

    let deptImgSection = deptImg ? `
      <div class="chart-card" style="border-top-color:#64748b; page-break-inside: avoid; break-inside: avoid;">
        <div class="chart-card-eyebrow" style="color:#64748b;">Volume · Comparison</div>
        <h4 class="chart-card-title">Department Volume Comparison</h4>
        <img src="${deptImg}" class="chart-card-img" />
      </div>
    ` : '';

    let rollingAvgImgSection = rollingAvgImg ? `
      <div class="chart-card" style="border-top-color:#0284c7; page-break-inside: avoid; break-inside: avoid;">
        <div class="chart-card-eyebrow" style="color:#0284c7;">Momentum · Rolling 7-Day</div>
        <h4 class="chart-card-title">Rolling Turnaround Average</h4>
        <img src="${rollingAvgImg}" class="chart-card-img" />
      </div>
    ` : '';

    // Inline SVG radial gauge for SLA/attainment percentages — used in place of bare numbers
    // so the report's signature "signal ring" motif (this app's core subject: SLA health) carries
    // through consistently rather than being decorative.
    const renderGaugeSVG = (percentage, color) => {
      const size = 76;
      const stroke = 7;
      const radius = (size - stroke) / 2;
      const circumference = 2 * Math.PI * radius;
      const clamped = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));
      const offset = circumference - (clamped / 100) * circumference;
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0;">
          <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="${stroke}" />
          <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
            transform="rotate(-90 ${size / 2} ${size / 2})" />
          <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="800" fill="#0f172a" font-family="Inter, system-ui, sans-serif">${clamped.toFixed(0)}%</text>
        </svg>
      `;
    };

    // Dynamic operational status derived from actual SLA attainment, not a static label
    const combinedTotal = mtti.totalCompleted + mttr.totalCompleted;
    const combinedSLA = combinedTotal > 0
      ? ((mtti.slaMetCount + mttr.slaMetCount) / combinedTotal) * 100
      : 0;
    const statusInfo = combinedSLA >= 95
      ? { label: 'On Target', color: '#059669', bg: '#ecfdf5' }
      : combinedSLA >= 85
        ? { label: 'Monitor', color: '#d97706', bg: '#fffbeb' }
        : { label: 'Action Required', color: '#e11d48', bg: '#fff1f2' };

    const deptDotColor = (dept) => {
      if (dept === 'St. Lucia Installations') return '#059669';
      if (dept === 'St. Lucia Fault Repair External') return '#d97706';
      if (dept === 'St. Lucia Fault Repair Internal') return '#64748b';
      return '#94a3b8';
    };

    printContainer.innerHTML = `
      <style>
        #pdf-report-body { font-family: Inter, system-ui, sans-serif; }
        #pdf-report-body .eyebrow { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
        #pdf-report-body .rail { border-left-width: 3px; border-left-style: solid; padding-left: 14px; }
        #pdf-report-body .kpi-card { border-top-width: 3px; border-top-style: solid; background: #f8fafc; border-radius: 8px; padding: 14px 16px; }
        #pdf-report-body .metric-card { border-top-width: 3px; border-top-style: solid; background: #f8fafc; border-radius: 10px; padding: 18px; }
        #pdf-report-body .chart-card { border-top-width: 3px; border-top-style: solid; background: #ffffff; border: 1px solid #e2e8f0; border-top-width: 3px; border-radius: 10px; padding: 14px 16px 16px; margin-top: 16px; }
        #pdf-report-body .chart-card-eyebrow { font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px; }
        #pdf-report-body .chart-card-title { font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 10px; }
        #pdf-report-body .chart-card-img { width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
        #pdf-report-body .def-card { border-left-width: 3px; border-left-style: solid; padding: 4px 0 4px 12px; }
        #pdf-report-body .def-term { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        #pdf-report-body .def-body { font-size: 11px; color: #475569; line-height: 1.55; }
      </style>

      <div class="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Modal Toolbar -->
        <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span class="font-bold text-sm">Executive PDF Report Preview</span>
          </div>
          <div class="flex items-center gap-3">
            <button id="btn-modal-save-pdf" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Save PDF
            </button>
            <button id="btn-modal-print" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Print
            </button>
            <button id="btn-modal-close" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
              Close
            </button>
          </div>
        </div>

        <!-- Report Content Body -->
        <div id="pdf-report-body" class="overflow-y-auto bg-white text-slate-900">

          <!-- Cover / Hero Band -->
          <div style="background:#0f172a; position:relative; padding:26px 32px 22px;">
            <div style="position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#e11d48,#059669);"></div>
            <div class="flex items-start justify-between gap-6">
              <div>
                <div class="flex items-center gap-2" style="margin-bottom:10px;">
                  <span style="background:linear-gradient(135deg,#e11d48,#059669); width:26px; height:26px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; font-weight:900; color:#fff; font-size:12px;">D+</span>
                  <span class="eyebrow" style="color:#94a3b8;">Digicel St. Lucia &middot; Service Delivery</span>
                </div>
                <h1 style="font-size:24px; font-weight:900; color:#fff; letter-spacing:-0.01em; line-height:1.2; margin:0;">Operational KPI &amp;<br/>Executive Performance Report</h1>
              </div>
              <div class="text-right" style="flex-shrink:0;">
                <div class="eyebrow" style="color:#64748b; margin-bottom:2px;">Analysis Period</div>
                <div class="font-mono" style="font-size:13px; font-weight:700; color:#fff; margin-bottom:10px;">${dateRangeStr}</div>
                <div class="eyebrow" style="color:#64748b; margin-bottom:2px;">Generated</div>
                <div class="font-mono" style="font-size:10px; color:#cbd5e1; margin-bottom:10px;">${nowStr}</div>
                <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:#1e293b; border:1px solid #334155;">
                  <span style="width:6px; height:6px; border-radius:50%; background:${useBusinessHours ? '#38bdf8' : '#34d399'};"></span>
                  <span class="eyebrow" style="color:#e2e8f0;">${useBusinessHours ? 'Business Hours' : 'Calendar Hours'}</span>
                </div>
              </div>
            </div>
          </div>

          <div style="padding:26px 32px 30px;" class="space-y-7">

            <!-- Executive Insights -->
            <div class="rail" style="border-color:#64748b;">
              <h3 class="eyebrow" style="color:#0f172a; margin-bottom:10px;">Executive Overview</h3>
              <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                ${generateExecutiveSummary(filteredJobs, useBusinessHours)
                  .replace(/text-slate-200/g, 'text-slate-700')
                  .replace(/text-white/g, 'text-slate-900')
                  .replace(/bg-slate-800\/50/g, 'bg-transparent')
                  .replace(/bg-slate-800/g, 'bg-slate-200')
                  .replace(/border-slate-700\/50/g, 'border-slate-300')
                  .replace(/text-slate-400/g, 'text-slate-600')
                  .replace(/text-slate-300/g, 'text-slate-800')
                  .replace(/text-emerald-400/g, 'text-emerald-700')
                  .replace(/text-amber-400/g, 'text-amber-700')
                  .replace(/text-blue-400/g, 'text-blue-700')
                }
              </div>
            </div>

            <!-- Executive Summary Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" style="page-break-before: always; break-before: page;">
              <div class="kpi-card" style="border-top-color:#64748b;">
                <div class="eyebrow" style="color:#64748b;">Filtered Job Volume</div>
                <div style="font-size:22px; font-weight:900; color:#0f172a; margin-top:4px;">${total}</div>
              </div>
              <div class="kpi-card" style="border-top-color:#059669;">
                <div class="eyebrow" style="color:#059669;">Completed Jobs</div>
                <div style="font-size:22px; font-weight:900; color:#0f172a; margin-top:4px;">${completed}</div>
                <div class="font-mono" style="font-size:9px; color:#64748b; margin-top:4px; display:flex; flex-wrap:wrap; gap:5px;">
                  <span>Installs ${mtti.totalCompleted}</span><span style="color:#cbd5e1;">&middot;</span>
                  <span>Fault Ext ${mttr.totalCompleted}</span><span style="color:#cbd5e1;">&middot;</span>
                  <span>Other ${completed - mtti.totalCompleted - mttr.totalCompleted}</span>
                </div>
              </div>
              <div class="kpi-card" style="border-top-color:#d97706;">
                <div class="eyebrow" style="color:#d97706;">Open Backlog</div>
                <div style="font-size:22px; font-weight:900; color:#0f172a; margin-top:4px;">${open}</div>
              </div>
              <div class="kpi-card" style="border-top-color:${statusInfo.color}; background:${statusInfo.bg};">
                <div class="eyebrow" style="color:${statusInfo.color};">Operational Status</div>
                <div style="font-size:16px; font-weight:900; color:${statusInfo.color}; margin-top:4px;">${statusInfo.label}</div>
                <div class="font-mono" style="font-size:9px; color:#64748b; margin-top:4px;">${formatNumber(combinedSLA, 1)}% combined SLA attainment</div>
              </div>
            </div>

            <!-- Core Metrics Breakdown -->
            <div class="grid grid-cols-2 gap-6">
              <div class="metric-card" style="border-top-color:#059669;">
                <h3 style="font-size:11px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:12px;">St. Lucia Installations &middot; MTTI</h3>
                <div style="display:flex; align-items:center; gap:16px;">
                  ${renderGaugeSVG(mtti.slaPercentage, '#059669')}
                  <div style="font-size:11px; color:#334155; line-height:1.7;">
                    <div>Completed Installs: <strong style="color:#0f172a;">${mtti.totalCompleted}</strong></div>
                    <div>Average MTTI: <strong style="color:#047857;">${mtti.formattedAverageHours}</strong> (${mtti.formattedAverageDays})</div>
                    <div>Median MTTI: <strong style="color:#0f172a;">${mtti.formattedMedianHours}</strong></div>
                    <div>SLA Target: <strong style="color:#0f172a;">&le;${mtti.slaTargetHours}h</strong> &middot; ${mtti.slaMetCount} met / ${mtti.slaMissedCount} missed</div>
                  </div>
                </div>
              </div>

              <div class="metric-card" style="border-top-color:#d97706;">
                <h3 style="font-size:11px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.03em; margin-bottom:12px;">St. Lucia Fault Repair External &middot; MTTR</h3>
                <div style="display:flex; align-items:center; gap:16px;">
                  ${renderGaugeSVG(mttr.slaPercentage, '#d97706')}
                  <div style="font-size:11px; color:#334155; line-height:1.7;">
                    <div>Resolved Faults: <strong style="color:#0f172a;">${mttr.totalCompleted}</strong></div>
                    <div>Average MTTR: <strong style="color:#b45309;">${mttr.formattedAverageHours}</strong> (${mttr.formattedAverageDays})</div>
                    <div>Median MTTR: <strong style="color:#0f172a;">${mttr.formattedMedianHours}</strong></div>
                    <div>SLA Target: <strong style="color:#0f172a;">&le;${mttr.slaTargetHours}h</strong> &middot; ${mttr.slaMetCount} met / ${mttr.slaMissedCount} missed</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Completed Jobs Department Breakdown -->
            <div class="rail" style="border-color:#64748b;">
              <div class="flex items-center justify-between" style="margin-bottom:12px;">
                <h3 class="eyebrow" style="color:#0f172a;">Completed Jobs by Department</h3>
                <span style="font-size:9px; color:#94a3b8;">Excludes Remote Migration tasks</span>
              </div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                ${Object.entries(completedDepts).map(([dept, count]) => {
                  let subtext = 'Total completed status';
                  const dotColor = deptDotColor(dept);
                  if (dept === 'St. Lucia Installations') {
                    const diff = count - mtti.totalCompleted;
                    subtext = `<span style="font-size:9px; color:#059669; font-weight:700; display:block; margin-top:2px;">${mtti.totalCompleted} used in MTTI</span>`;
                    if (diff > 0) subtext += `<span style="font-size:8px; color:#94a3b8; display:block;">${diff} missing dates/negative</span>`;
                  } else if (dept === 'St. Lucia Fault Repair External') {
                    const diff = count - mttr.totalCompleted;
                    subtext = `<span style="font-size:9px; color:#d97706; font-weight:700; display:block; margin-top:2px;">${mttr.totalCompleted} used in MTTR</span>`;
                    if (diff > 0) subtext += `<span style="font-size:8px; color:#94a3b8; display:block;">${diff} missing dates/negative</span>`;
                  } else if (dept === 'St. Lucia Fault Repair Internal') {
                    subtext = `<span style="font-size:9px; color:#64748b; font-weight:700; display:block; margin-top:2px;">Separate internal volume</span>`;
                  }
                  return `
                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="width:7px; height:7px; border-radius:50%; background:${dotColor}; flex-shrink:0;"></span>
                        <span style="font-size:10px; font-weight:600; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${dept}">${dept}</span>
                      </div>
                      <div style="font-size:17px; font-weight:900; color:#0f172a; margin-top:6px;">${count} <span style="font-size:9px; font-weight:400; color:#94a3b8;">jobs</span></div>
                      <div style="border-top:1px solid #f1f5f9; margin-top:6px; padding-top:4px;">${subtext}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Graphs / Charts Section -->
            <div style="page-break-before: always; break-before: page;">
              <h3 class="eyebrow" style="color:#0f172a; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Operational Trend Visualizations</h3>
              ${mttiImgSection}
              ${mttrImgSection}
              ${openAgeImgSection}
              ${deptImgSection}
              ${rollingAvgImgSection}
            </div>

            <!-- Methodology & Calculation Guide -->
            <div style="page-break-before: always; break-before: page;">
              <h3 class="eyebrow" style="color:#0f172a; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:6px;">Data Calculation &amp; Methodology Guide</h3>
              <p style="font-size:11px; color:#64748b; margin-bottom:14px;">Formulas and definitions used across the V79 analytics engine for this report.</p>
              <div class="grid grid-cols-2 gap-x-6 gap-y-4">
                <div class="def-card" style="border-color:#059669;">
                  <div class="def-term" style="color:#059669;">MTTI &middot; Mean Time To Install</div>
                  <div class="def-body">Computed for jobs in the St. Lucia Installations department. Duration is measured in hours from job creation to completion. Business Hours mode tallies only 08:00&ndash;17:00 on weekdays.</div>
                </div>
                <div class="def-card" style="border-color:#d97706;">
                  <div class="def-term" style="color:#d97706;">MTTR &middot; Mean Time To Repair</div>
                  <div class="def-body">Computed for jobs in the St. Lucia Fault Repair External department. Measures elapsed restoration time from fault ticket creation to verified resolution.</div>
                </div>
                <div class="def-card" style="border-color:#0f172a;">
                  <div class="def-term" style="color:#0f172a;">SLA Attainment</div>
                  <div class="def-body">Proportion of completed jobs finished within the ${mtti.slaTargetHours}h target threshold, relative to total completed jobs: (SLA Met Count &divide; Total Completed) &times; 100.</div>
                </div>
                <div class="def-card" style="border-color:#0284c7;">
                  <div class="def-term" style="color:#0284c7;">4-Week Moving Average</div>
                  <div class="def-body">Smoothing applied to weekly MTTI/MTTR trends. For week W, aggregates the mean of week W and the 3 preceding weeks to reveal underlying velocity.</div>
                </div>
                <div class="def-card" style="border-color:#e11d48;">
                  <div class="def-term" style="color:#e11d48;">Backlog Age Distribution</div>
                  <div class="def-body">Active open tickets grouped into aging buckets (&lt;24h, 24&ndash;48h, 2&ndash;7d, 7&ndash;15d, 15&ndash;30d, &gt;30d) to highlight tickets requiring priority dispatch.</div>
                </div>
                <div class="def-card" style="border-color:#64748b;">
                  <div class="def-term" style="color:#64748b;">Department Volume Comparison</div>
                  <div class="def-body">Aggregates total job volumes across active departments to evaluate resource allocation and demand distribution.</div>
                </div>
                <div class="def-card" style="border-color:#0284c7;">
                  <div class="def-term" style="color:#0284c7;">Rolling 7-Day Turnaround</div>
                  <div class="def-body">Rolling 7-day mean resolution time for completed jobs, smoothing daily spikes to track short-term delivery momentum.</div>
                </div>
                <div class="def-card" style="border-color:#94a3b8;">
                  <div class="def-term" style="color:#64748b;">Backlog &amp; Aging Analysis</div>
                  <div class="def-body">Open tickets evaluated against the current reference date to determine age in hours, categorized into risk brackets for supervisory follow-up.</div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align:center; padding-top:16px;">
              <div style="height:3px; background:linear-gradient(90deg,#e11d48,#059669); border-radius:2px; margin-bottom:12px;"></div>
              <div style="font-size:9px; color:#94a3b8;">Digicel St. Lucia Service Delivery Operations &middot; Confidential Executive Report &middot; Generated via D+ Analytics Platform</div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-modal-close').addEventListener('click', () => {
      printContainer.className = 'hidden';
    });

    document.getElementById('btn-modal-save-pdf').addEventListener('click', () => {
      const element = printContainer.querySelector('#pdf-report-body');
      const wrapper = printContainer.querySelector('.max-h-\\[90vh\\]');
      
      // Expand element and wrapper to prevent html2canvas cropping
      element.classList.remove('overflow-y-auto');
      element.style.overflow = 'visible';
      element.style.height = 'auto';
      
      if (wrapper) {
        wrapper.classList.remove('max-h-[90vh]', 'overflow-hidden');
        wrapper.style.maxHeight = 'none';
        wrapper.style.overflow = 'visible';
      }
      
      printContainer.classList.remove('overflow-y-auto', 'fixed', 'inset-0');
      printContainer.style.position = 'absolute';
      printContainer.style.top = '0';
      printContainer.style.left = '0';
      printContainer.style.width = '100%';
      printContainer.style.height = 'auto';
      printContainer.style.overflow = 'visible';

      // Helper to convert OKLCH color strings to RGB format to prevent html2canvas crash on Tailwind v4 styles
      const oklchToRgb = (oklchStr) => {
        try {
          let clean = oklchStr.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
          const match = clean.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+%?)(?:\s*(?:\/|alpha)?\s*([0-9.]+%?))?\s*\)/i);
          if (!match) return null;

          let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
          let C = match[2].endsWith('%') ? parseFloat(match[2]) / 100 * 0.4 : parseFloat(match[2]);
          let H = match[3].endsWith('%') ? parseFloat(match[3]) / 100 * 360 : parseFloat(match[3]);
          let alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

          const hRad = (H * Math.PI) / 180;
          const lab_a = C * Math.cos(hRad);
          const lab_b = C * Math.sin(hRad);

          const l_ = L + 0.3963377774 * lab_a + 0.2158037573 * lab_b;
          const m_ = L - 0.1055613458 * lab_a - 0.0638541728 * lab_b;
          const s_ = L - 0.0894841775 * lab_a - 1.2914855480 * lab_b;

          const l = l_ * l_ * l_;
          const m = m_ * m_ * m_;
          const s = s_ * s_ * s_;

          let rLine = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
          let gLine = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
          let bLine = -0.0041960863 * l - 0.7034186145 * m + 1.7076147010 * s;

          rLine = Math.max(0, Math.min(1, rLine));
          gLine = Math.max(0, Math.min(1, gLine));
          bLine = Math.max(0, Math.min(1, bLine));

          const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

          const r = Math.round(gamma(rLine) * 255);
          const g = Math.round(gamma(gLine) * 255);
          const b = Math.round(gamma(bLine) * 255);

          return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } catch (e) {
          return null;
        }
      };

      const oklabToRgb = (oklabStr) => {
        try {
          let clean = oklabStr.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
          const match = clean.match(/oklab\(\s*([\-0-9.]+%?)\s+([\-0-9.]+%?)\s+([\-0-9.]+%?)(?:\s*(?:\/|alpha)?\s*([0-9.]+%?))?\s*\)/i);
          if (!match) return null;

          let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
          let lab_a = match[2].endsWith('%') ? parseFloat(match[2]) / 100 * 0.4 : parseFloat(match[2]);
          let lab_b = match[3].endsWith('%') ? parseFloat(match[3]) / 100 * 0.4 : parseFloat(match[3]);
          let alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

          const l_ = L + 0.3963377774 * lab_a + 0.2158037573 * lab_b;
          const m_ = L - 0.1055613458 * lab_a - 0.0638541728 * lab_b;
          const s_ = L - 0.0894841775 * lab_a - 1.2914855480 * lab_b;

          const l = l_ * l_ * l_;
          const m = m_ * m_ * m_;
          const s = s_ * s_ * s_;

          let rLine = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
          let gLine = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
          let bLine = -0.0041960863 * l - 0.7034186145 * m + 1.7076147010 * s;

          rLine = Math.max(0, Math.min(1, rLine));
          gLine = Math.max(0, Math.min(1, gLine));
          bLine = Math.max(0, Math.min(1, bLine));

          const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

          const r = Math.round(gamma(rLine) * 255);
          const g = Math.round(gamma(gLine) * 255);
          const b = Math.round(gamma(bLine) * 255);

          return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } catch (e) {
          return null;
        }
      };

      const replaceModernColors = (str) => {
        if (!str || typeof str !== 'string') return str;
        let res = str;
        if (res.includes('oklch')) {
          res = res.replace(/oklch\([^)]+\)/gi, (match) => oklchToRgb(match) || match);
        }
        if (res.includes('oklab')) {
          res = res.replace(/oklab\([^)]+\)/gi, (match) => oklabToRgb(match) || match);
        }
        if (res.includes('color(display-p3')) {
          // Simplistic fallback for display-p3
          res = res.replace(/color\(display-p3[^)]+\)/gi, 'rgb(128, 128, 128)');
        }
        return res;
      };

      // Monkeypatch window.getComputedStyle
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function(el, pseudoElt) {
        const style = originalGetComputedStyle.call(this, el, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function(propertyName) {
                const val = target.getPropertyValue(propertyName);
                return replaceModernColors(val);
              };
            }
            const val = target[prop];
            if (typeof val === 'function') {
              return val.bind(target);
            }
            if (typeof val === 'string') {
              return replaceModernColors(val);
            }
            return val;
          }
        });
      };

      // Duplicate all style rules, replace oklch with rgb, and disable originals
      const safeStylesEl = document.createElement('style');
      safeStylesEl.id = 'html2pdf-safe-styles';
      
      let safeCss = '';
      const originalDisabledStates = [];
      
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          if (sheet.href && !sheet.href.includes(window.location.origin) && !sheet.href.startsWith('/')) {
            return;
          }
          if (sheet.cssRules) {
            Array.from(sheet.cssRules).forEach(rule => {
              let text = rule.cssText;
              if (text.includes('oklch') || text.includes('oklab')) {
                text = replaceModernColors(text);
              }
              safeCss += text + '\n';
            });
          }
        } catch (e) {
          console.warn('Could not read cssRules from stylesheet:', e);
        }
      });
      
      safeStylesEl.textContent = safeCss;
      document.head.appendChild(safeStylesEl);

      Array.from(document.styleSheets).forEach(sheet => {
        if (sheet.ownerNode && sheet.ownerNode !== safeStylesEl) {
          originalDisabledStates.push({ node: sheet.ownerNode, wasDisabled: sheet.disabled });
          sheet.disabled = true;
        }
      });

      const restoreStyles = () => {
        if (element) {
          element.classList.add('overflow-y-auto');
          element.style.overflow = '';
          element.style.height = '';
        }
        if (wrapper) {
          wrapper.classList.add('max-h-[90vh]', 'overflow-hidden');
          wrapper.style.maxHeight = '';
          wrapper.style.overflow = '';
        }
        
        printContainer.classList.add('overflow-y-auto', 'fixed', 'inset-0');
        printContainer.style.position = '';
        printContainer.style.top = '';
        printContainer.style.left = '';
        printContainer.style.width = '';
        printContainer.style.height = '';
        printContainer.style.overflow = '';
        
        const safeStyles = document.getElementById('html2pdf-safe-styles');
        if (safeStyles) safeStyles.remove();

        originalDisabledStates.forEach(item => {
          if (item.node) {
            item.node.disabled = item.wasDisabled;
          }
        });

        window.getComputedStyle = originalGetComputedStyle;
      };

      const opt = {
        margin: [10, 10, 15, 10],
        filename: 'D_Plus_Executive_KPI_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 4, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      if (typeof window.html2pdf === 'undefined') {
        alert('html2pdf.js library is still loading or unavailable. Please try again in a moment.');
        restoreStyles();
        return;
      }

      window.html2pdf().from(element).set(opt).save().then(() => {
        restoreStyles();
      }).catch((err) => {
        console.error('PDF generation error:', err);
        restoreStyles();
      });
    });

    document.getElementById('btn-modal-print').addEventListener('click', () => {
      window.print();
    });

    printContainer.addEventListener('click', (e) => {
      if (e.target === printContainer) {
        printContainer.className = 'hidden';
      }
    });
  }
}

export const exportEngine = new ExportEngine();
window.exportEngine = exportEngine;
