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

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Weekly MTTI Average (Hours)');

    this.charts.weeklyMTTI = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
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
        ]
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
      (j) => (j.department.toLowerCase().includes('fault repair') || j.department.toLowerCase().includes('fault')) && j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration
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

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Weekly MTTR Average (Hours)');

    this.charts.weeklyMTTR = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
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
        ]
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

    const openJobs = jobs.filter((j) => j.isOpen);

    let under24 = 0;
    let between24And48 = 0;
    let between24And7Days = 0;
    let over7Days = 0;
    let over30Days = 0;

    openJobs.forEach((j) => {
      const hrs = j.openAgeHours || 0;
      if (hrs <= 24) under24++;
      else if (hrs <= 48) between24And48++;
      else if (hrs <= 168) between24And7Days++;
      else if (hrs <= 720) over7Days++;
      else over30Days++;
    });

    const ctx = canvas.getContext('2d');
    const options = this.getCommonOptions('Open Backlog Age Distribution');

    this.charts.openAge = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['<24 Hours', '24-48 Hours', '2-7 Days', '7-30 Days', '>30 Days'],
        datasets: [
          {
            label: 'Open Jobs Count',
            data: [under24, between24And48, between24And7Days, over7Days, over30Days],
            backgroundColor: ['#10b981', '#06b6d4', '#f59e0b', '#f97316', '#ef4444'],
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

      const isInstall = j.department.toLowerCase().includes('install');
      const targetSLA = isInstall ? 48 : 24;
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
            backgroundColor: slaPercentages.map((p) => (p >= 80 ? '#10b981' : p >= 60 ? '#f59e0b' : '#ef4444')),
            borderRadius: 6
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
