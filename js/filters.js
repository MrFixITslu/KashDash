/**
 * Global Filtering Engine
 */
import { parseDate, getFiscalYearStartDateString } from './utils.js';

export class FilterController {
  constructor(onChangeCallback) {
    this.onChangeCallback = onChangeCallback;
    const todayStr = new Date().toISOString().substring(0, 10);
    this.state = {
      startDate: getFiscalYearStartDateString(),
      endDate: todayStr,
      department: 'ALL',
      engineer: 'ALL',
      contractor: 'ALL',
      status: 'ALL',
      region: 'ALL',
      technology: 'ALL',
      createdMonth: 'ALL',
      customerSearch: '',
      category: 'ALL',
      subCategory: 'ALL'
    };
  }

  /**
   * Populate select option dropdowns dynamically from parsed dataset
   */
  populateOptions(jobs) {
    if (!jobs || jobs.length === 0) return;

    const departments = new Set();
    const engineers = new Set();
    const contractors = new Set();
    const statuses = new Set();
    const regions = new Set();
    const technologies = new Set();
    const createdMonths = new Set();
    const categories = new Set();
    const subCategories = new Set();

    jobs.forEach((j) => {
      if (j.department) departments.add(j.department);
      if (j.engineer && j.engineer !== 'Unassigned') engineers.add(j.engineer);
      if (j.contractor && j.contractor !== 'Unassigned') contractors.add(j.contractor);
      if (j.status) statuses.add(j.status);
      if (j.region) regions.add(j.region);
      if (j.technology) technologies.add(j.technology);
      
      if (j.dateCreated) {
        const d = parseDate(j.dateCreated);
        if (d) {
          const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          createdMonths.add(mStr);
        }
      }

      if (j.category) categories.add(j.category);
      if (j.subCategory) subCategories.add(j.subCategory);
    });

    const createdMonthsObjs = Array.from(createdMonths).sort().reverse().map(m => {
      const [y, mm] = m.split('-');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { value: m, label: `${monthNames[parseInt(mm, 10) - 1]} ${y}` };
    });

    this.fillSelect('filter-department', Array.from(departments).sort());
    this.fillSelect('filter-engineer', Array.from(engineers).sort());
    this.fillSelect('filter-contractor', Array.from(contractors).sort());
    this.fillSelect('filter-status', Array.from(statuses).sort());
    this.fillSelect('filter-region', Array.from(regions).sort());
    this.fillSelect('filter-technology', Array.from(technologies).sort());
    this.fillSelect('filter-month', createdMonthsObjs);
    this.fillSelect('filter-category', Array.from(categories).sort());
    this.fillSelect('filter-subcategory', Array.from(subCategories).sort());
  }

  fillSelect(elementId, items) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const currentValue = el.value;
    const defaultLabel = el.options[0] ? el.options[0].text : 'All';

    el.innerHTML = `<option value="ALL">${defaultLabel}</option>`;
    items.forEach((item) => {
      if (!item) return;
      const opt = document.createElement('option');
      opt.value = item.value || item;
      opt.textContent = item.label || item;
      el.appendChild(opt);
    });

    if (currentValue && Array.from(el.options).some((o) => o.value === currentValue)) {
      el.value = currentValue;
    } else {
      el.value = 'ALL';
    }
  }

  /**
   * Bind DOM inputs to filter state
   */
  bindEvents() {
    const startEl = document.getElementById('filter-start-date');
    const endEl = document.getElementById('filter-end-date');
    if (startEl) startEl.value = this.state.startDate;
    if (endEl) endEl.value = this.state.endDate;

    const fields = [
      { id: 'filter-start-date', key: 'startDate' },
      { id: 'filter-end-date', key: 'endDate' },
      { id: 'filter-department', key: 'department' },
      { id: 'filter-engineer', key: 'engineer' },
      { id: 'filter-contractor', key: 'contractor' },
      { id: 'filter-status', key: 'status' },
      { id: 'filter-region', key: 'region' },
      { id: 'filter-technology', key: 'technology' },
      { id: 'filter-month', key: 'createdMonth' },
      { id: 'filter-customer-search', key: 'customerSearch', event: 'input' },
      { id: 'filter-category', key: 'category' },
      { id: 'filter-subcategory', key: 'subCategory' }
    ];

    fields.forEach(({ id, key, event = 'change' }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(event, () => {
          this.state[key] = el.value.trim();
          if (this.onChangeCallback) this.onChangeCallback(this.state);
        });
      }
    });

    // Preset Date Buttons
    const presetBtns = document.querySelectorAll('.date-preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.dataset.preset;
        this.applyDatePreset(preset);
      });
    });

    // Reset Filters button
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.reset();
      });
    }
  }

  applyDatePreset(preset) {
    const now = new Date();
    let start = null;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (preset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (preset === '7days') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (preset === '30days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === 'this-month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'all') {
      start = null;
      end = null;
    }

    const startEl = document.getElementById('filter-start-date');
    const endEl = document.getElementById('filter-end-date');

    if (startEl) startEl.value = start ? start.toISOString().substring(0, 10) : '';
    if (endEl) endEl.value = end ? end.toISOString().substring(0, 10) : '';

    this.state.startDate = startEl ? startEl.value : '';
    this.state.endDate = endEl ? endEl.value : '';

    if (this.onChangeCallback) this.onChangeCallback(this.state);
  }

  reset() {
    const todayStr = new Date().toISOString().substring(0, 10);
    this.state = {
      startDate: getFiscalYearStartDateString(),
      endDate: todayStr,
      department: 'ALL',
      engineer: 'ALL',
      contractor: 'ALL',
      status: 'ALL',
      region: 'ALL',
      technology: 'ALL',
      createdMonth: 'ALL',
      customerSearch: '',
      category: 'ALL',
      subCategory: 'ALL'
    };

    const ids = [
      'filter-start-date', 'filter-end-date', 'filter-department', 'filter-engineer', 'filter-contractor',
      'filter-status', 'filter-region', 'filter-technology', 'filter-month',
      'filter-customer-search', 'filter-category', 'filter-subcategory'
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'SELECT') {
          el.value = 'ALL';
        } else if (id === 'filter-start-date') {
          el.value = this.state.startDate;
        } else if (id === 'filter-end-date') {
          el.value = this.state.endDate;
        } else {
          el.value = '';
        }
      }
    });

    if (this.onChangeCallback) this.onChangeCallback(this.state);
  }

  /**
   * Filter dataset against current state
   */
  filterJobs(jobs) {
    if (!jobs || jobs.length === 0) return [];

    return jobs.filter((job) => {
      // Date Range - default to April 1st to present if not selected
      let startDateStr = this.state.startDate;
      let endDateStr = this.state.endDate;

      if (!startDateStr) {
        startDateStr = getFiscalYearStartDateString();
      }
      if (!endDateStr) {
        endDateStr = new Date().toISOString().substring(0, 10);
      }

      if (startDateStr) {
        const start = parseDate(startDateStr);
        if (start && job.dateCreated && job.dateCreated < start) return false;
      }
      if (endDateStr) {
        const end = parseDate(endDateStr);
        if (end) {
          end.setHours(23, 59, 59, 999);
          if (job.dateCreated && job.dateCreated > end) return false;
        }
      }

      // Department
      if (this.state.department !== 'ALL' && job.department !== this.state.department) {
        return false;
      }

      // Engineer
      if (this.state.engineer !== 'ALL' && job.engineer !== this.state.engineer) {
        return false;
      }

      // Contractor
      if (this.state.contractor !== 'ALL' && job.contractor !== this.state.contractor) {
        return false;
      }

      // Status
      if (this.state.status !== 'ALL') {
        if (this.state.status === 'Open' && !job.isOpen) return false;
        else if (this.state.status === 'Completed' && !job.isCompleted) return false;
        else if (job.status !== this.state.status) return false;
      }

      // Region
      if (this.state.region !== 'ALL' && job.region !== this.state.region) {
        return false;
      }

      // Technology
      if (this.state.technology !== 'ALL' && job.technology !== this.state.technology) {
        return false;
      }

      // Created Month
      if (this.state.createdMonth !== 'ALL') {
        if (!job.dateCreated) return false;
        const d = parseDate(job.dateCreated);
        if (!d) return false;
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mStr !== this.state.createdMonth) return false;
      }

      // Category
      if (this.state.category !== 'ALL' && job.category !== this.state.category) {
        return false;
      }

      // Sub Category
      if (this.state.subCategory !== 'ALL' && job.subCategory !== this.state.subCategory) {
        return false;
      }

      // Customer search
      if (this.state.customerSearch) {
        const q = this.state.customerSearch.toLowerCase();
        const matchCust = job.customer && job.customer.toLowerCase().includes(q);
        const matchJob = job.jobNumber && job.jobNumber.toLowerCase().includes(q);
        if (!matchCust && !matchJob) return false;
      }

      return true;
    });
  }
}
