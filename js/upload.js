/**
 * File Upload, Drag & Drop, Multi-file Merge, and Parser Engine
 */
import { parseAndCleanData } from './parser.js';
import { SAMPLE_CSV_DATA } from '../assets/sample-data.js';

export class UploadManager {
  constructor(onDataParsedCallback) {
    this.onDataParsedCallback = onDataParsedCallback;
    this.rawAccumulatedRows = [];
  }

  init() {
    this.setupDropZone();
    this.setupFileInput();
    this.setupSampleButton();
  }

  setupDropZone() {
    const dropZone = document.getElementById('upload-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('border-emerald-500', 'bg-emerald-950/20');
      }, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('border-emerald-500', 'bg-emerald-950/20');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        this.handleFiles(Array.from(files));
      }
    });
  }

  setupFileInput() {
    const fileInput = document.getElementById('file-input-btn');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFiles(Array.from(e.target.files));
      }
    });
  }

  setupSampleButton() {
    const sampleBtn = document.getElementById('btn-load-sample');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        this.loadSampleData();
      });
    }
  }

  /**
   * Load the embedded April Konnexx sample data
   */
  loadSampleData() {
    this.showProgress(0, 'Loading April Konnexx sample data...');
    if (typeof window.Papa === 'undefined') {
      alert('PapaParse library is loading, please try again in a moment.');
      return;
    }

    window.Papa.parse(SAMPLE_CSV_DATA, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.showProgress(100, 'Sample dataset loaded successfully!');
        const parsed = parseAndCleanData(results.data);
        this.cacheInLocalStorage(results.data);
        if (this.onDataParsedCallback) {
          this.onDataParsedCallback(parsed);
        }
        setTimeout(() => this.hideProgress(), 1000);
      }
    });
  }

  /**
   * Process array of uploaded files (CSV or Excel)
   */
  async handleFiles(files) {
    this.rawAccumulatedRows = [];
    this.showProgress(5, `Processing ${files.length} file(s)...`);

    let processedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const percent = Math.round(((i + 0.5) / files.length) * 90);
      this.showProgress(percent, `Reading ${file.name}...`);

      try {
        const rows = await this.parseSingleFile(file);
        this.rawAccumulatedRows.push(...rows);
      } catch (err) {
        console.error(`Error parsing file ${file.name}:`, err);
        alert(`Failed to parse ${file.name}: ${err.message}`);
      }
      processedCount++;
    }

    this.showProgress(95, 'Cleaning and deduplicating jobs...');

    setTimeout(() => {
      const parsed = parseAndCleanData(this.rawAccumulatedRows);
      this.cacheInLocalStorage(this.rawAccumulatedRows);

      this.showProgress(100, `Merged ${processedCount} file(s) into ${parsed.jobs.length} valid jobs!`);

      if (this.onDataParsedCallback) {
        this.onDataParsedCallback(parsed);
      }

      setTimeout(() => this.hideProgress(), 1200);
    }, 100);
  }

  /**
   * Parse individual CSV or Excel file
   */
  parseSingleFile(file) {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        if (typeof window.Papa === 'undefined') {
          return reject(new Error('PapaParse library is missing'));
        }
        window.Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          complete: (results) => {
            resolve(results.data || []);
          },
          error: (err) => {
            reject(err);
          }
        });
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        if (typeof window.XLSX === 'undefined') {
          return reject(new Error('SheetJS (XLSX) library is missing'));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
            resolve(jsonRows || []);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format. Please upload CSV or XLSX.'));
      }
    });
  }

  cacheInLocalStorage(rawRows) {
    try {
      localStorage.setItem('v79_kpi_cached_raw_rows', JSON.stringify(rawRows.slice(0, 5000)));
    } catch (e) {
      console.warn('LocalStorage quota exceeded or unavailable', e);
    }
  }

  loadCachedData() {
    try {
      const cached = localStorage.getItem('v79_kpi_cached_raw_rows');
      if (cached) {
        const rawRows = JSON.parse(cached);
        if (Array.isArray(rawRows) && rawRows.length > 0) {
          const parsed = parseAndCleanData(rawRows);
          if (this.onDataParsedCallback) {
            this.onDataParsedCallback(parsed);
          }
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached data', e);
    }
    return false;
  }

  showProgress(percentage, text) {
    const banner = document.getElementById('upload-progress-banner');
    const bar = document.getElementById('upload-progress-bar');
    const statusText = document.getElementById('upload-progress-text');

    if (banner) banner.classList.remove('hidden');
    if (bar) bar.style.width = `${percentage}%`;
    if (statusText) statusText.textContent = text;
  }

  hideProgress() {
    const banner = document.getElementById('upload-progress-banner');
    if (banner) banner.classList.add('hidden');
  }
}
