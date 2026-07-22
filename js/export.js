/**
 * Multi-format Export Engine (CSV, Excel XLSX, PDF Print View, PNG Charts)
 */
import { formatDate, formatHours, formatDays, formatNumber } from './utils.js';
import { calculateMTTI } from './mtti.js';
import { calculateMTTR } from './mttr.js';

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
    const mtti = calculateMTTI(jobs);
    const mttr = calculateMTTR(jobs);
    const completed = jobs.filter((j) => j.isCompleted).length;
    const open = jobs.filter((j) => j.isOpen).length;

    const summaryData = [
      ['Digicel St. Lucia - V79 Service Delivery Operational KPI Summary'],
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
      ['Open Jobs > 24 Hours', jobs.filter((j) => j.isOpen && j.openAgeHours > 24).length],
      ['Open Jobs > 48 Hours', jobs.filter((j) => j.isOpen && j.openAgeHours > 48).length],
      ['Open Jobs > 7 Days', jobs.filter((j) => j.isOpen && j.openAgeHours > 168).length],
      ['Open Jobs > 30 Days', jobs.filter((j) => j.isOpen && j.openAgeHours > 720).length]
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
   * Print PDF report / open print preview window
   */
  printPDFReport() {
    window.print();
  }
}

export const exportEngine = new ExportEngine();
