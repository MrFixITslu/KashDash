/**
 * Executive Summary and Validation Report Generator
 */
import { formatNumber, formatHours, formatDays, formatDate, parseDate, getFiscalYearStartDateString } from './utils.js';
import { calculateMTTI } from './mtti.js';
import { calculateMTTR } from './mttr.js';

/**
 * Generate plain-English executive summary based on filtered job state
 */
export function generateExecutiveSummary(jobs, useBusinessHours = false) {
  if (!jobs || jobs.length === 0) {
    return `
      <div class="summary-paragraph p-4 rounded-lg bg-slate-800/50 text-slate-400">
        No jobs match the currently selected filter criteria. Please adjust your filters or upload job export data.
      </div>
    `;
  }

  const total = jobs.length;
  const completedJobs = jobs.filter((j) => j.isCompleted);
  const openJobs = jobs.filter((j) => j.isOpen && (
    j.department.toLowerCase().includes('install') ||
    (j.department.toLowerCase().includes('fault') && j.department.toLowerCase().includes('external'))
  ));
  const cancelledJobs = jobs.filter((j) => j.status === 'Cancelled');
  const failedJobs = jobs.filter((j) => j.status === 'Failed' || j.status === 'Fail Request');

  // MTTI & MTTR stats
  const mtti = calculateMTTI(jobs, 48, useBusinessHours);
  const mttr = calculateMTTR(jobs, 48, useBusinessHours);

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

  // Open jobs aging statistics
  const over24h = openJobs.filter((j) => (j.openAgeHours || 0) > 24).length;
  const over48h = openJobs.filter((j) => (j.openAgeHours || 0) > 48).length;
  const over7d = openJobs.filter((j) => (j.openAgeHours || 0) > 168).length;
  const over30d = openJobs.filter((j) => (j.openAgeHours || 0) > 720).length;

  // Engineer highlight
  const engMap = {};
  completedJobs.forEach((j) => {
    if (j.engineer && j.engineer !== 'Unassigned') {
      engMap[j.engineer] = (engMap[j.engineer] || 0) + 1;
    }
  });

  let topEngineerName = 'N/A';
  let topEngineerCount = 0;
  for (const [eng, count] of Object.entries(engMap)) {
    if (count > topEngineerCount) {
      topEngineerCount = count;
      topEngineerName = eng;
    }
  }

  const overallCompletionRate = total > 0 ? (completedJobs.length / total) * 100 : 0;

  // Group completed jobs by department to explain any volume differences
  const completedDepts = {};
  completedJobs.forEach((j) => {
    const dept = j.department || 'Unspecified';
    completedDepts[dept] = (completedDepts[dept] || 0) + 1;
  });

  const totalInstallsCompleted = completedJobs.filter(j => j.department === 'St. Lucia Installations').length;
  const totalFaultExternalCompleted = completedJobs.filter(j => j.department === 'St. Lucia Fault Repair External').length;

  const excludedInstalls = totalInstallsCompleted - mtti.totalCompleted;
  const excludedFaults = totalFaultExternalCompleted - mttr.totalCompleted;

  const deptBreakdownStr = Object.entries(completedDepts)
    .map(([dept, count]) => {
      let extraInfo = '';
      if (dept === 'St. Lucia Installations') {
        extraInfo = ` <span class="text-xs text-slate-400">(${mtti.totalCompleted} with valid dates used for MTTI${excludedInstalls > 0 ? `, ${excludedInstalls} missing dates/negative` : ''})</span>`;
      } else if (dept === 'St. Lucia Fault Repair External') {
        extraInfo = ` <span class="text-xs text-slate-400">(${mttr.totalCompleted} with valid dates used for MTTR${excludedFaults > 0 ? `, ${excludedFaults} missing dates/negative` : ''})</span>`;
      }
      return `${dept}: <span class="text-white font-bold">${count}</span>${extraInfo}`;
    })
    .join(', ');

  let summaryHTML = `
    <div class="space-y-3 text-slate-200 text-sm leading-relaxed">
      <div class="flex items-center justify-between border-b border-slate-700/50 pb-2 mb-3">
        <span class="text-xs font-semibold uppercase text-slate-400 tracking-wider">Analysis Period: <span class="text-white font-bold">${dateRangeStr}</span></span>
        <span class="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">${useBusinessHours ? 'Business Hours (08:00 - 17:00)' : 'Calendar Hours'}</span>
      </div>

      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0"></span>
        <p>
          <strong class="text-white">St. Lucia Installations:</strong> Completed <span class="text-emerald-400 font-bold">${mtti.totalCompleted}</span> installation jobs with an average MTTI of <span class="text-emerald-400 font-bold">${mtti.formattedAverageHours}</span> (${mtti.formattedAverageDays}). SLA attainment stands at <span class="text-emerald-400 font-bold">${formatNumber(mtti.slaPercentage, 1)}%</span>.
        </p>
      </div>

      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0"></span>
        <p>
          <strong class="text-white">St. Lucia Fault Repair External:</strong> Resolved <span class="text-amber-400 font-bold">${mttr.totalCompleted}</span> fault repair jobs with an average MTTR of <span class="text-amber-400 font-bold">${mttr.formattedAverageHours}</span> (${mttr.formattedAverageDays}). SLA attainment stands at <span class="text-amber-400 font-bold">${formatNumber(mttr.slaPercentage, 1)}%</span>.
        </p>
      </div>

      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></span>
        <p>
          <strong class="text-white">Operational Volume & Backlog:</strong> Total active backlog contains <span class="text-blue-400 font-bold">${openJobs.length}</span> open tickets across all departments. Overall job completion rate is <span class="text-blue-400 font-bold">${formatNumber(overallCompletionRate, 1)}%</span> (${completedJobs.length} completed out of ${total} total).
        </p>
      </div>

      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-slate-400 mt-2 shrink-0"></span>
        <p>
          <strong class="text-slate-300">Completed Volume Breakdown:</strong> The total of <span class="text-slate-300 font-bold">${completedJobs.length}</span> completed jobs comprises: ${deptBreakdownStr}. This accounts for all completed work, clarifying individual core metrics (MTTI/MTTR) against system-wide volume.
        </p>
      </div>
  `;

  if (over30d > 0 || over7d > 0) {
    summaryHTML += `
      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0"></span>
        <p>
          <strong class="text-rose-400">Aging Backlog Alerts:</strong> <span class="text-rose-400 font-bold">${over30d}</span> open jobs have been active for >30 days, and <span class="text-amber-400 font-bold">${over7d}</span> open jobs have exceeded 7 days. Immediate supervisor intervention recommended.
        </p>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0"></span>
        <p>
          <strong class="text-emerald-400">Aging Health:</strong> No critical open tickets exceed 30 days. Backlog aging is under control.
        </p>
      </div>
    `;
  }

  if (topEngineerCount > 0) {
    summaryHTML += `
      <div class="flex items-start gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-purple-500 mt-2 shrink-0"></span>
        <p>
          <strong class="text-white">Engineer Spotlight:</strong> Lead field engineer <span class="text-purple-300 font-bold">${topEngineerName}</span> produced the highest output with <span class="text-purple-300 font-bold">${topEngineerCount}</span> completed tickets.
        </p>
      </div>
    `;
  }

  summaryHTML += `</div>`;
  return summaryHTML;
}

/**
 * Render Data Validation Modal / Drawer
 */
export function renderValidationReport(report) {
  if (!report) return '';

  const dupsList = report.duplicateJobNumbers.slice(0, 10).join(', ');
  const moreDups = report.duplicateJobNumbers.length > 10 ? `...and ${report.duplicateJobNumbers.length - 10} more` : '';

  return `
    <div class="p-4 space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl">
          <div class="text-xs text-slate-400 uppercase font-medium">Total Raw Rows</div>
          <div class="text-xl font-bold text-white mt-1">${report.totalRawRows}</div>
        </div>
        <div class="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl">
          <div class="text-xs text-emerald-400 uppercase font-medium">Valid Records</div>
          <div class="text-xl font-bold text-emerald-400 mt-1">${report.validJobsCount}</div>
        </div>
        <div class="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl">
          <div class="text-xs text-amber-400 uppercase font-medium">Duplicates Deduplicated</div>
          <div class="text-xl font-bold text-amber-400 mt-1">${report.duplicatesRemovedCount}</div>
        </div>
        <div class="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl">
          <div class="text-xs text-rose-400 uppercase font-medium">Negative Durations</div>
          <div class="text-xl font-bold text-rose-400 mt-1">${report.negativeDurationCount}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-2">
          <h4 class="font-semibold text-slate-200 text-sm">Data Anomaly Flags</h4>
          <ul class="text-xs space-y-1.5 text-slate-300">
            <li class="flex justify-between border-b border-slate-700/40 pb-1">
              <span>Missing Date Created:</span>
              <span class="font-mono ${report.missingCreatedDateCount > 0 ? 'text-amber-400' : 'text-slate-400'}">${report.missingCreatedDateCount}</span>
            </li>
            <li class="flex justify-between border-b border-slate-700/40 pb-1">
              <span>Missing Finish Date (Completed Jobs):</span>
              <span class="font-mono ${report.missingFinishDateCount > 0 ? 'text-amber-400' : 'text-slate-400'}">${report.missingFinishDateCount}</span>
            </li>
            <li class="flex justify-between border-b border-slate-700/40 pb-1">
              <span>Blank Rows Skipped:</span>
              <span class="font-mono text-slate-400">${report.blankRowsIgnoredCount}</span>
            </li>
          </ul>
        </div>

        <div class="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-2">
          <h4 class="font-semibold text-slate-200 text-sm">Department Breakdown Ingested</h4>
          <ul class="text-xs space-y-1 text-slate-300">
            ${Object.entries(report.departmentCounts || {})
              .map(
                ([dept, count]) => `
              <li class="flex justify-between border-b border-slate-700/30 pb-0.5">
                <span class="truncate">${dept}:</span>
                <span class="font-bold text-emerald-400 ml-2">${count}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      </div>

      ${
        report.duplicatesRemovedCount > 0
          ? `
        <div class="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300">
          <strong>Duplicate Job Numbers Resolved:</strong> ${dupsList} ${moreDups}
        </div>
      `
          : ''
      }
    </div>
  `;
}
