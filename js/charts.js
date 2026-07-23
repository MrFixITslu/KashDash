/**
 * Chart.js Visualization Manager for V79 KPI Dashboard
 */
import { getISOWeekKey, getISOWeekString, calculateMean } from './utils.js';

class ChartManager {
  constructor() {
    this.charts = {};
  }

  getCommonOptions(title = '', isDark = true) {
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 750,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { family: 'Inter, system-ui, sans-serif', size: 12, weight: '500' }
          }
        },
        title: {
          display: !!title,
          text: title,
          color: isDark ? '#f8fafc' : '#0f172a',
          font: { family: 'Inter, system-ui, sans-serif', size: 14, weight: '600' }
        },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor },
          beginAtZero: true
        }
      }
    };
  }

  destroyChart(key) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      delete this.charts[key];
    }
  }

  /**
   * Render all dashboard charts based on filtered jobs
   */
  renderAllCharts(jobs, useBusinessHours = false) {
    if (typeof window.Chart === 'undefined') {
      console.warn('Chart.js library is not loaded');
      return;
    }

    if (!window.Chart.valueLabelPluginRegistered) {
      const valueLabelPlugin = {
        id: 'valueLabelPlugin',
        afterDraw(chart) {
          const pluginOpts = chart.config.options.plugins?.valueLabelPlugin;
          if (pluginOpts && pluginOpts.display === false) return;

          const { ctx } = chart;
          ctx.save();

          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (meta.hidden) return;

            const isHorizontal = chart.options.indexAxis === 'y';
            const isDoughnut = chart.config.type === 'doughnut' || chart.config.type === 'pie';

            if (isDoughnut) return;

            meta.data.forEach((element, index) => {
              const val = dataset.data[index];
              if (val === null || val === undefined) return;

              let displayVal = val;
              if (typeof val === 'number') {
                if (dataset.label && dataset.label.includes('%')) {
                  displayVal = val.toFixed(1) + '%';
                } else if (val % 1 !== 0) {
                  displayVal = val.toFixed(1);
                } else {
                  displayVal = val.toString();
                }
              }

              const isDark = document.body.classList.contains('light-theme') === false;
              ctx.font = 'bold 9px Inter, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              const position = element.tooltipPosition();
              let x = position.x;
              let y = position.y;

              if (chart.config.type === 'bar') {
                if (isHorizontal) {
                  ctx.textAlign = 'left';
                  x += 5;
                } else {
                  ctx.textBaseline = 'bottom';
                  y -= 5;
                }
              } else if (chart.config.type === 'line') {
                ctx.textBaseline = 'bottom';
                y -= 6;
              }

              // Draw high contrast background label pill for readability
              const textWidth = ctx.measureText(displayVal).width;
              ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)';
              
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x - textWidth / 2 - 4, y - 6, textWidth + 8, 12, 3);
                ctx.fill();
              } else {
                ctx.fillRect(x - textWidth / 2 - 4, y - 6, textWidth + 8, 12);
              }

              ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
              ctx.fillText(displayVal, x, y);
            });
          });

          ctx.restore();
        }
      };

      window.Chart.register(valueLabelPlugin);
      window.Chart.valueLabelPluginRegistered = true;
    }

    this.renderWeeklyMTTITrend(jobs, useBusinessHours);
    this.renderWeeklyMTTRTrend(jobs, useBusinessHours);
    this.renderCompletedVsCreated(jobs);
    this.renderOpenAgeDistribution(jobs);
    this.renderStatusBreakdown(jobs);
    this.renderEngineerPerformance(jobs, useBusinessHours);
    this.renderDepartmentComparison(jobs);
    this.renderMonthlyTrend(jobs);
    this.renderRollingAverageTrend(jobs, useBusinessHours);
    this.renderRegionSLABreakdown(jobs, useBusinessHours);
  }

  /**
   * 1. Weekly MTTI Trend Chart
   */
  renderWeeklyMTTITrend(jobs, useBusinessHours) {
    this.destroyChart('weeklyMTTI');
    const canvas = document.getElementById('chart-weekly-mtti');
    if (!canvas) return;

    // Filter completed installations
    const installJobs = jobs.filter(
      (j) => j.department.toLowerCase().includes('install') && j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration
    );

    const weekMap = {};
    installJobs.forEach((j) => {
      const weekKey = getISOWeekKey(j.dateFinished);
      const weekLabel = getISOWeekString(j.dateFinished);
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = { label: weekLabel, durations: [] };
      }
      weekMap[weekKey].durations.push(useBusinessHours ? j.businessHours : j.durationHours);
    });

    const sortedWeekKeys = Object.keys(weekMap).sort();
    const labels = sortedWeekKeys.map((k) => weekMap[k].label);
    const data = sortedWeekKeys.map((k) => calculateMean(weekMap[k].durations));

    const mttiMaToggle = document.getElementById('toggle-mtti-ma');
    const showMttiMA = mttiMaToggle ? mttiMaToggle.checked : false;

    const datasets = [
      {
        label: 'Avg MTTI (Hours)',
        data,
        borderColor: '#10b981', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#10b981'
      }
    ];

    if (showMttiMA) {
      const maData = data.map((val, idx, arr) => {
        const start = Math.max(0, idx - 3);
        const slice = arr.slice(start, idx + 1);
        return calculateMean(slice);
      });
      datasets.push({
        label: '4-Week Moving Avg (MTTI)',
        data: maData,
        borderColor: '#38bdf8', // Light blue
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2
      });
    }

    // Add KPI Target Line (48 hours)
    if (labels.length > 0) {
      datasets.push({
        label: 'KPI Target (48 hrs)',
        data: Array(labels.length).fill(48),
        borderColor: '#ef4444',
        borderWidth: 2,
        borderDash: [6, 6],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0
      });
    }

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Weekly MTTI Average (Hours)');

    this.charts.weeklyMTTI = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options
    });
  }

  /**
   * 2. Weekly MTTR Trend Chart
   */
  renderWeeklyMTTRTrend(jobs, useBusinessHours) {
    this.destroyChart('weeklyMTTR');
    const canvas = document.getElementById('chart-weekly-mttr');
    if (!canvas) return;

    const faultJobs = jobs.filter(
      (j) => j.department.toLowerCase().includes('fault') && j.department.toLowerCase().includes('external') && j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration
    );

    const weekMap = {};
    faultJobs.forEach((j) => {
      const weekKey = getISOWeekKey(j.dateFinished);
      const weekLabel = getISOWeekString(j.dateFinished);
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = { label: weekLabel, durations: [] };
      }
      weekMap[weekKey].durations.push(useBusinessHours ? j.businessHours : j.durationHours);
    });

    const sortedWeekKeys = Object.keys(weekMap).sort();
    const labels = sortedWeekKeys.map((k) => weekMap[k].label);
    const data = sortedWeekKeys.map((k) => calculateMean(weekMap[k].durations));

    const mttrMaToggle = document.getElementById('toggle-mttr-ma');
    const showMttrMA = mttrMaToggle ? mttrMaToggle.checked : false;

    const datasets = [
      {
        label: 'Avg MTTR (Hours)',
        data,
        borderColor: '#f59e0b', // Amber
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#f59e0b'
      }
    ];

    if (showMttrMA) {
      const maData = data.map((val, idx, arr) => {
        const start = Math.max(0, idx - 3);
        const slice = arr.slice(start, idx + 1);
        return calculateMean(slice);
      });
      datasets.push({
        label: '4-Week Moving Avg (MTTR)',
        data: maData,
        borderColor: '#ec4899', // Pink
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2
      });
    }

    // Add KPI Target Line (48 hours)
    if (labels.length > 0) {
      datasets.push({
        label: 'KPI Target (48 hrs)',
        data: Array(labels.length).fill(48),
        borderColor: '#ef4444',
        borderWidth: 2,
        borderDash: [6, 6],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0
      });
    }

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Weekly MTTR Average (Hours)');

    this.charts.weeklyMTTR = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options
    });
  }

  /**
   * 3. Completed vs Created Jobs Chart
   */
  renderCompletedVsCreated(jobs) {
    this.destroyChart('completedVsCreated');
    const canvas = document.getElementById('chart-completed-created');
    if (!canvas) return;

    const weekMap = {};

    jobs.forEach((j) => {
      if (j.dateCreated) {
        const key = getISOWeekKey(j.dateCreated);
        const label = getISOWeekString(j.dateCreated);
        if (!weekMap[key]) weekMap[key] = { label, created: 0, completed: 0 };
        weekMap[key].created++;
      }
      if (j.isCompleted && j.dateFinished) {
        const key = getISOWeekKey(j.dateFinished);
        const label = getISOWeekString(j.dateFinished);
        if (!weekMap[key]) weekMap[key] = { label, created: 0, completed: 0 };
        weekMap[key].completed++;
      }
    });

    const sortedKeys = Object.keys(weekMap).sort();
    const labels = sortedKeys.map((k) => weekMap[k].label);
    const createdData = sortedKeys.map((k) => weekMap[k].created);
    const completedData = sortedKeys.map((k) => weekMap[k].completed);

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Jobs Created vs Completed');

    this.charts.completedVsCreated = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Jobs Created',
            data: createdData,
            backgroundColor: '#3b82f6', // Blue
            borderRadius: 6
          },
          {
            label: 'Jobs Completed',
            data: completedData,
            backgroundColor: '#10b981', // Green
            borderRadius: 6
          }
        ]
      },
      options
    });
  }

  /**
   * 4. Open Jobs Age Distribution Chart
   */
  renderOpenAgeDistribution(jobs) {
    this.destroyChart('openAge');
    const canvas = document.getElementById('chart-open-age');
    if (!canvas) return;

    const openJobs = jobs.filter((j) => j.isOpen && (
      j.department.toLowerCase().includes('install') ||
      (j.department.toLowerCase().includes('fault') && j.department.toLowerCase().includes('external'))
    ));

    let under24 = 0;
    let between24And48 = 0;
    let between24And7Days = 0;
    let between7And15Days = 0;
    let between15And30Days = 0;
    let over30Days = 0;

    openJobs.forEach((j) => {
      const hrs = j.openAgeHours || 0;
      if (hrs <= 24) under24++;
      else if (hrs <= 48) between24And48++;
      else if (hrs <= 168) between24And7Days++;
      else if (hrs <= 360) between7And15Days++;
      else if (hrs <= 720) between15And30Days++;
      else over30Days++;
    });

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Open Backlog Age Distribution');

    this.charts.openAge = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['<24 Hours', '24-48 Hours', '2-7 Days', '7-15 Days', '15-30 Days', '>30 Days'],
        datasets: [
          {
            label: 'Open Jobs Count',
            data: [under24, between24And48, between24And7Days, between7And15Days, between15And30Days, over30Days],
            backgroundColor: ['#10b981', '#06b6d4', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'],
            borderRadius: 6
          }
        ]
      },
      options: {
        ...options,
        plugins: {
          ...options.plugins,
          legend: { display: false }
        }
      }
    });
  }

  /**
   * 5. Status Breakdown Doughnut Chart
   */
  renderStatusBreakdown(jobs) {
    this.destroyChart('status');
    const canvas = document.getElementById('chart-status');
    if (!canvas) return;

    const statusCounts = {};
    jobs.forEach((j) => {
      statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    const colorMap = {
      'Completed': '#10b981',
      'Created': '#3b82f6',
      'Confirmed': '#06b6d4',
      'Open': '#f59e0b',
      'Manager Hold': '#eab308',
      'Pending': '#8b5cf6',
      'Failed': '#ef4444',
      'Fail Request': '#f43f5e',
      'Cancelled': '#64748b'
    };

    const bgColors = labels.map((l) => colorMap[l] || '#94a3b8');

    const ctx = canvas.getContext('2d');

    this.charts.status = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: bgColors,
            borderColor: '#0f172a',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { size: 11 } }
          }
        },
        cutout: '65%'
      }
    });
  }

  /**
   * 6. Engineer Performance Horizontal Bar
   */
  renderEngineerPerformance(jobs, useBusinessHours) {
    this.destroyChart('engineer');
    const canvas = document.getElementById('chart-engineer');
    if (!canvas) return;

    const engMap = {};

    jobs.forEach((j) => {
      if (!j.engineer || j.engineer === 'Unassigned') return;
      if (!engMap[j.engineer]) {
        engMap[j.engineer] = { engineer: j.engineer, completed: 0, durations: [] };
      }
      if (j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration) {
        engMap[j.engineer].completed++;
        engMap[j.engineer].durations.push(useBusinessHours ? j.businessHours : j.durationHours);
      }
    });

    const engList = Object.values(engMap)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10);

    const labels = engList.map((e) => e.engineer);
    const completedData = engList.map((e) => e.completed);
    const avgHoursData = engList.map((e) => calculateMean(e.durations));

    const ctx = canvas.getContext('2d');

    this.charts.engineer = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Completed Jobs',
            data: completedData,
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Avg Completion Hours',
            data: avgHoursData,
            backgroundColor: '#3b82f6',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        ...this.getCommonOptions('Top Engineer Output & Avg Time')
      }
    });
  }

  /**
   * 7. Department Comparison Chart
   */
  renderDepartmentComparison(jobs) {
    this.destroyChart('department');
    const canvas = document.getElementById('chart-department');
    if (!canvas) return;

    const deptMap = {};

    jobs.forEach((j) => {
      if (!deptMap[j.department]) {
        deptMap[j.department] = { total: 0, completed: 0, open: 0 };
      }
      deptMap[j.department].total++;
      if (j.isCompleted) deptMap[j.department].completed++;
      if (j.isOpen) deptMap[j.department].open++;
    });

    const labels = Object.keys(deptMap);
    const totalData = labels.map((l) => deptMap[l].total);
    const completedData = labels.map((l) => deptMap[l].completed);
    const openData = labels.map((l) => deptMap[l].open);

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Department Operational Volume');

    this.charts.department = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Total Jobs', data: totalData, backgroundColor: '#64748b', borderRadius: 4 },
          { label: 'Completed', data: completedData, backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Open Backlog', data: openData, backgroundColor: '#f59e0b', borderRadius: 4 }
        ]
      },
      options
    });
  }

  /**
   * 8. Monthly Trend Chart
   */
  renderMonthlyTrend(jobs) {
    this.destroyChart('monthly');
    const canvas = document.getElementById('chart-monthly');
    if (!canvas) return;

    const monthMap = {};

    jobs.forEach((j) => {
      if (!j.dateCreated) return;
      const mKey = `${j.dateCreated.getFullYear()}-${String(j.dateCreated.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = j.dateCreated.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!monthMap[mKey]) monthMap[mKey] = { label: mLabel, count: 0 };
      monthMap[mKey].count++;
    });

    const sortedKeys = Object.keys(monthMap).sort();
    const labels = sortedKeys.map((k) => monthMap[k].label);
    const data = sortedKeys.map((k) => monthMap[k].count);

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Monthly Job Intake');

    this.charts.monthly = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Jobs Logged',
            data,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options
    });
  }

  /**
   * 9. Rolling 7-Day & 30-Day Average
   */
  renderRollingAverageTrend(jobs, useBusinessHours) {
    this.destroyChart('rollingAverage');
    const canvas = document.getElementById('chart-rolling-average');
    if (!canvas) return;

    // Group completed jobs by Date Finished YYYY-MM-DD
    const dateMap = {};

    jobs.filter((j) => j.isCompleted && j.dateFinished && !j.isNegativeDuration).forEach((j) => {
      const d = j.dateFinished;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(useBusinessHours ? j.businessHours : j.durationHours);
    });

    const sortedDates = Object.keys(dateMap).sort();
    const dailyAvgs = sortedDates.map((d) => calculateMean(dateMap[d]));

    // Calculate rolling 7-day averages
    const rolling7 = dailyAvgs.map((val, idx, arr) => {
      const start = Math.max(0, idx - 6);
      const subset = arr.slice(start, idx + 1);
      return calculateMean(subset);
    });

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Rolling Turnaround Time (Hours)');
    options.plugins = {
      ...options.plugins,
      valueLabelPlugin: { display: false }
    };

    this.charts.rollingAverage = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [
          {
            label: 'Daily Avg Hours',
            data: dailyAvgs,
            borderColor: '#64748b',
            borderWidth: 1,
            pointRadius: 2
          },
          {
            label: 'Rolling 7-Day Avg',
            data: rolling7,
            borderColor: '#10b981',
            borderWidth: 3,
            pointRadius: 3
          }
        ]
      },
      options
    });
  }

  /**
   * 10. Region SLA Breakdown
   */
  renderRegionSLABreakdown(jobs, useBusinessHours) {
    this.destroyChart('regionSLA');
    const canvas = document.getElementById('chart-region-sla');
    if (!canvas) return;

    const regionMap = {};

    jobs.filter((j) => j.isCompleted && j.region).forEach((j) => {
      if (!regionMap[j.region]) {
        regionMap[j.region] = { met: 0, total: 0 };
      }
      regionMap[j.region].total++;

      const targetSLA = 48;
      const dur = useBusinessHours ? j.businessHours : j.durationHours;

      if (dur <= targetSLA) {
        regionMap[j.region].met++;
      }
    });

    const labels = Object.keys(regionMap).sort();
    const slaPercentages = labels.map((r) => {
      const item = regionMap[r];
      return item.total > 0 ? (item.met / item.total) * 100 : 0;
    });

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Regional SLA Performance %');

    this.charts.regionSLA = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'SLA Attainment %',
            data: slaPercentages,
            backgroundColor: slaPercentages.map((p) => (p >= 95 ? '#10b981' : p >= 85 ? '#f59e0b' : '#ef4444')),
            borderRadius: 6
          },
          {
            label: 'SLA Target (95%)',
            type: 'line',
            data: Array(labels.length).fill(95),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        ...options,
        scales: {
          ...options.scales,
          y: {
            ...options.scales.y,
            max: 100,
            ticks: {
              callback: (v) => `${v}%`
            }
          }
        }
      }
    });
  }
}

export const chartManager = new ChartManager();
