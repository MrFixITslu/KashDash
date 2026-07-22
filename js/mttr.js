/**
 * MTTR (Mean Time To Repair) Engine for St. Lucia Fault Repair External
 */
import { calculateMean, calculateMedian, formatHours, formatDays } from './utils.js';

/**
 * Filter jobs belonging to St. Lucia Fault Repair External department
 */
export function getFaultRepairJobs(jobs) {
  if (!jobs) return [];
  return jobs.filter(
    (j) => j.department && (j.department.toLowerCase().includes('fault repair') || j.department.toLowerCase().includes('fault'))
  );
}

/**
 * Calculate MTTR statistics for completed fault repair external jobs
 * @param {Array<Object>} jobs - Array of cleaned job objects
 * @param {number} [slaTargetHours=24] - SLA threshold in hours (default 24 hours for fault repair)
 * @param {boolean} [useBusinessHours=false] - Whether to use business hours vs calendar hours
 * @returns {Object} MTTR Metrics
 */
export function calculateMTTR(jobs, slaTargetHours = 24, useBusinessHours = false) {
  const faultJobs = getFaultRepairJobs(jobs);
  const completedJobs = faultJobs.filter((j) => j.isCompleted && j.dateCreated && j.dateFinished && !j.isNegativeDuration);

  if (completedJobs.length === 0) {
    return {
      department: 'St. Lucia Fault Repair External',
      totalCompleted: 0,
      averageHours: 0,
      averageDays: 0,
      medianHours: 0,
      medianDays: 0,
      minHours: 0,
      maxHours: 0,
      fastestJob: null,
      slowestJob: null,
      slaTargetHours,
      slaMetCount: 0,
      slaMissedCount: 0,
      slaPercentage: 0,
      formattedAverageHours: '0.0 hrs',
      formattedAverageDays: '0.0 days',
      formattedMedianHours: '0.0 hrs',
      formattedMedianDays: '0.0 days'
    };
  }

  const durations = completedJobs.map((j) => (useBusinessHours ? j.businessHours : j.durationHours));

  const averageHours = calculateMean(durations);
  const averageDays = averageHours / 24;
  const medianHours = calculateMedian(durations);
  const medianDays = medianHours / 24;

  let minHours = Infinity;
  let maxHours = -Infinity;
  let fastestJob = null;
  let slowestJob = null;

  let slaMetCount = 0;
  let slaMissedCount = 0;

  completedJobs.forEach((job) => {
    const dur = useBusinessHours ? job.businessHours : job.durationHours;

    if (dur <= slaTargetHours) {
      slaMetCount++;
    } else {
      slaMissedCount++;
    }

    if (dur < minHours) {
      minHours = dur;
      fastestJob = job;
    }

    if (dur > maxHours) {
      maxHours = dur;
      slowestJob = job;
    }
  });

  const slaPercentage = (slaMetCount / completedJobs.length) * 100;

  return {
    department: 'St. Lucia Fault Repair External',
    totalCompleted: completedJobs.length,
    averageHours,
    averageDays,
    medianHours,
    medianDays,
    minHours: minHours === Infinity ? 0 : minHours,
    maxHours: maxHours === -Infinity ? 0 : maxHours,
    fastestJob,
    slowestJob,
    slaTargetHours,
    slaMetCount,
    slaMissedCount,
    slaPercentage,
    formattedAverageHours: formatHours(averageHours),
    formattedAverageDays: formatDays(averageHours),
    formattedMedianHours: formatHours(medianHours),
    formattedMedianDays: formatDays(medianHours),
    completedJobsList: completedJobs
  };
}
