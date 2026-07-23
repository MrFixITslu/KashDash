/**
 * Multi-format Export Engine (CSV, Excel XLSX, PDF Print View, PNG Charts)
 */
import { formatDate, formatHours, formatDays, formatNumber, parseDate } from './utils.js';
import { calculateMTTI } from './mtti.js';
import { calculateMTTR } from './mttr.js';
import html2pdf from 'html2pdf.js';
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
      const currentYear = new Date().getFullYear();
      startDateStr = `${currentYear}-04-01`;
    }
    if (!endDateStr) {
      endDateStr = new Date().toISOString().substring(0, 10);
    }

    const startParsed = parseDate(startDateStr);
    const endParsed = parseDate(endDateStr);

    const startFormatted = startParsed ? formatDate(startParsed).split(' ')[0] : '01/04/' + new Date().getFullYear();
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
      <div class="space-y-2 mt-4" style="page-break-inside: avoid; break-inside: avoid;">
        <h4 class="text-xs font-bold text-slate-700 uppercase">Weekly MTTI Trend (St. Lucia Installations)</h4>
        <img src="${mttiImg}" class="w-[80%] h-auto border border-black rounded-sm mx-auto" />
      </div>
    ` : '';

    let mttrImgSection = mttrImg ? `
      <div class="space-y-2 mt-4" style="page-break-inside: avoid; break-inside: avoid;">
        <h4 class="text-xs font-bold text-slate-700 uppercase">Weekly MTTR Trend (St. Lucia Fault Repair External)</h4>
        <img src="${mttrImg}" class="w-[80%] h-auto border border-black rounded-sm mx-auto" />
      </div>
    ` : '';

    let openAgeImgSection = openAgeImg ? `
      <div class="space-y-2 mt-4" style="page-break-inside: avoid; break-inside: avoid;">
        <h4 class="text-xs font-bold text-slate-700 uppercase">Open Jobs Backlog Age Distribution</h4>
        <img src="${openAgeImg}" class="w-[80%] h-auto border border-black rounded-sm mx-auto" />
      </div>
    ` : '';

    let deptImgSection = deptImg ? `
      <div class="space-y-2 mt-4" style="page-break-inside: avoid; break-inside: avoid;">
        <h4 class="text-xs font-bold text-slate-700 uppercase">Department Volume Comparison</h4>
        <img src="${deptImg}" class="w-[80%] h-auto border border-black rounded-sm mx-auto" />
      </div>
    ` : '';

    let rollingAvgImgSection = rollingAvgImg ? `
      <div class="space-y-2 mt-4" style="page-break-inside: avoid; break-inside: avoid;">
        <h4 class="text-xs font-bold text-slate-700 uppercase">Rolling 7-Day Turnaround Average</h4>
        <img src="${rollingAvgImg}" class="w-[80%] h-auto border border-black rounded-sm mx-auto" />
      </div>
    ` : '';

    printContainer.innerHTML = `
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
        <div id="pdf-report-body" class="p-8 overflow-y-auto space-y-6 bg-white text-slate-900">
          <!-- Header -->
          <div class="border-b border-slate-300 pb-4 flex justify-between items-start">
            <div>
              <h1 class="text-2xl font-black text-slate-900 tracking-tight">DIGICEL ST. LUCIA — D+ SERVICE DELIVERY</h1>
              <h2 class="text-sm font-semibold text-slate-600 uppercase tracking-wide mt-1">Operational KPI & Executive Performance Report</h2>
            </div>
            <div class="text-right text-xs text-slate-500 font-mono">
              <div>Generated: ${nowStr}</div>
              <div class="text-slate-800 font-bold">Analysis Period: ${dateRangeStr}</div>
              <div>Calculation Mode: ${useBusinessHours ? 'Business Hours (08:00 - 17:00 Weekdays)' : 'Calendar Hours (24/7)'}</div>
            </div>
          </div>

          <!-- Executive Insights -->
          <div class="mb-4">
            <h3 class="font-bold text-slate-900 text-sm mb-2">Executive Overview</h3>
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl">
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
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div class="text-[11px] font-bold text-slate-500 uppercase">Filtered Job Volume</div>
              <div class="text-xl font-black text-slate-900 mt-1">${total}</div>
            </div>
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div class="text-[11px] font-bold text-slate-500 uppercase">Completed Jobs</div>
              <div class="text-xl font-black text-emerald-600 mt-1">${completed}</div>
              <div class="text-[9px] text-slate-500 mt-1 leading-normal flex flex-wrap gap-1">
                <span class="whitespace-nowrap">Installs: ${mtti.totalCompleted}</span>
                <span class="text-slate-300">|</span>
                <span class="whitespace-nowrap">Fault Ext: ${mttr.totalCompleted}</span>
                <span class="text-slate-300">|</span>
                <span class="whitespace-nowrap">Others: ${completed - mtti.totalCompleted - mttr.totalCompleted}</span>
              </div>
            </div>
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div class="text-[11px] font-bold text-slate-500 uppercase">Open Backlog</div>
              <div class="text-xl font-black text-blue-600 mt-1">${open}</div>
            </div>
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div class="text-[11px] font-bold text-slate-500 uppercase">Operational Status</div>
              <div class="text-base font-bold text-purple-600 mt-1">Active Review</div>
            </div>
          </div>

          <!-- Core Metrics Breakdown -->
          <div class="grid grid-cols-2 gap-6">
            <div class="p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
              <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> St. Lucia Installations (MTTI)
              </h3>
              <div class="text-xs text-slate-700 space-y-1.5">
                <div>Completed Installs: <strong class="text-slate-900">${mtti.totalCompleted}</strong></div>
                <div>Average MTTI: <strong class="text-emerald-700 font-bold">${mtti.formattedAverageHours}</strong> (${mtti.formattedAverageDays})</div>
                <div>Median MTTI: <strong class="text-slate-900">${mtti.formattedMedianHours}</strong></div>
                <div>SLA Attainment (Target ≤${mtti.slaTargetHours}h): <strong class="text-emerald-700 font-bold">${mtti.slaPercentage.toFixed(1)}%</strong> (${mtti.slaMetCount} met / ${mtti.slaMissedCount} missed)</div>
              </div>
            </div>

            <div class="p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
              <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> St. Lucia Fault Repair External (MTTR)
              </h3>
              <div class="text-xs text-slate-700 space-y-1.5">
                <div>Resolved Faults: <strong class="text-slate-900">${mttr.totalCompleted}</strong></div>
                <div>Average MTTR: <strong class="text-amber-700 font-bold">${mttr.formattedAverageHours}</strong> (${mttr.formattedAverageDays})</div>
                <div>Median MTTR: <strong class="text-slate-900">${mttr.formattedMedianHours}</strong></div>
                <div>SLA Attainment (Target ≤${mttr.slaTargetHours}h): <strong class="text-amber-700 font-bold">${mttr.slaPercentage.toFixed(1)}%</strong> (${mttr.slaMetCount} met / ${mttr.slaMissedCount} missed)</div>
              </div>
            </div>
          </div>

          <!-- Completed Jobs Department Breakdown -->
          <div class="p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
            <h3 class="font-bold text-slate-900 text-xs flex items-center justify-between">
              <span class="flex items-center gap-1.5 uppercase tracking-wide text-slate-600">
                <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                Completed Jobs Breakdown by Department
              </span>
              <span class="text-[10px] font-normal text-slate-500">Excludes Remote Migration tasks</span>
            </h3>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              ${Object.entries(completedDepts).map(([dept, count]) => {
                let subtext = 'Total completed status';
                if (dept === 'St. Lucia Installations') {
                  const total = count;
                  const valid = mtti.totalCompleted;
                  const diff = total - valid;
                  subtext = `<span class="text-[9px] text-emerald-600 font-semibold block mt-0.5">${valid} used in MTTI</span>`;
                  if (diff > 0) {
                    subtext += `<span class="text-[8px] text-slate-400 block">${diff} missing dates/negative</span>`;
                  }
                } else if (dept === 'St. Lucia Fault Repair External') {
                  const total = count;
                  const valid = mttr.totalCompleted;
                  const diff = total - valid;
                  subtext = `<span class="text-[9px] text-amber-600 font-semibold block mt-0.5">${valid} used in MTTR</span>`;
                  if (diff > 0) {
                    subtext += `<span class="text-[8px] text-slate-400 block">${diff} missing dates/negative</span>`;
                  }
                } else if (dept === 'St. Lucia Fault Repair Internal') {
                  subtext = `<span class="text-[9px] text-slate-500 font-semibold block mt-0.5">Separate Internal volume</span>`;
                }
                return `
                  <div class="p-3 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
                    <div>
                      <div class="text-slate-500 font-semibold truncate" title="${dept}">${dept}</div>
                      <div class="text-base font-black text-slate-900 mt-1">${count} <span class="text-[10px] font-normal text-slate-500">jobs</span></div>
                    </div>
                    <div class="border-t border-slate-100 mt-1.5 pt-1">
                      ${subtext}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Graphs / Charts Section -->
          <div class="space-y-6 pt-2" style="page-break-before: always; break-before: page;">
            <h3 class="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">Operational Trend Visualizations & Graphs</h3>
            ${mttiImgSection}
            ${mttrImgSection}
            ${openAgeImgSection}
            ${deptImgSection}
            ${rollingAvgImgSection}
          </div>

          <!-- Methodology & Calculation Guide -->
          <div class="space-y-3 pt-4 border-t border-slate-200 text-xs text-slate-700 leading-relaxed" style="page-break-before: always; break-before: page;">
            <h3 class="text-base font-bold text-slate-900">Data Calculation & Methodology Guide</h3>
            <p>
              This section outlines the exact formulas, metrics definitions, and calculation frameworks implemented across the V79 analytics engine:
            </p>
            <ul class="list-disc pl-5 space-y-2">
              <li>
                <strong>MTTI (Mean Time To Install):</strong> Computed for jobs within the <em>St. Lucia Installations</em> department. The duration is measured in hours from job creation timestamp (dateCreated) to completion timestamp (dateFinished). When Business Hours mode is selected, elapsed time strictly tallies working hours between 08:00 and 17:00 on weekdays, filtering out weekends and overnight hours.
              </li>
              <li>
                <strong>MTTR (Mean Time To Repair):</strong> Computed for jobs within the <em>St. Lucia Fault Repair External</em> department. Measures elapsed restoration time from fault ticket creation to verified resolution.
              </li>
              <li>
                <strong>SLA Attainment (%):</strong> Calculated as the proportion of completed jobs finished within the contractual target threshold (Installations ≤ 48h, Fault Repairs ≤ 48h) relative to total completed jobs: (SLA Met Count / Total Completed Jobs) * 100.
              </li>
              <li>
                <strong>4-Week Moving Average (4W MA):</strong> A smoothing calculation applied to weekly MTTI and MTTR trend graphs. For any target week W, the moving average aggregates the mean performance of week W and the 3 preceding weeks, mitigating weekly volatility to reveal underlying performance velocity.
              </li>
              <li>
                <strong>Open Jobs Backlog Age Distribution:</strong> Evaluates active open tickets against the current timestamp to group them into operational aging buckets (&lt;24h, 24-48h, 2-7d, 7-15d, 15-30d, &gt;30d), highlighting aging tickets requiring priority dispatch.
              </li>
              <li>
                <strong>Department Volume Comparison:</strong> Aggregates total job volumes across all active business departments (Installations, Fault Repairs, Enterprise, etc.) to evaluate resource allocation and demand distribution.
              </li>
              <li>
                <strong>Rolling 7-Day Turnaround Average:</strong> Computes the rolling 7-day mean resolution time for completed jobs, smoothing daily operational spikes to track short-term service delivery momentum.
              </li>
              <li>
                <strong>Backlog & Aging Analysis:</strong> Open tickets are evaluated against the current reference date to determine ticket age in hours, categorized into operational risk brackets for supervisory follow-up.
              </li>
            </ul>
          </div>

          <!-- Footer -->
          <div class="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500">
            Digicel St. Lucia Service Delivery Operations • Confidential Executive Report • Generated via D+ Analytics Platform
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

      const html2pdfLib = window.html2pdf || html2pdf;

      html2pdfLib().from(element).set(opt).save().then(() => {
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
