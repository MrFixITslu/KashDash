/**
 * Utility functions for V79 KPI Dashboard
 * Date parsing, time duration calculations, number formatting, and helper utilities.
 */

/**
 * Robust date parser for multiple Konnexx & Excel date formats
 * @param {string|number|Date} val - Raw date string, timestamp, or Excel serial
 * @returns {Date|null} Valid Date object or null if unparseable
 */
export function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Handle Excel serial date numbers
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val.trim()))) {
    const serial = parseFloat(val);
    if (serial > 20000 && serial < 60000) {
      // Excel epoch starts Dec 30, 1899
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const fractionalDay = serial - Math.floor(serial) + 0.0000001;
      let totalSeconds = Math.floor(86400 * fractionalDay);
      const seconds = totalSeconds % 60;
      totalSeconds = Math.floor(totalSeconds / 60);
      const minutes = totalSeconds % 60;
      const hours = Math.floor(totalSeconds / 60);
      return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, seconds);
    }
  }

  const str = String(val).trim();
  if (!str || str === '-' || str === 'N/A' || str === 'null' || str === 'undefined') return null;

  // Format: DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // Format: YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback native parse
  const fallbackDate = new Date(str);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return null;
}

/**
 * Format date to standard user-friendly string
 */
export function formatDate(date) {
  if (!date) return '-';
  const d = parseDate(date);
  if (!d) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

/**
 * Format date to HTML input date string (YYYY-MM-DD)
 */
export function formatDateForInput(date) {
  if (!date) return '';
  const d = parseDate(date);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Get difference in hours between two dates
 */
export function getDurationHours(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60); // Return exact fractional hours
}

/**
 * Calculate business hours duration (e.g., 8:00 AM - 5:00 PM, Mon-Sat)
 */
export function getBusinessHours(startDate, endDate, startHour = 8, endHour = 17) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return 0;

  let totalMs = 0;
  let current = new Date(start.getTime());

  while (current < end) {
    const day = current.getDay();
    // 0 = Sun. Include Mon-Sat (1 to 6)
    if (day !== 0) {
      const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), startHour, 0, 0);
      const dayEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), endHour, 0, 0);

      if (current < dayEnd) {
        const segStart = current > dayStart ? current : dayStart;
        const segEnd = end < dayEnd ? end : dayEnd;
        if (segEnd > segStart) {
          totalMs += segEnd.getTime() - segStart.getTime();
        }
      }
    }
    // Move to next day 8 AM
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, startHour, 0, 0);
  }

  return totalMs / (1000 * 60 * 60);
}

/**
 * Calculate array median value
 */
export function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate array mean value
 */
export function calculateMean(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return sum / numbers.length;
}

/**
 * Format numbers cleanly
 */
export function formatNumber(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format hours to readable string
 */
export function formatHours(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) return '0.0 hrs';
  return `${formatNumber(hours, 1)} hrs`;
}

/**
 * Format hours to days
 */
export function formatDays(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) return '0.0 days';
  const days = hours / 24;
  return `${formatNumber(days, 1)} days`;
}

/**
 * Get ISO week number string (e.g., "Week 15, 2023")
 */
export function getISOWeekString(date) {
  const d = parseDate(date);
  if (!d) return 'Unknown Week';
  let year = d.getFullYear();
  if (d.getMonth() < 3) {
    year = year - 1;
  }
  const aprilFirst = new Date(year, 3, 1);
  const diffTime = d.getTime() - aprilFirst.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);
  const finYear = year + 1;
  return `W${String(weekNumber).padStart(2, '0')} (FY${String(finYear).slice(-2)})`;
}

/**
 * Get ISO week key for sorting (e.g., "2026-W01") where Week 1 starts on April 1st
 */
export function getISOWeekKey(date) {
  const d = parseDate(date);
  if (!d) return '9999-W99';
  let year = d.getFullYear();
  if (d.getMonth() < 3) {
    year = year - 1;
  }
  const aprilFirst = new Date(year, 3, 1);
  const diffTime = d.getTime() - aprilFirst.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Percentage difference calculation
 */
export function calculatePercentageChange(oldVal, newVal) {
  if (oldVal === 0 || oldVal === null || oldVal === undefined) return 0;
  return ((newVal - oldVal) / oldVal) * 100;
}

/**
 * Escape HTML to prevent XSS in table outputs
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
