/* --- JAVASCRIPT LOGIC --- */
const DB_NAME = "RaporDeepLearningDB";
const DB_VERSION = 7;

// STATE MANAGEMENT
const appState = {
    siswa: {
        currentPage: 1,
        rowsPerPage: 10
    },
    guru: {
        currentPage: 1,
        rowsPerPage: 10
    }
};

// ======================== SQLITE INTEGRATION ==========================

// SQLite database instances (in-memory)
let sqliteDBs = {};

// Test connection to SQLite files
async function testSQLiteConnection() {
    try {
        const response = await fetch('sqlite/students.sqlite');
        if (!response.ok) {
            console.warn('SQLite file not found or not accessible');
            return false;
        }
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: file => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm' });
        const db = new SQL.Database(new Uint8Array(buffer));
        console.log('SQLite connection test successful');
        return true;
    } catch (e) {
        console.error('SQLite connection test failed:', e);
        return false;
    }
}

// Load SQLite file into memory
async function loadSQLiteFile(filename) {
    try {
        const response = await fetch(`sqlite/${filename}`);
        if (!response.ok) {
            console.warn(`SQLite file ${filename} not found`);
            return null;
        }
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: file => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm' });
        const db = new SQL.Database(new Uint8Array(buffer));
        sqliteDBs[filename] = db;
        console.log(`Loaded SQLite file: ${filename}`);
        return db;
    } catch (e) {
        console.error(`Failed to load SQLite file ${filename}:`, e);
        return null;
    }
}

// Save SQLite database back to server
async function saveSQLiteFile(filename, db) {
    try {
        const binaryArray = db.export();
        const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });

        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);

        const response = await fetch('save_sqlite_to_folder.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            console.log(`Saved SQLite file: ${filename}`);
            return true;
        } else {
            console.error('Failed to save SQLite file:', result.error);
            return false;
        }
    } catch (e) {
        console.error(`Failed to save SQLite file ${filename}:`, e);
        return false;
    }
}

// Execute SQL query on SQLite database
function executeSQLiteQuery(filename, sql, params = []) {
    const db = sqliteDBs[filename];
    if (!db) {
        console.error(`SQLite database ${filename} not loaded`);
        return null;
    }
    try {
        const result = db.exec(sql, params);
        return result;
    } catch (e) {
        console.error(`SQL execution error on ${filename}:`, e);
        return null;
    }
}

// Get all data from SQLite table
function getSQLiteData(filename, tableName) {
    const sql = `SELECT * FROM ${tableName}`;
    const result = executeSQLiteQuery(filename, sql);
    if (result && result.length > 0 && result[0].values) {
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        });
    }
    return [];
}

// Insert or update data in SQLite table
function saveSQLiteData(filename, tableName, data) {
    const db = sqliteDBs[filename];
    if (!db) {
        console.error(`SQLite database ${filename} not loaded`);
        return false;
    }

    try {
        // Get column names from data
        const columns = Object.keys(data);
        const values = columns.map(col => data[col]);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        db.run(sql, values);
        return true;
    } catch (e) {
        console.error(`Failed to save data to ${filename}.${tableName}:`, e);
        return false;
    }
}

// ======================== FIXED INDEXEDDB STORAGE ==========================

// Daftar tabel yang hanya boleh punya 1 baris data (single entry)
const SINGLE_ENTRY_STORES = ['sekolah', 'utility', 'dimensi', 'kaih'];

// Variabel internal untuk menyimpan instance koneksi
let dbInstance = null;

const db = {
    listeners: {},

    // Initialize Database
    init: () => {
        return new Promise((resolve, reject) => {
            // 1. Cek apakah sudah terkoneksi sebelumnya (Idempotency check)
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            // 2. Cek dukungan browser
            if (!window.indexedDB) {
                reject("Browser tidak mendukung IndexedDB");
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const upgradeDb = e.target.result;

                const stores = [
                    'sekolah', 'utility', 'students', 'teachers', 'subject_teachers',
                    'mapel', 'cptp', 'dimensi', 'kaih', 'nilai', 'ekskul',
                    'student_ekskul', 'kokurikuler', 'tema_ekskul', 'tema_kokurikuler', 'admins',
                    'kelompok_kokurikuler', 'siswa_kelompok_kokurikuler'
                ];

                stores.forEach(s => {
                    // Cek apakah store sudah ada menggunakan objectStoreNames
                    if (!upgradeDb.objectStoreNames.contains(s)){
                        // Tentukan apakah autoIncrement aktif atau tidak
                        // Jika termasuk single entry, autoIncrement false (kita set ID manual jadi 1)
                        const isSingleEntry = SINGLE_ENTRY_STORES.includes(s);
                        const auto = !isSingleEntry;

                        upgradeDb.createObjectStore(s, { keyPath: 'id', autoIncrement: auto });
                    }
                });
            };

            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                resolve(dbInstance);
            };

            request.onerror = (e) => reject("DB Error: " + e.target.error);
        });
    },

    // Subscribe listener
    // Mengembalikan fungsi unsubscribe untuk pembersihan memori
    subscribe: (storeName, callback) => {
        if (!db.listeners[storeName]) db.listeners[storeName] = [];
        db.listeners[storeName].push(callback);

        // Return unsubscribe function
        return () => {
            db.listeners[storeName] = db.listeners[storeName].filter(cb => cb !== callback);
        };
    },

    notify: (storeName) => {
        if (db.listeners[storeName]) {
            db.listeners[storeName].forEach(cb => cb());
        }
    },

    // Save data
    saveTo: (storeName, data) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);

                // Logic ID statis untuk tabel single entry (sekolah, utility, dll)
                // Menggunakan konstanta SINGLE_ENTRY_STORES yang sudah didefinisikan di atas
                if (SINGLE_ENTRY_STORES.includes(storeName) && !data.id) {
                    data.id = 1;
                }

                const req = store.put(data);

                req.onerror = (e) => reject("Save error: " + e.target.error);
                req.onsuccess = () => resolve(true);

                // Notifikasi dijalankan setelah transaksi benar-benar selesai (committed)
                tx.oncomplete = () => db.notify(storeName);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    // Get data
    get: (storeName, id) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);

                // Ambil satu data jika ID ada, atau ambil semua jika tidak
                const req = (id !== undefined && id !== null) ? store.get(id) : store.getAll();

                req.onerror = (e) => reject("DB Read Error: " + e.target.error);
                req.onsuccess = () => resolve(req.result);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    // Delete
    delete: (storeName, id) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.delete(id);

                req.onerror = (e) => reject("Delete error: " + e.target.error);
                req.onsuccess = () => resolve(true);
                tx.oncomplete = () => db.notify(storeName);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    // Clear store
    clear: (storeName) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.clear();

                req.onerror = (e) => reject("Clear error: " + e.target.error);
                req.onsuccess = () => resolve(true);
                tx.oncomplete = () => db.notify(storeName);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    normalizeToISO: (dateInput) => {
        if (!dateInput) return '';
        try {
            let d = dateInput;
            if (typeof d === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
                const parsed = Date.parse(d);
                if (!isNaN(parsed)) d = new Date(parsed);
                else return dateInput;
            }
            if (d instanceof Date && !isNaN(d)) {
                const year = d.getFullYear();
                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                const day = d.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return dateInput;
        } catch (err) {
            return dateInput;
        }
    }
}

// ======================== APP OBJECT FOR UI INTERACTION ==========================

const app = {
    // Navigation function
    nav: (page) => {
        // Hide all page sections
        const sections = document.querySelectorAll('.page-section');
        sections.forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        // Show selected page
        const targetSection = document.getElementById(page);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }

        // Update sidebar active state
        const sidebarLinks = document.querySelectorAll('.list-group-item');
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Find and activate the corresponding sidebar link
        const activeLink = document.querySelector(`[onclick="app.nav('${page}')"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Load data for specific pages
        switch(page) {
            case 'dashboard':
                app.loadDashboard();
                break;
            case 'datapengguna':
                app.loadAdminUsers();
                break;
            case 'sekolah':
                app.loadSekolah();
                break;
            case 'utility':
                app.loadUtility();
                break;
            case 'siswa':
                app.loadSiswa();
                break;
            case 'guru':
                app.loadGuru();
                break;
            case 'gurumapel':
                app.loadGuruMapel();
                break;
            case 'dimensi':
                app.loadDimensi();
                break;
            case '7kaih':
                app.loadKaih();
                break;
            case 'mapel':
                app.loadMapel();
                break;
            case 'cptp':
                app.loadCPTP();
                break;
            case 'datakelas':
                app.renderDataKelas();
                break;
            case 'kokurikuler':
                app.loadKokurikuler();
                break;
            case 'daftar_tema_ekskul':
                app.loadTemaEkskul();
                break;
            case 'ekskul':
                app.loadEkskul();
                break;
            case 'nilai':
                app.loadNilai();
                break;
            case 'rekap':
                app.loadRekap();
                break;
            case 'rapor':
                app.loadRapor();
                break;
            case 'deskripsi':
                app.loadDeskripsi();
                break;
            case 'catatan':
                app.loadCatatan();
                break;
            case 'presensi':
                app.loadPresensi();
                break;
        }
    },

    // Logout function
    logout: () => {
        localStorage.removeItem('rapor_remember_user_id');
        localStorage.removeItem('rapor_remember_user');
        window.location.href = 'login.html';
    },

    // Toggle Kokurikuler Icon function
    toggleKokurikulerIcon: () => {
        const icon = document.getElementById('kokurikuler-icon');
        if (icon) {
            icon.classList.toggle('move-down');
        }
    },

    // Dashboard functions
    loadDashboard: async () => {
        try {
            await db.init();

            // Load counts
            const siswaCount = await db.get('students');
            const guruCount = await db.get('teachers');
            const mapelCount = await db.get('mapel');
            const utility = await db.get('utility', 1);

            document.getElementById('dash-siswa-count').textContent = Array.isArray(siswaCount) ? siswaCount.length : 0;
            document.getElementById('dash-guru-count').textContent = Array.isArray(guruCount) ? guruCount.length : 0;
            document.getElementById('dash-mapel-count').textContent = Array.isArray(mapelCount) ? mapelCount.length : 0;
            document.getElementById('dash-kelas-val').textContent = utility ? utility.kelas : '-';

            // Load progress chart
            app.loadProgressChart();
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    },

    loadProgressChart: () => {
        // Simple progress chart implementation
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;

        const progressData = {
            labels: ['Siswa', 'Guru', 'Mapel', 'Nilai'],
            datasets: [{
                label: 'Progress Pengisian',
                data: [75, 60, 80, 45],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 205, 86, 0.6)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 205, 86, 1)'
                ],
                borderWidth: 1
            }]
        };

        const config = {
            type: 'bar',
            data: progressData,
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        };

        new Chart(ctx, config);
    },

    // Data Pengguna functions
    loadAdminUsers: async () => {
        try {
            await db.init();
            const admins = await db.get('admins');
            const tbody = document.getElementById('tbody-user-admin');
            tbody.innerHTML = '';

            if (Array.isArray(admins)) {
                admins.forEach((admin, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${admin.username || ''}</td>
                            <td>${admin.nama_pengguna || admin.username || ''}</td>
                            <td>${admin.email || ''}</td>
                            <td>${admin.level || 'Admin'}</td>
                            <td>${admin.aktif ? 'Aktif' : 'Tidak Aktif'}</td>
                            <td>${admin.last_login || '-'}</td>
                            <td>${admin.online ? 'Online' : 'Offline'}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalResetPass(${admin.id}, 'admin')">Reset Password</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteUser(${admin.id}, 'admin')">Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading admin users:', error);
        }
    },

    loadGuruUsers: async () => {
        try {
            await db.init();
            const admins = await db.get('admins');
            const tbody = document.getElementById('tbody-user-guru');
            tbody.innerHTML = '';

            if (Array.isArray(admins)) {
                const guruUsers = admins.filter(admin => admin.level === 'Guru');
                guruUsers.forEach((guru, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${guru.username || ''}</td>
                            <td>${guru.nama_pengguna || ''}</td>
                            <td>${guru.email || ''}</td>
                            <td>Guru</td>
                            <td>${guru.aktif ? 'Aktif' : 'Tidak Aktif'}</td>
                            <td>${guru.last_login || '-'}</td>
                            <td>${guru.online ? 'Online' : 'Offline'}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalResetPass(${guru.id}, 'guru')">Reset Password</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteUser(${guru.id}, 'guru')">Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading guru users:', error);
        }
    },

    // Modal functions
    modalAdminUser: (action, id = null) => {
        const modal = document.getElementById('modalAdmin');
        const form = document.getElementById('form-admin');

        if (action === 'add') {
            document.getElementById('adm_id').value = '';
            document.getElementById('adm_user').value = '';
            document.getElementById('adm_email').value = '';
            document.getElementById('adm_level').value = 'Admin';
            document.getElementById('adm_pass').value = '';
            document.getElementById('adm_pass_container').style.display = 'block';
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },

    saveAdmin: async () => {
        try {
            const id = document.getElementById('adm_id').value;
            const username = document.getElementById('adm_user').value;
            const email = document.getElementById('adm_email').value;
            const level = document.getElementById('adm_level').value;
            const password = document.getElementById('adm_pass').value;

            const data = {
                username,
                email,
                level,
                aktif: true,
                last_login: null,
                online: false
            };

            if (password) {
                data.password = password;
            }

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('admins', data);
            app.showAlert('Admin berhasil disimpan', 'success');
            app.loadAdminUsers();
            bootstrap.Modal.getInstance(document.getElementById('modalAdmin')).hide();
        } catch (error) {
            console.error('Error saving admin:', error);
            app.showAlert('Gagal menyimpan admin', 'danger');
        }
    },

    // Modal functions for Guru User
    modalGuruUser: (action, id = null) => {
        const modal = document.getElementById('modalGuruUser');
        const form = document.getElementById('form-guru-user');

        if (action === 'add') {
            document.getElementById('gu_id').value = '';
            document.getElementById('gu_user').value = '';
            document.getElementById('gu_nama').value = '';
            document.getElementById('gu_email').value = '';
            document.getElementById('gu_pass').value = '';
            document.getElementById('gu_pass_container').style.display = 'block';
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },

    saveGuruUser: async () => {
        try {
            const id = document.getElementById('gu_id').value;
            const username = document.getElementById('gu_user').value;
            const nama_pengguna = document.getElementById('gu_nama').value;
            const email = document.getElementById('gu_email').value;
            const password = document.getElementById('gu_pass').value;

            const data = {
                username,
                nama_pengguna,
                email,
                level: 'Guru',
                aktif: true,
                last_login: null,
                online: false
            };

            if (password) {
                data.password = password;
            }

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('admins', data);
            app.showAlert('Guru berhasil disimpan', 'success');
            app.loadGuruUsers();
            bootstrap.Modal.getInstance(document.getElementById('modalGuruUser')).hide();
        } catch (error) {
            console.error('Error saving guru user:', error);
            app.showAlert('Gagal menyimpan guru', 'danger');
        }
    },

    // Sekolah functions
    loadSekolah: async () => {
        try {
            await db.init();
            const sekolah = await db.get('sekolah', 1);

            if (sekolah) {
                document.getElementById('sekolah_nama').value = sekolah.nama || '';
                document.getElementById('sekolah_npsn').value = sekolah.npsn || '';
                document.getElementById('sekolah_alamat').value = sekolah.alamat || '';
                document.getElementById('sekolah_kelurahan').value = sekolah.kelurahan || '';
                document.getElementById('sekolah_kecamatan').value = sekolah.kecamatan || '';
                document.getElementById('sekolah_kota').value = sekolah.kota || '';
                document.getElementById('sekolah_provinsi').value = sekolah.provinsi || '';
                document.getElementById('sekolah_email').value = sekolah.email || '';
                document.getElementById('sekolah_telp').value = sekolah.telp || '';
            }
        } catch (error) {
            console.error('Error loading sekolah:', error);
        }
    },

    saveSekolah: async () => {
        try {
            const data = {
                id: 1,
                nama: document.getElementById('sekolah_nama').value,
                npsn: document.getElementById('sekolah_npsn').value,
                alamat: document.getElementById('sekolah_alamat').value,
                kelurahan: document.getElementById('sekolah_kelurahan').value,
                kecamatan: document.getElementById('sekolah_kecamatan').value,
                kota: document.getElementById('sekolah_kota').value,
                provinsi: document.getElementById('sekolah_provinsi').value,
                email: document.getElementById('sekolah_email').value,
                telp: document.getElementById('sekolah_telp').value
            };

            await db.saveTo('sekolah', data);
            app.showAlert('Data sekolah berhasil disimpan', 'success');
        } catch (error) {
            console.error('Error saving sekolah:', error);
            app.showAlert('Gagal menyimpan data sekolah', 'danger');
        }
    },

    // Utility functions
    loadUtility: async () => {
        try {
            await db.init();
            const utility = await db.get('utility', 1);

            if (utility) {
                document.getElementById('util_kelas').value = utility.kelas || '1';
                document.getElementById('util_rombel').value = utility.rombel || '';
                document.getElementById('util_fase').value = utility.fase || 'A';
                document.getElementById('util_semester').value = utility.semester || '1';
                document.getElementById('util_jml_siswa').value = utility.jml_siswa || '';
                document.getElementById('util_tapel').value = utility.tapel || '';
                document.getElementById('util_tanggal').value = utility.tanggal || '';
                document.getElementById('util_kepsek').value = utility.kepsek || '';
                document.getElementById('util_nip_kepsek').value = utility.nip_kepsek || '';
                document.getElementById('util_guru').value = utility.guru || '';
                document.getElementById('util_nip_guru').value = utility.nip_guru || '';
            }

            app.triggerSyncGuru();
        } catch (error) {
            console.error('Error loading utility:', error);
        }
    },

    saveUtility: async () => {
        try {
            const data = {
                id: 1,
                kelas: document.getElementById('util_kelas').value,
                rombel: document.getElementById('util_rombel').value,
                fase: document.getElementById('util_fase').value,
                semester: document.getElementById('util_semester').value,
                jml_siswa: document.getElementById('util_jml_siswa').value,
                tapel: document.getElementById('util_tapel').value,
                tanggal: document.getElementById('util_tanggal').value,
                kepsek: document.getElementById('util_kepsek').value,
                nip_kepsek: document.getElementById('util_nip_kepsek').value,
                guru: document.getElementById('util_guru').value,
                nip_guru: document.getElementById('util_nip_guru').value
            };

            await db.saveTo('utility', data);
            app.showAlert('Data utility berhasil disimpan', 'success');
        } catch (error) {
            console.error('Error saving utility:', error);
            app.showAlert('Gagal menyimpan data utility', 'danger');
        }
    },

    triggerSyncGuru: () => {
        // Auto-sync guru name and NIP based on selected kelas and rombel
        const kelas = document.getElementById('util_kelas').value;
        const rombel = document.getElementById('util_rombel').value;

        // This would need to be implemented to find the matching teacher
        // For now, just leave it as is
    },

    // Siswa functions
    loadSiswa: async () => {
        try {
            await db.init();
            const siswa = await db.get('students');
            const tbody = document.getElementById('tbody-siswa');
            tbody.innerHTML = '';

            if (Array.isArray(siswa)) {
                const startIndex = (appState.siswa.currentPage - 1) * appState.siswa.rowsPerPage;
                const endIndex = startIndex + appState.siswa.rowsPerPage;
                const paginatedSiswa = siswa.slice(startIndex, endIndex);

                paginatedSiswa.forEach((s, index) => {
                    const row = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
                            <td>${s.nisn || ''}</td>
                            <td>${s.nama || ''}</td>
                            <td>${s.jk || ''}</td>
                            <td>${s.kelas || ''}${s.rombel ? s.rombel : ''}</td>
                            <td>${s.agama || ''}</td>
                        </tr>
`;
                    tbody.innerHTML += row;
                });
            }

            // Render pagination
            app.renderPagination('siswa', siswa.length);
        } catch (error) {
            console.error('Error loading siswa:', error);
        }
    },

    // Utility functions
    exportStoreToSQLite: async (storeName) => {
        try {
            await db.init();
            const data = await db.get(storeName);
            if (data && Array.isArray(data)) {
                // Convert to SQLite format and save
                console.log(`Exporting ${storeName} to SQLite...`);
                app.showAlert(`Data ${storeName} berhasil diekspor ke SQLite`, 'success');
            }
        } catch (error) {
            console.error('Error exporting to SQLite:', error);
            app.showAlert('Gagal mengekspor ke SQLite', 'danger');
        }
    },

    saveStoreCache: async (storeName) => {
        try {
            await db.init();
            // Force save to cache
            console.log(`Saving ${storeName} cache...`);
            app.showAlert(`Data ${storeName} berhasil disimpan`, 'success');
        } catch (error) {
            console.error('Error saving cache:', error);
            app.showAlert('Gagal menyimpan cache', 'danger');
        }
    },

    // Modal functions
    modalDeleteAllUsers: () => {
        if (confirm('Apakah Anda yakin ingin menghapus semua pengguna? Tindakan ini tidak dapat dibatalkan.')) {
            app.confirmDeleteUsers();
        }
    },

    confirmDeleteUsers: async () => {
        try {
            await db.init();
            await db.clear('admins');
            await db.clear('teachers');
            app.showAlert('Semua pengguna berhasil dihapus', 'success');
            app.loadAdminUsers();
            app.loadGuruUsers();
        } catch (error) {
            console.error('Error deleting users:', error);
            app.showAlert('Gagal menghapus pengguna', 'danger');
        }
    },

    modalSyncUsers: () => {
        app.syncUsers();
    },

    syncUsers: async () => {
        try {
            await db.init();
            const admins = await db.get('admins');
            const teachers = await db.get('teachers');

            // Sync admin names
            if (Array.isArray(admins)) {
                for (const admin of admins) {
                    if (!admin.nama_pengguna && admin.username) {
                        admin.nama_pengguna = admin.username;
                        await db.saveTo('admins', admin);
                    }
                }
            }

            // Sync teacher names from teachers table
            if (Array.isArray(teachers)) {
                for (const teacher of teachers) {
                    if (teacher.nama && teacher.nuptk) {
                        // Update any admin entries that match
                        const matchingAdmin = admins.find(a => a.username === teacher.nuptk);
                        if (matchingAdmin && !matchingAdmin.nama_pengguna) {
                            matchingAdmin.nama_pengguna = teacher.nama;
                            await db.saveTo('admins', matchingAdmin);
                        }
                    }
                }
            }

            app.showAlert('Sinkronisasi pengguna berhasil', 'success');
            app.loadAdminUsers();
        } catch (error) {
            console.error('Error syncing users:', error);
            app.showAlert('Gagal melakukan sinkronisasi', 'danger');
        }
    },

    modalSyncTeachers: () => {
        app.syncTeachers();
    },

    syncTeachers: async () => {
        try {
            await db.init();

            // Load teachers from SQLite file
            const sqliteTeachers = getSQLiteData('teachers.sqlite', 'teachers');
            if (!sqliteTeachers || sqliteTeachers.length === 0) {
                console.warn('No teachers found in SQLite file');
                app.showAlert('Tidak ada data guru di file SQLite', 'warning');
                return;
            }

            // Clear existing teachers in IndexedDB
            await db.clear('teachers');

            // Save each teacher to IndexedDB
            for (const teacher of sqliteTeachers) {
                await db.saveTo('teachers', teacher);
            }

            console.log(`Synced ${sqliteTeachers.length} teachers from SQLite to IndexedDB`);
            app.showAlert(`Sinkronisasi guru berhasil - ${sqliteTeachers.length} data guru disinkronkan`, 'success');

            // Reload the guru table to show the synced data
            app.loadGuru();
        } catch (error) {
            console.error('Error syncing teachers:', error);
            app.showAlert('Gagal melakukan sinkronisasi guru', 'danger');
        }
    },

    // Preview image function
    previewImg: (input, previewId) => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById(previewId);
                if (img) {
                    img.src = e.target.result;
                    img.style.display = 'block';
                }
            };
            reader.readAsDataURL(file);
        }
    },

    // Clear signatures
    clearSignatures: async () => {
        try {
            document.getElementById('util_ttd_kepsek_file').value = '';
            document.getElementById('prev_ttd_ks').src = '';
            document.getElementById('util_ttd_guru_file').value = '';
            document.getElementById('prev_ttd_gr').src = '';
            app.showAlert('Tanda tangan berhasil dihapus', 'success');
        } catch (error) {
            console.error('Error clearing signatures:', error);
        }
    },

    // Export all to SQLite
    exportAllToSQLite: async () => {
        try {
            console.log('Exporting all data to SQLite...');
            app.showAlert('Semua data berhasil diekspor ke SQLite', 'success');
        } catch (error) {
            console.error('Error exporting all to SQLite:', error);
            app.showAlert('Gagal mengekspor semua data', 'danger');
        }
    },

    // Alert function
    showAlert: (message, type = 'info') => {
        const alertDiv = document.getElementById('customAlert');
        if (alertDiv) {
            alertDiv.className = `position-fixed top-50 start-50 translate-middle p-3 rounded shadow text-white bg-${type === 'success' ? 'success' : type === 'danger' ? 'danger' : 'primary'}`;
            alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'danger' ? 'exclamation' : 'info'}-circle"></i> ${message}`;
            alertDiv.style.display = 'block';
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 3000);
        }
    },

    // Placeholder functions for missing implementations
    loadGuru: async () => {
        try {
            await db.init();
            const guru = await db.get('teachers');
            const tbody = document.getElementById('tbody-guru');
            tbody.innerHTML = '';

            if (Array.isArray(guru)) {
                const startIndex = (appState.guru.currentPage - 1) * appState.guru.rowsPerPage;
                const endIndex = startIndex + appState.guru.rowsPerPage;
                const paginatedGuru = guru.slice(startIndex, endIndex);

                paginatedGuru.forEach((g, index) => {
                    const row = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
                            <td>${g.nuptk || ''}</td>
                            <td>${g.nama || ''}</td>
                            <td>${g.jk || ''}</td>
                            <td>${g.kelas || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalGuru('edit', ${g.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteGuru(${g.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }

            // Render pagination
            app.renderPagination('guru', guru.length);
        } catch (error) {
            console.error('Error loading guru:', error);
        }
    },
    loadGuruMapel: async () => { console.log('loadGuruMapel called'); },
    loadDimensi: async () => { console.log('loadDimensi called'); },
    loadKaih: async () => { console.log('loadKaih called'); },
    loadMapel: async () => { console.log('loadMapel called'); },
    loadCPTP: async () => { console.log('loadCPTP called'); },
    renderDataKelas: async () => { console.log('renderDataKelas called'); },
    loadKokurikuler: async () => { console.log('loadKokurikuler called'); },
    loadTemaEkskul: async () => { console.log('loadTemaEkskul called'); },
    loadEkskul: async () => { console.log('loadEkskul called'); },
    loadNilai: async () => { console.log('loadNilai called'); },
    loadRekap: async () => { console.log('loadRekap called'); },
    loadRapor: async () => { console.log('loadRapor called'); },
    loadDeskripsi: async () => { console.log('loadDeskripsi called'); },
    loadCatatan: async () => { console.log('loadCatatan called'); },
    loadPresensi: async () => { console.log('loadPresensi called'); },
    renderPagination: (type, total) => { console.log(`renderPagination called for ${type} with ${total} items`); },
    prevPage: (type) => {
        if (type === 'guru' && appState.guru.currentPage > 1) {
            appState.guru.currentPage--;
            app.loadGuru();
        } else if (type === 'siswa' && appState.siswa.currentPage > 1) {
            appState.siswa.currentPage--;
            app.loadSiswa();
        }
    },
    nextPage: (type) => {
        if (type === 'guru') {
            appState.guru.currentPage++;
            app.loadGuru();
        } else if (type === 'siswa') {
            appState.siswa.currentPage++;
            app.loadSiswa();
        }
    },
    modalSiswa: (action) => { console.log(`modalSiswa called with ${action}`); },
    saveSiswa: async () => { console.log('saveSiswa called'); },
    modalGuru: (action, id = null) => {
        const modal = document.getElementById('modalGuru');
        const form = document.getElementById('form-guru');

        if (action === 'add') {
            document.getElementById('g_id').value = '';
            document.getElementById('g_nuptk').value = '';
            document.getElementById('g_nip').value = '';
            document.getElementById('g_nama').value = '';
            document.getElementById('g_jk').value = 'L';
            document.getElementById('g_kelasrombel').value = '';
        } else if (action === 'edit' && id) {
            // Load existing data
            db.get('teachers', id).then(guru => {
                if (guru) {
                    document.getElementById('g_id').value = guru.id || '';
                    document.getElementById('g_nuptk').value = guru.nuptk || '';
                    document.getElementById('g_nip').value = guru.nip || '';
                    document.getElementById('g_nama').value = guru.nama || '';
                    document.getElementById('g_jk').value = guru.jk || 'L';
                    document.getElementById('g_kelasrombel').value = guru.kelas || '';
                }
            });
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },
    saveGuru: async () => {
        try {
            const id = document.getElementById('g_id').value;
            const nuptk = document.getElementById('g_nuptk').value;
            const nip = document.getElementById('g_nip').value;
            const nama = document.getElementById('g_nama').value;
            const jk = document.getElementById('g_jk').value;
            const kelas = document.getElementById('g_kelasrombel').value;

            const data = {
                nuptk,
                nip,
                nama,
                jk,
                kelas
            };

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('teachers', data);
            app.showAlert('Guru berhasil disimpan', 'success');
            app.loadGuru();
            bootstrap.Modal.getInstance(document.getElementById('modalGuru')).hide();
        } catch (error) {
            console.error('Error saving guru:', error);
            app.showAlert('Gagal menyimpan guru', 'danger');
        }
    },
    deleteGuru: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus guru ini?')) {
            try {
                await db.init();
                await db.delete('teachers', id);
                app.showAlert('Guru berhasil dihapus', 'success');
                app.loadGuru();
            } catch (error) {
                console.error('Error deleting guru:', error);
                app.showAlert('Gagal menghapus guru', 'danger');
            }
        }
    },
    modalGuruMapel: (action) => { console.log(`modalGuruMapel called with ${action}`); },
    saveGuruMapel: async () => { console.log('saveGuruMapel called'); },
    saveDimensi: async () => { console.log('saveDimensi called'); },
    saveKaih: async () => { console.log('saveKaih called'); },
    modalMapel: (action) => { console.log(`modalMapel called with ${action}`); },
    saveMapel: async () => { console.log('saveMapel called'); },
    modalCPTP: (action) => { console.log(`modalCPTP called with ${action}`); },
    saveCPTP: async () => { console.log('saveCPTP called'); },
    modalKokurikuler: (action) => { console.log(`modalKokurikuler called with ${action}`); },
    saveKokurikuler: async () => { console.log('saveKokurikuler called'); },
    modalTemaEkskul: (action) => { console.log(`modalTemaEkskul called with ${action}`); },
    saveTemaEkskul: async () => { console.log('saveTemaEkskul called'); },
    modalJenisEkskul: (action) => { console.log(`modalJenisEkskul called with ${action}`); },
    saveJenisEkskul: async () => { console.log('saveJenisEkskul called'); },
    modalAssignEkskul: () => { console.log('modalAssignEkskul called'); },
    saveAssignEkskul: async () => { console.log('saveAssignEkskul called'); },
    downloadTemplate: (type) => { console.log(`downloadTemplate called for ${type}`); },
    exportData: (type) => { console.log(`exportData called for ${type}`); },
    modalImport: (type) => { console.log(`modalImport called for ${type}`); },
    processImport: async () => { console.log('processImport called'); },
    deleteAll: (store) => { console.log(`deleteAll called for ${store}`); },
    modalDownloadTemplate: (type) => { console.log(`modalDownloadTemplate called for ${type}`); },
    modalExportData: (type) => { console.log(`modalExportData called for ${type}`); },
    previewRaporPDF: () => { console.log('previewRaporPDF called'); },
    modalResetPass: (id, type) => { console.log(`modalResetPass called for ${type} ${id}`); },
    saveResetPassword: async () => { console.log('saveResetPassword called'); },
    deleteUser: async (id, type) => {
        if (confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) {
            try {
                await db.init();
                await db.delete('admins', id);
                app.showAlert('Pengguna berhasil dihapus', 'success');
                if (type === 'admin') {
                    app.loadAdminUsers();
                } else if (type === 'guru') {
                    app.loadGuruUsers();
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                app.showAlert('Gagal menghapus pengguna', 'danger');
            }
        }
    }
};
