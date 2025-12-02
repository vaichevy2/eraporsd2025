/*
  sql.js helper for Aplikasi Rapor
  - Builds a SQLite DB from application IndexedDB stores (via window.app.fetchData)
  - Exposes functions:
    - exportAndDownload(filename)  -> Downloads sqlite file
    - exportAndUpload(uploadUrl, filename) -> POSTs sqlite file to server (FormData 'file')
    - buildSQLiteBlob(filename) -> returns Blob of sqlite file

  Usage (in browser console after rapor.html is loaded):
    await sqliteExporter.exportAndDownload('rapor_data.sqlite');
    await sqliteExporter.exportAndUpload('/save_sqlite.php', 'rapor_data.sqlite');

  Notes:
  - This script dynamically loads sql.js (sql-wasm) from CDN when first used.
  - The server upload endpoint must accept multipart/form-data with field name 'file'.
*/

(function(window){
  const CDN_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.js';
  const CDN_WASM = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm';

  async function loadSqlJs() {
    if (typeof window.initSqlJs !== 'undefined') return window.initSqlJs;
    await new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${CDN_SCRIPT}"]`)) {
        // script already injected but initSqlJs not ready yet
        const check = setInterval(() => { if (typeof window.initSqlJs !== 'undefined') { clearInterval(check); resolve(); } }, 50);
        setTimeout(() => reject(new Error('Timed out waiting for sql.js')), 12000);
        return;
      }
      const s = document.createElement('script');
      s.src = CDN_SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load sql.js from CDN'));
      document.head.appendChild(s);
    });
    return window.initSqlJs;
  }

  async function buildDatabaseBlob(stores, filename) {
    if (!window.app || typeof window.app.fetchData !== 'function') {
      throw new Error('window.app.fetchData() not available. Ensure rapor.html is loaded and app is initialized.');
    }

    const initSqlJs = await loadSqlJs();
    const SQL = await initSqlJs({ locateFile: file => CDN_WASM });
    const db = new SQL.Database();

    for (const store of stores) {
      try {
        const rows = await window.app.fetchData(store) || [];
        if (!rows || rows.length === 0) continue;

        // Collect columns
        const colsSet = new Set();
        rows.forEach(r => { if (r && typeof r === 'object') Object.keys(r).forEach(k => colsSet.add(k)); });
        const cols = Array.from(colsSet);
        if (cols.length === 0) continue;

        // Create table (all columns as TEXT)
        const colDefs = cols.map(c => `"${String(c).replace(/"/g,'')}" TEXT`).join(', ');
        const createSQL = `CREATE TABLE IF NOT EXISTS "${store}" (${colDefs});`;
        db.run(createSQL);

        const placeholders = cols.map(()=>'?').join(',');
        const insertSQL = `INSERT INTO "${store}" (${cols.map(c=>`"${c.replace(/"/g,'')}"`).join(',')}) VALUES (${placeholders});`;

        for (const r of rows) {
          const values = cols.map(c => {
            const v = r[c];
            if (v === undefined || v === null) return null;
            if (typeof v === 'object') return JSON.stringify(v);
            return String(v);
          });
          db.run(insertSQL, values);
        }
      } catch (e) {
        console.warn('sql.js: skipping store', store, e);
      }
    }

    const binary = db.export();
    const blob = new Blob([binary], { type: 'application/x-sqlite3' });
    return blob;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'data.sqlite';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadBlob(blob, uploadUrl, fieldName = 'file', filename) {
    const fd = new FormData();
    fd.append(fieldName, blob, filename || 'data.sqlite');
    const resp = await fetch(uploadUrl, { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('Upload failed: ' + resp.status + ' ' + resp.statusText);
    return resp;
  }

  const defaultStores = ['students','teachers','admins','mapel','cptp','subject_teachers','utility','sekolah','dimensi','kaih','ekskul','student_ekskul','nilai','kokurikuler'];

  const sqliteExporter = {
    // Build sqlite Blob of all stores (or pass custom stores array)
    buildAllStoresBlob: async (stores = defaultStores) => {
      return await buildDatabaseBlob(stores);
    },

    // Export and download
    exportAndDownload: async (filename = 'rapor_data.sqlite', stores = defaultStores) => {
      const blob = await buildDatabaseBlob(stores, filename);
      downloadBlob(blob, filename);
      return true;
    },

    // Export and upload to server endpoint
    exportAndUpload: async (uploadUrl, filename = 'rapor_data.sqlite', stores = defaultStores) => {
      if (!uploadUrl) throw new Error('uploadUrl required');
      const blob = await buildDatabaseBlob(stores, filename);
      const resp = await uploadBlob(blob, uploadUrl, 'file', filename);
      return resp;
    }
  };

  // Expose globally
  window.sqliteExporter = sqliteExporter;

})(window);
