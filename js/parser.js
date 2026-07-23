/**
 * Data Cleaning & Normalization Engine for Konnexx Job Exports
 */
import { parseDate, getDurationHours, getBusinessHours } from './utils.js';

// Header mapping dictionary (Konnexx export columns -> Standard columns)
const HEADER_MAPPING = {
  // Job Number
  'job number': 'jobNumber',
  'jobnumber': 'jobNumber',
  'job_number': 'jobNumber',
  'id': 'jobId',

  // Department
  'department': 'department',
  'departmentname': 'department',
  'department_name': 'department',

  // Status
  'status': 'status',
  'jobstatusfull': 'status',
  'job_status_full': 'status',
  'jobstatus': 'status',

  // Engineer
  'engineer': 'engineer',
  'engineers': 'engineer',

  // Customer
  'customer': 'customer',
  'customername': 'customer',
  'customer_name': 'customer',

  // Technology
  'technology': 'technology',
  'jobtypes': 'technology',
  'job_types': 'technology',
  'jobdescription': 'technology',

  // Dates
  'date created': 'dateCreated',
  'datecreated': 'dateCreated',
  'date_created': 'dateCreated',
  'date finished': 'dateFinished',
  'datefinished': 'dateFinished',
  'date_finished': 'dateFinished',
  'date started': 'dateStarted',
  'datestarted': 'dateStarted',

  // Region / City
  'region': 'region',
  'city': 'region',
  'geoareaname': 'region',
  'county': 'county',

  // Priority
  'priority': 'priority',

  // Category & Sub Category
  'category': 'category',
  'failuretype': 'category',
  'failure_type': 'category',
  'sub category': 'subCategory',
  'subcategory': 'subCategory',
  'failurereason': 'subCategory',
  'failure_reason': 'subCategory',

  // Contractor
  'contractor': 'contractor',
  'contractorname': 'contractor',
  'contractor_name': 'contractor',
  'subcontractor': 'contractor'
};

/**
 * Standardize job object structure and map fields
 */
function mapRawRow(rawRow) {
  const job = {
    raw: rawRow,
    jobNumber: '',
    department: 'Unspecified',
    status: 'Unknown',
    engineer: 'Unassigned',
    contractor: 'Unassigned',
    customer: 'Unknown Customer',
    technology: 'Standard',
    dateCreated: null,
    dateStarted: null,
    dateFinished: null,
    region: 'St. Lucia',
    priority: 'Normal',
    category: 'General',
    subCategory: 'N/A',
    onHoldReason: '',
    durationHours: 0,
    businessHours: 0,
    openAgeHours: 0,
    isCompleted: false,
    isOpen: false,
    isNegativeDuration: false,
    validationFlags: []
  };

  // Iterate over row keys and map using case-insensitive matching
  for (const [key, val] of Object.entries(rawRow)) {
    if (val === null || val === undefined) continue;
    const cleanKey = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const mappedField = HEADER_MAPPING[cleanKey] || HEADER_MAPPING[String(key).trim().toLowerCase()];

    const cleanVal = typeof val === 'string' ? val.trim() : val;

    if (mappedField) {
      if (mappedField === 'jobNumber' && cleanVal) job.jobNumber = String(cleanVal);
      else if (mappedField === 'jobId' && !job.jobNumber && cleanVal) job.jobNumber = String(cleanVal);
      else if (mappedField === 'department' && cleanVal) job.department = String(cleanVal);
      else if (mappedField === 'status' && cleanVal) job.status = String(cleanVal);
      else if (mappedField === 'engineer' && cleanVal) job.engineer = String(cleanVal);
      else if (mappedField === 'contractor' && cleanVal) job.contractor = String(cleanVal);
      else if (mappedField === 'customer' && cleanVal) job.customer = String(cleanVal);
      else if (mappedField === 'technology' && cleanVal) job.technology = String(cleanVal);
      else if (mappedField === 'dateCreated' && cleanVal) job.dateCreated = parseDate(cleanVal);
      else if (mappedField === 'dateStarted' && cleanVal) job.dateStarted = parseDate(cleanVal);
      else if (mappedField === 'dateFinished' && cleanVal) job.dateFinished = parseDate(cleanVal);
      else if (mappedField === 'region' && cleanVal) job.region = String(cleanVal);
      else if (mappedField === 'priority' && cleanVal) job.priority = String(cleanVal);
      else if (mappedField === 'category' && cleanVal) job.category = String(cleanVal);
      else if (mappedField === 'subCategory' && cleanVal) job.subCategory = String(cleanVal);
    }
  }

  // Fallbacks if specific Konnexx fields weren't matched above
  if (!job.jobNumber && rawRow['JobNumber']) job.jobNumber = String(rawRow['JobNumber']).trim();
  if (!job.department && rawRow['DepartmentName']) job.department = String(rawRow['DepartmentName']).trim();
  if (!job.status && rawRow['JobStatusFull']) job.status = String(rawRow['JobStatusFull']).trim();
  if ((!job.engineer || job.engineer === 'Unassigned') && rawRow['Engineers']) job.engineer = String(rawRow['Engineers']).trim();
  if ((!job.contractor || job.contractor === 'Unassigned') && rawRow['Contractor']) job.contractor = String(rawRow['Contractor']).trim();
  if ((!job.customer || job.customer === 'Unknown Customer') && rawRow['CustomerName']) job.customer = String(rawRow['CustomerName']).trim();
  if ((!job.region || job.region === 'St. Lucia') && rawRow['City']) job.region = String(rawRow['City']).trim();
  if (!job.technology || job.technology === 'Standard') {
    if (rawRow['JobTypes']) job.technology = String(rawRow['JobTypes']).trim();
    else if (rawRow['JobDescription']) job.technology = String(rawRow['JobDescription']).trim();
  }
  if (!job.dateCreated && rawRow['DateCreated']) job.dateCreated = parseDate(rawRow['DateCreated']);
  if (!job.dateFinished && rawRow['DateFinished']) job.dateFinished = parseDate(rawRow['DateFinished']);

  const rReason = rawRow['RescheduleReason'] || rawRow['reschedulereason'] || rawRow['Reschedule Reason'] || '';
  const fReason = rawRow['FailureReason'] || rawRow['failurereason'] || rawRow['Failure Reason'] || '';
  const noteText = rawRow['Note'] || rawRow['note'] || '';
  const descText = rawRow['Description'] || rawRow['description'] || '';
  let candReason = (rReason || fReason || noteText || job.subCategory || descText || '').trim();
  if (!candReason || candReason.toUpperCase() === 'N/A' || candReason === 'FOUND') {
    candReason = 'No reason specified';
  }
  job.onHoldReason = candReason;

  return job;
}

/**
 * Clean, parse, and validate dataset
 * @param {Array<Object>} rawRows - Array of raw JavaScript objects from CSV/XLSX
 * @param {Date} [referenceDate] - Max date or current date for calculating open job ages
 * @returns {Object} { jobs: Array, validationReport: Object }
 */
export function parseAndCleanData(rawRows, referenceDate = new Date()) {
  const report = {
    totalRawRows: rawRows.length,
    validJobsCount: 0,
    duplicatesRemovedCount: 0,
    missingCreatedDateCount: 0,
    missingFinishDateCount: 0,
    negativeDurationCount: 0,
    blankRowsIgnoredCount: 0,
    departmentCounts: {},
    statusCounts: {},
    duplicateJobNumbers: []
  };

  const seenJobNumbers = new Map();
  const cleanedJobs = [];

  // Determine max date in dataset if referenceDate is not static
  let maxDateInDataset = new Date(2000, 0, 1);

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (!rawRow || Object.keys(rawRow).length === 0) {
      report.blankRowsIgnoredCount++;
      continue;
    }

    const job = mapRawRow(rawRow);

    // Skip blank rows where essential fields are missing
    if (!job.jobNumber && !job.customer && !job.dateCreated) {
      report.blankRowsIgnoredCount++;
      continue;
    }

    // Exclude RemoteMigration StLucia and St. Lucia Fault Repair Internal from dashboard and all formulas
    const techLower = (job.technology || '').toLowerCase();
    const rawStr = JSON.stringify(job.raw || {}).toLowerCase();
    const initialDeptLower = (job.department || '').toLowerCase();
    if (
      techLower.includes('remote migration') ||
      techLower.includes('carcip migration') ||
      techLower.includes('remotemigration') ||
      rawStr.includes('remote migration') ||
      rawStr.includes('carcip migration') ||
      rawStr.includes('remotemigration') ||
      (initialDeptLower.includes('fault') && initialDeptLower.includes('internal'))
    ) {
      continue;
    }

    // Assign fallback Job Number if missing
    if (!job.jobNumber) {
      job.jobNumber = `JOB-${100000 + i}`;
    }

    // Track max date in dataset
    if (job.dateCreated && job.dateCreated > maxDateInDataset) maxDateInDataset = job.dateCreated;
    if (job.dateFinished && job.dateFinished > maxDateInDataset) maxDateInDataset = job.dateFinished;

    // Status Normalization
    const statusLower = job.status.toLowerCase();
    if (statusLower.includes('complete') || statusLower.includes('closed')) {
      job.isCompleted = true;
      job.status = 'Completed';
    } else if (statusLower.includes('created')) {
      job.isOpen = true;
      job.status = 'Created';
    } else if (statusLower.includes('confirm')) {
      job.isOpen = true;
      job.status = 'Confirmed';
    } else if (statusLower.includes('open') || statusLower.includes('pending') || statusLower.includes('hold') || statusLower.includes('en route')) {
      job.isOpen = true;
      if (statusLower.includes('hold')) job.status = 'Manager Hold';
      else if (statusLower.includes('pending')) job.status = 'Pending';
      else if (statusLower.includes('en route')) job.status = 'En Route';
      else job.status = 'Open';
    } else if (statusLower.includes('cancel')) {
      job.status = 'Cancelled';
    } else if (statusLower.includes('fail')) {
      if (statusLower.includes('request')) job.status = 'Fail Request';
      else job.status = 'Failed';
    }

    // Validation checks
    if (!job.dateCreated) {
      report.missingCreatedDateCount++;
      job.validationFlags.push('Missing Created Date');
    }

    if (job.isCompleted && !job.dateFinished) {
      report.missingFinishDateCount++;
      job.validationFlags.push('Missing Finish Date');
    }

    // Calculate duration for completed jobs
    if (job.dateCreated && job.dateFinished) {
      const dur = getDurationHours(job.dateCreated, job.dateFinished);
      if (dur < 0) {
        report.negativeDurationCount++;
        job.isNegativeDuration = true;
        job.validationFlags.push('Negative Duration');
        job.durationHours = 0;
        job.businessHours = 0;
      } else {
        job.durationHours = dur;
        job.businessHours = getBusinessHours(job.dateCreated, job.dateFinished);
      }
    }

    // Department normalization
    const deptLower = job.department.toLowerCase();
    if (deptLower.includes('install')) {
      job.department = 'St. Lucia Installations';
    } else if (deptLower.includes('fault') && deptLower.includes('external')) {
      job.department = 'St. Lucia Fault Repair External';
    } else if (deptLower.includes('fault') && deptLower.includes('internal')) {
      job.department = 'St. Lucia Fault Repair Internal';
    }

    // Deduplication check (job is now fully processed, so a replacement record is just as complete as a first-seen one)
    if (seenJobNumbers.has(job.jobNumber)) {
      report.duplicatesRemovedCount++;
      report.duplicateJobNumbers.push(job.jobNumber);
      // Keep existing or replace if this row has a finish date and previous didn't
      const existingJob = seenJobNumbers.get(job.jobNumber);
      if (!existingJob.dateFinished && job.dateFinished) {
        // Replace with more complete record
        const index = cleanedJobs.indexOf(existingJob);
        if (index !== -1) cleanedJobs[index] = job;
        seenJobNumbers.set(job.jobNumber, job);
        // Reconcile department/status distribution counts to reflect the swap
        report.departmentCounts[existingJob.department] = Math.max(0, (report.departmentCounts[existingJob.department] || 0) - 1);
        report.statusCounts[existingJob.status] = Math.max(0, (report.statusCounts[existingJob.status] || 0) - 1);
        report.departmentCounts[job.department] = (report.departmentCounts[job.department] || 0) + 1;
        report.statusCounts[job.status] = (report.statusCounts[job.status] || 0) + 1;
      }
      continue;
    }

    seenJobNumbers.set(job.jobNumber, job);

    // Department & Status distribution counting
    report.departmentCounts[job.department] = (report.departmentCounts[job.department] || 0) + 1;
    report.statusCounts[job.status] = (report.statusCounts[job.status] || 0) + 1;

    cleanedJobs.push(job);
  }

  // Set reference evaluation date for Open Jobs age calculation
  const evalDate = referenceDate > maxDateInDataset ? referenceDate : maxDateInDataset;

  // Calculate Open Jobs age
  cleanedJobs.forEach((job) => {
    if (job.isOpen && job.dateCreated) {
      job.openAgeHours = getDurationHours(job.dateCreated, evalDate) || 0;
      if (job.openAgeHours < 0) job.openAgeHours = 0;
    }
  });

  report.validJobsCount = cleanedJobs.length;
  return { jobs: cleanedJobs, validationReport: report, maxDateInDataset: evalDate };
}
