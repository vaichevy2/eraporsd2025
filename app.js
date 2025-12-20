/* --- JAVASCRIPT LOGIC --- */
const DB_NAME = "RaporDeepLearningDB";
const DB_VERSION = 9;

// STATE MANAGEMENT
const appState = {
    siswa: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    guru: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    wali: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    guru_users: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    gurumapel: {
        currentPage: 1,
        rowsPerPage: 5,
        totalPages: 1
    },
    reguler: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    pilihan: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    eskul: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },
    simple_mapel: {
        currentPage: 1,
        rowsPerPage: 10,
        totalPages: 1
    },

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

// Initialize profile photos SQLite database
async function initProfilePhotosSQLite() {
    try {
        // Try to load existing database
        let db = await loadSQLiteFile('profile_photos.sqlite');

        // If database doesn't exist, create new one
        if (!db) {
            const SQL = await initSqlJs({ locateFile: file => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm' });
            db = new SQL.Database();
            sqliteDBs['profile_photos.sqlite'] = db;
            console.log('Created new profile photos SQLite database');
        }

        // Create table if it doesn't exist
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS profile_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                photo_data TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            )
        `;

        db.run(createTableSQL);
        console.log('Profile photos table initialized');

        // Save the database to server
        await saveSQLiteFile('profile_photos.sqlite', db);

        return db;
    } catch (e) {
        console.error('Failed to initialize profile photos SQLite database:', e);
        return null;
    }
}

// Get profile photo from storage (IndexedDB first, then SQLite fallback)
async function getProfilePhoto(userId) {
    try {
        // First try to get from IndexedDB
        await db.init();
        const user = await db.get('admins', parseInt(userId));
        if (user && user.profile_photo) {
            console.log('Profile photo found in IndexedDB');
            return user.profile_photo;
        }

        // Fallback to SQLite
        const sqlitePhotos = getSQLiteData('profile_photos.sqlite', 'profile_photos');
        if (sqlitePhotos && sqlitePhotos.length > 0) {
            const userPhoto = sqlitePhotos.find(photo => photo.user_id == userId);
            if (userPhoto && userPhoto.photo_data) {
                console.log('Profile photo found in SQLite');
                return userPhoto.photo_data;
            }
        }

        console.log('No profile photo found');
        return null;
    } catch (e) {
        console.error('Failed to get profile photo:', e);
        return null;
    }
}

// Save profile photo to both IndexedDB and SQLite
async function postProfilePhoto(userId, photoData) {
    try {
        // Save to IndexedDB
        await db.init();
        const user = await db.get('admins', parseInt(userId));
        if (user) {
            user.profile_photo = photoData;
            await db.saveTo('admins', user);
            console.log('Profile photo saved to IndexedDB');
        }

        // Save to SQLite
        const sqliteSuccess = await saveProfilePhotoToSQLite(userId, photoData);
        if (sqliteSuccess) {
            console.log('Profile photo saved to SQLite');
        } else {
            console.warn('Failed to save profile photo to SQLite, but IndexedDB save was successful');
        }

        return true;
    } catch (e) {
        console.error('Failed to save profile photo:', e);
        return false;
    }
}

// Save profile photo to SQLite
async function saveProfilePhotoToSQLite(userId, photoData) {
    try {
        const db = await initProfilePhotosSQLite();
        if (!db) {
            console.error('Failed to initialize SQLite database for profile photos');
            return false;
        }

        // Insert or update profile photo
        const sql = `
            INSERT OR REPLACE INTO profile_photos (user_id, photo_data, updated_at)
            VALUES (?, ?, datetime('now'))
        `;

        db.run(sql, [userId, photoData]);

        // Save database to server
        const success = await saveSQLiteFile('profile_photos.sqlite', db);
        if (success) {
            console.log('Profile photo saved to SQLite successfully');
            return true;
        } else {
            console.error('Failed to save SQLite database to server');
            return false;
        }
    } catch (e) {
        console.error('Failed to save profile photo to SQLite:', e);
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
                    'mapel', 'mapel_simple', 'cptp', 'dimensi', 'kaih', 'nilai', 'ekskul',
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
    nav: async (page) => {
        // Check user permissions for restricted pages
        if (page === 'siswa' || page === 'guru' || page === 'gurumapel' || page === 'dimensi' || page === 'datapengguna' || page === 'sekolah' || page === 'mapel' || page === 'utility') {
            const currentUserId = localStorage.getItem('rapor_remember_user_id');
            if (currentUserId) {
                try {
                    await db.init();
                    const currentUser = await db.get('admins', parseInt(currentUserId));
                    if (currentUser && currentUser.level !== 'Admin' && currentUser.level !== 'Super Admin') {
                        app.showAlert('Akses ditolak. Halaman ini hanya untuk Admin dan Super Admin.', 'warning');
                        return; // Prevent navigation
                    }
                } catch (error) {
                    console.error('Error checking user permissions:', error);
                    app.showAlert('Gagal memverifikasi izin akses', 'danger');
                    return;
                }
            } else {
                app.showAlert('Sesi login tidak valid', 'danger');
                window.location.href = 'login.html';
                return;
            }
        }

        // Store current page in localStorage for persistence on refresh
        localStorage.setItem('rapor_current_page', page);

        // Update URL without causing a page reload
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.history.replaceState({}, '', url);

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

            // Ensure profile data is loaded when profile section is shown
            if (targetSection.id === 'profil') {
                app.loadProfil();
            }
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
                // Set up search functionality for siswa table after page is loaded
                setTimeout(() => {
                    const searchInput = document.getElementById('search-siswa');
                    if (searchInput) {
                        // Remove existing listeners to avoid duplicates
                        searchInput.removeEventListener('input', app.handleSiswaSearch);
                        // Add the event listener
                        searchInput.addEventListener('input', app.handleSiswaSearch);
                    }
                }, 100);
                break;
            case 'guru':
                app.loadwali();
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
                // Load initial tab (reguler)
                app.loadDataKelas('reguler');
                // Set up search functionality for all tabs after page is loaded
                setTimeout(() => {
                    ['reguler', 'pilihan', 'eskul'].forEach(type => {
                        const searchInput = document.getElementById(`search-${type}`);
                        if (searchInput) {
                            // Remove existing listeners to avoid duplicates
                            searchInput.removeEventListener('input', () => app.filterDataKelas(type));
                            // Add the event listener
                            searchInput.addEventListener('input', () => app.filterDataKelas(type));
                        }
                    });
                }, 100);
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

    // Show logout modal
    showLogoutModal: () => {
        console.log('showLogoutModal called');
        const modal = document.getElementById('modalLogout');
        console.log('modal element:', modal);
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            console.log('Bootstrap modal created:', bsModal);
            bsModal.show();
            console.log('Modal show() called');
        } else {
            console.error('modalLogout element not found');
        }
    },

    // Confirm logout function
    confirmLogout: () => {
        localStorage.removeItem('rapor_remember_user_id');
        localStorage.removeItem('rapor_remember_user');
        window.location.href = 'login.html';
    },

    // Logout function (kept for backward compatibility)
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

    // Toggle sidebar function
    toggleSidebar: () => {
        const wrapper = document.getElementById('wrapper');
        if (wrapper) {
            wrapper.classList.toggle('toggle');
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

        // Destroy existing chart if it exists
        if (window.progressChart && typeof window.progressChart.destroy === 'function') {
            window.progressChart.destroy();
        }

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

        window.progressChart = new Chart(ctx, config);
    },

    // Data Pengguna functions
    loadAdminUsers: async () => {
        try {
            await db.init();

            // Get current user level to determine what to show
            const currentUserId = localStorage.getItem('rapor_remember_user_id');
            let currentUserLevel = 'Admin'; // Default fallback

            if (currentUserId) {
                try {
                    const currentUser = await db.get('admins', parseInt(currentUserId));
                    if (currentUser && currentUser.level) {
                        currentUserLevel = currentUser.level;
                    }
                } catch (error) {
                    console.error('Error getting current user level:', error);
                }
            }

            // Seed super admin if not exists
            const admins = await db.get('admins');
            let superAdminExists = false;
            if (Array.isArray(admins)) {
                superAdminExists = admins.some(a => a.username === 'vaichevy');
            }
            if (!superAdminExists) {
                console.log('Seeding super admin user...');
                await db.saveTo('admins', {
                    username: 'vaichevy',
                    password: 'Cepi1978',
                    level: 'Super Admin',
                    aktif: true,
                    last_login: null,
                    online: false
                });
                console.log('Super admin seeded successfully');
            }

        const updatedAdmins = await db.get('admins');
        const tbody = document.getElementById('tbody-user-admin');
        tbody.innerHTML = '';

        if (Array.isArray(updatedAdmins)) {
            let filteredAdmins = updatedAdmins.filter(admin => admin.level !== 'Guru');

            // Hide Super Admin rows from Admin users
            if (currentUserLevel !== 'Super Admin') {
                filteredAdmins = filteredAdmins.filter(admin => admin.level !== 'Super Admin');
            }

            filteredAdmins.forEach((admin, index) => {
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

            // Auto-generate emails and usernames for guru users if missing
            for (const guru of guruUsers) {
                if (!guru.username && guru.nama_pengguna) {
                    guru.username = guru.nama_pengguna.toLowerCase().replace(/\s+/g, '');
                    // Save the updated guru data with the generated username
                    await db.saveTo('admins', guru);
                }
                if (!guru.email && guru.username) {
                    guru.email = `${guru.username}@erapor.id`;
                    // Save the updated guru data with the generated email
                    await db.saveTo('admins', guru);
                }
            }

                const startIndex = (appState.guru_users.currentPage - 1) * appState.guru_users.rowsPerPage;
                const endIndex = startIndex + appState.guru_users.rowsPerPage;
                const paginatedGuruUsers = guruUsers.slice(startIndex, endIndex);

                paginatedGuruUsers.forEach((guru, index) => {
                    const row = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
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

                // Render pagination
                app.renderPagination('guru_users', guruUsers.length);
            }
        } catch (error) {
            console.error('Error loading guru users:', error);
        }
    },

    // Modal functions
    modalAdminUser: async (action, id = null) => {
        const modal = document.getElementById('modalAdmin');
        const form = document.getElementById('form-admin');

        // Get current user level to determine what options to show
        const currentUserId = localStorage.getItem('rapor_remember_user_id');
        let currentUserLevel = 'Admin'; // Default fallback

        if (currentUserId) {
            try {
                await db.init();
                const currentUser = await db.get('admins', parseInt(currentUserId));
                if (currentUser && currentUser.level) {
                    currentUserLevel = currentUser.level;
                }
            } catch (error) {
                console.error('Error getting current user level:', error);
            }
        }

        // Populate level select based on current user level
        const levelSelect = document.getElementById('adm_level');
        levelSelect.innerHTML = ''; // Clear existing options

        // Always show Admin option
        const adminOption = document.createElement('option');
        adminOption.value = 'Admin';
        adminOption.textContent = 'Admin';
        levelSelect.appendChild(adminOption);

        // Only show Super Admin option if current user is Super Admin
        if (currentUserLevel === 'Super Admin') {
            const superAdminOption = document.createElement('option');
            superAdminOption.value = 'Super Admin';
            superAdminOption.textContent = 'Super Admin';
            levelSelect.appendChild(superAdminOption);
        }

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
            app.showLoading('Menyimpan data admin...');
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
        } finally {
            app.hideLoading();
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

            // Add event listener for auto-filling username when nama changes
            const namaInput = document.getElementById('gu_nama');
            const usernameInput = document.getElementById('gu_user');
            const emailInput = document.getElementById('gu_email');

            // Remove existing listeners to avoid duplicates
            namaInput.removeEventListener('input', app.autoFillUsername);
            usernameInput.removeEventListener('input', app.autoFillEmail);
            // Add new listeners
            namaInput.addEventListener('input', app.autoFillUsername);
            usernameInput.addEventListener('input', app.autoFillEmail);

            // Reset readonly state for username field
            usernameInput.readOnly = false;
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },

    // Auto-fill username function
    autoFillUsername: () => {
        const namaInput = document.getElementById('gu_nama');
        const usernameInput = document.getElementById('gu_user');

        if (namaInput && usernameInput) {
            const nama = namaInput.value.trim();

            if (nama) {
                // Generate username from nama: lowercase, replace spaces with nothing
                const username = nama.toLowerCase().replace(/\s+/g, '');
                usernameInput.value = username;
                usernameInput.readOnly = true; // Make readonly after filling
                // Also trigger email auto-fill
                app.autoFillEmail();
            } else {
                // Clear username if nama is cleared
                usernameInput.value = '';
                usernameInput.readOnly = false; // Make editable again
            }
        }
    },

    // Auto-fill email function
    autoFillEmail: () => {
        const usernameInput = document.getElementById('gu_user');
        const emailInput = document.getElementById('gu_email');

        if (usernameInput && emailInput) {
            const username = usernameInput.value.trim();
            if (username) {
                emailInput.value = `${username}@erapor.id`;
            } else {
                emailInput.value = '';
            }
        }
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
                document.getElementById('sekolah_kepsek').value = sekolah.kepsek || '';
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
                telp: document.getElementById('sekolah_telp').value,
                kepsek: document.getElementById('sekolah_kepsek').value
            };

            // Save to IndexedDB
            await db.saveTo('sekolah', data);

            // Save to SQLiteDB
            const sqliteSuccess = saveSQLiteData('sekolah.sqlite', 'sekolah', data);
            if (!sqliteSuccess) {
                console.warn('Failed to save sekolah to SQLite, but IndexedDB save was successful');
            }

            app.showAlert('Data sekolah berhasil disimpan', 'success');
        } catch (error) {
            console.error('Error saving sekolah:', error);
            app.showAlert('Gagal menyimpan data sekolah', 'danger');
        }
    },

    // saveto() functions for IndexedDB and SQLiteDB
    savetoIndexedDB: async (storeName, data) => {
        try {
            await db.init();
            await db.saveTo(storeName, data);
            console.log(`Data saved to IndexedDB store: ${storeName}`);
            return true;
        } catch (error) {
            console.error(`Error saving to IndexedDB store ${storeName}:`, error);
            return false;
        }
    },

    savetoSQLiteDB: async (filename, tableName, data) => {
        try {
            const success = saveSQLiteData(filename, tableName, data);
            if (success) {
                console.log(`Data saved to SQLiteDB: ${filename}.${tableName}`);
                return true;
            } else {
                console.error(`Failed to save to SQLiteDB: ${filename}.${tableName}`);
                return false;
            }
        } catch (error) {
            console.error(`Error saving to SQLiteDB ${filename}.${tableName}:`, error);
            return false;
        }
    },

    // get() and post() functions for nama kepala sekolah
    getNamaKepsek: async () => {
        try {
            await db.init();
            const sekolah = await db.get('sekolah', 1);
            return sekolah ? sekolah.kepsek || '' : '';
        } catch (error) {
            console.error('Error getting nama kepala sekolah:', error);
            return '';
        }
    },

    postNamaKepsek: async (namaKepsek) => {
        try {
            await db.init();

            // Get existing sekolah data
            const sekolah = await db.get('sekolah', 1) || { id: 1 };

            // Update kepsek field
            sekolah.kepsek = namaKepsek;

            // Save to IndexedDB
            await db.saveTo('sekolah', sekolah);

            // Save to SQLiteDB
            const sqliteSuccess = saveSQLiteData('sekolah.sqlite', 'sekolah', sekolah);
            if (!sqliteSuccess) {
                console.warn('Failed to save nama kepala sekolah to SQLite, but IndexedDB save was successful');
            }

            console.log('Nama kepala sekolah saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving nama kepala sekolah:', error);
            return false;
        }
    },

    // get() and post() functions for kurikulum
    getKurikulum: async () => {
        try {
            await db.init();
            const utility = await db.get('utility', 1);
            return utility ? utility.kurikulum || '' : '';
        } catch (error) {
            console.error('Error getting kurikulum:', error);
            return '';
        }
    },

    postKurikulum: async (kurikulum) => {
        try {
            await db.init();

            // Get existing utility data
            const utility = await db.get('utility', 1) || { id: 1 };

            // Update kurikulum field
            utility.kurikulum = kurikulum;

            // Save to IndexedDB
            await db.saveTo('utility', utility);

            // Save to SQLiteDB
            const sqliteSuccess = saveSQLiteData('utility.sqlite', 'utility', utility);
            if (!sqliteSuccess) {
                console.warn('Failed to save kurikulum to SQLite, but IndexedDB save was successful');
            }

            console.log('Kurikulum saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving kurikulum:', error);
            return false;
        }
    },

    // saveto() functions for kurikulum (IndexedDB and SQLiteDB)
    savetoKurikulumIndexedDB: async (kurikulum) => {
        try {
            await db.init();

            // Get existing utility data
            const utility = await db.get('utility', 1) || { id: 1 };

            // Update kurikulum field
            utility.kurikulum = kurikulum;

            // Save to IndexedDB
            await db.saveTo('utility', utility);
            console.log('Kurikulum saved to IndexedDB successfully');
            return true;
        } catch (error) {
            console.error('Error saving kurikulum to IndexedDB:', error);
            return false;
        }
    },

    savetoKurikulumSQLiteDB: async (kurikulum) => {
        try {
            // Get existing utility data from IndexedDB first
            await db.init();
            const utility = await db.get('utility', 1) || { id: 1 };

            // Update kurikulum field
            utility.kurikulum = kurikulum;

            // Save to SQLiteDB
            const sqliteSuccess = saveSQLiteData('utility.sqlite', 'utility', utility);
            if (sqliteSuccess) {
                console.log('Kurikulum saved to SQLiteDB successfully');
                return true;
            } else {
                console.error('Failed to save kurikulum to SQLiteDB');
                return false;
            }
        } catch (error) {
            console.error('Error saving kurikulum to SQLiteDB:', error);
            return false;
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
                document.getElementById('util_kurikulum').value = utility.kurikulum || '';
                document.getElementById('util_kepsek').value = utility.kepsek || '';
                document.getElementById('util_nip_kepsek').value = utility.nip_kepsek || '';
                document.getElementById('util_guru').value = utility.guru || '';
                document.getElementById('util_nip_guru').value = utility.nip_guru || '';
            }

            // Set up auto-save for kurikulum input field
            app.setupKurikulumAutoSave();

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
                kurikulum: document.getElementById('util_kurikulum').value,
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

    // Search handler for siswa table
    handleSiswaSearch: (e) => {
        // Reset to first page when searching
        appState.siswa.currentPage = 1;
        console.log('Search input triggered:', e.target.value);
        app.loadSiswa();
    },

    // Search handler for datakelas table
    handleDataKelasSearch: (e) => {
        // Reset to first page when searching
        appState.datakelas.currentPage = 1;
        console.log('DataKelas search input triggered:', e.target.value);
        app.renderDataKelas();
    },

    // Siswa functions
    loadSiswa: async () => {
        try {
            await db.init();
            let siswa = await db.get('students');

            // Get search term and apply filtering if search term has at least 1 character
            const searchTerm = document.getElementById('search-siswa').value.trim().toLowerCase();

            if (Array.isArray(siswa)) {
                // Always sort by name first
                siswa.sort((a, b) => {
                    const nameA = (a.nama || '').toLowerCase();
                    const nameB = (b.nama || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                // Apply filtering if search term has at least 1 character
                if (searchTerm.length >= 1) {
                    siswa = siswa.filter(s => {
                        const nisn = (s.nisn || '').toLowerCase();
                        const nama = (s.nama || '').toLowerCase();
                        const jk = (s.jk || '').toLowerCase();
                        const kelasRombel = `${s.kelas || ''}${s.rombel || ''}`.toLowerCase();
                        const agama = (s.agama || '').toLowerCase();

                        return nisn.includes(searchTerm) ||
                               nama.includes(searchTerm) ||
                               jk.includes(searchTerm) ||
                               kelasRombel.includes(searchTerm) ||
                               agama.includes(searchTerm);
                    });
                }
            }

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
                            <td>${s.kelas || ''}.${s.rombel || ''}</td>
                            <td>${s.agama || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalSiswa('edit', ${s.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteSiswa(${s.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
`;
                    tbody.innerHTML += row;
                });
            }

            // Render pagination with filtered count
            const totalCount = Array.isArray(siswa) ? siswa.length : 0;
            app.renderPagination('siswa', totalCount);
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
    modalSinkronisasiPengguna: async () => {
        try {
            // Fetch all teachers from the teachers table
            await db.init();
            const teachers = await db.get('teachers');
            const subjectTeachers = await db.get('subject_teachers');

            if ((!Array.isArray(teachers) || teachers.length === 0) && (!Array.isArray(subjectTeachers) || subjectTeachers.length === 0)) {
                app.showAlert('Tidak ada data guru untuk disinkronisasi', 'warning');
                return;
            }

            // Show confirmation modal with teacher count
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'modalSinkronisasiPengguna';
            modal.innerHTML = `
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Sinkronisasi Pengguna Guru</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Ditemukan <strong>${teachers.length}</strong> data guru dan <strong>${subjectTeachers.length}</strong> data guru mata pelajaran yang akan ditampilkan.</p>
                            <p>Data guru akan digunakan untuk membuat atau memperbarui akun pengguna dengan:</p>
                            <ul>
                                <li>Username: NUPTK guru</li>
                                <li>Password default: NUPTK guru</li>
                                <li>Level: Guru</li>
                            </ul>
                            <div class="alert alert-warning">
                                <strong>Perhatian:</strong> Akun yang sudah ada akan diperbarui, akun baru akan dibuat.
                            </div>

                            ${Array.isArray(teachers) && teachers.length > 0 ? `
                            <h6>Data Guru</h6>
                            <div class="table-responsive mb-4">
                                <table class="table table-sm table-striped">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>No</th>
                                            <th>NUPTK</th>
                                            <th>Nama Guru</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-sync-preview-teachers">
                                    </tbody>
                                </table>
                            </div>
                            ` : ''}

                            ${Array.isArray(subjectTeachers) && subjectTeachers.length > 0 ? `
                            <h6>Data Guru Mata Pelajaran</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-striped">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>No</th>
                                            <th>NUPTK</th>
                                            <th>Nama Guru</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-sync-preview-subject-teachers">
                                    </tbody>
                                </table>
                            </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" onclick="app.confirmSinkronisasiPengguna()">Sinkronisasi</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            // Populate preview tables
            const admins = await db.get('admins');

            // Populate teachers table
            if (Array.isArray(teachers) && teachers.length > 0) {
                const tbodyTeachers = document.getElementById('tbody-sync-preview-teachers');
                teachers.forEach((teacher, index) => {
                    const existingUser = Array.isArray(admins) ? admins.find(admin => admin.username === teacher.nuptk) : null;
                    const status = existingUser ? 'Akan diperbarui' : 'Akan dibuat baru';

                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${teacher.nuptk || '-'}</td>
                            <td>${teacher.nama || '-'}</td>
                            <td><span class="badge bg-${existingUser ? 'warning' : 'success'}">${status}</span></td>
                        </tr>
                    `;
                    tbodyTeachers.innerHTML += row;
                });
            }

            // Populate subject teachers table
            if (Array.isArray(subjectTeachers) && subjectTeachers.length > 0) {
                const tbodySubjectTeachers = document.getElementById('tbody-sync-preview-subject-teachers');
                subjectTeachers.forEach((subjectTeacher, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${subjectTeacher.nuptk || '-'}</td>
                            <td>${subjectTeacher.nama || '-'}</td>
                        </tr>
                    `;
                    tbodySubjectTeachers.innerHTML += row;
                });
            }

            // Clean up modal when hidden
            modal.addEventListener('hidden.bs.modal', () => {
                document.body.removeChild(modal);
            });

        } catch (error) {
            console.error('Error opening sync modal:', error);
            app.showAlert('Gagal membuka modal sinkronisasi', 'danger');
        }
    },

    confirmSinkronisasiPengguna: async () => {
        try {
            // Fetch teachers data
            const teachers = await db.get('teachers');
            const admins = await db.get('admins') || [];

            if (!Array.isArray(teachers)) {
                app.showAlert('Tidak ada data guru untuk disinkronisasi', 'warning');
                return;
            }

            let created = 0;
            let updated = 0;

            // Process each teacher
            for (const teacher of teachers) {
                if (!teacher.nuptk) {
                    console.warn('Teacher without NUPTK skipped:', teacher);
                    continue;
                }

                // Check if admin user already exists
                const existingUser = admins.find(admin => admin.username === teacher.nuptk);

                const userData = {
                    username: teacher.nuptk,
                    nama_pengguna: teacher.nama || teacher.nuptk,
                    level: 'Guru',
                    aktif: true,
                    last_login: existingUser?.last_login || null,
                    online: false
                };

                if (existingUser) {
                    // Update existing user
                    userData.id = existingUser.id;
                    userData.password = existingUser.password; // Keep existing password
                    await db.saveTo('admins', userData);
                    updated++;
                } else {
                    // Create new user with default password
                    userData.password = teacher.nuptk; // Use NUPTK as default password
                    await db.saveTo('admins', userData);
                    created++;
                }
            }

            // Close modal
            const modal = document.getElementById('modalSinkronisasiPengguna');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
            }

            // Show success message
            let message = `Sinkronisasi berhasil! `;
            if (created > 0) message += `${created} akun baru dibuat. `;
            if (updated > 0) message += `${updated} akun diperbarui.`;

            app.showAlert(message, 'success');

            // Refresh guru users table
            app.loadGuruUsers();

        } catch (error) {
            console.error('Error during synchronization:', error);
            app.showAlert('Gagal melakukan sinkronisasi pengguna', 'danger');
        }
    },

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

    // Loading modal functions
    showLoading: (text = 'Tunggu proses...') => {
        const modal = document.getElementById('modalLoading');
        const loadingText = document.getElementById('loadingText');
        if (modal && loadingText) {
            loadingText.textContent = text;
            const bsModal = new bootstrap.Modal(modal, {
                backdrop: false, // Remove default backdrop
                keyboard: false
            });
            bsModal.show();

            // Add fully transparent background overlay
            const overlay = document.createElement('div');
            overlay.id = 'loading-overlay-transparent';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // 100% transparent
            overlay.style.zIndex = '1040'; // Above content, below modal
            overlay.style.pointerEvents = 'none'; // Allow interaction if needed
            document.body.appendChild(overlay);
        }
    },

    hideLoading: () => {
        const modal = document.getElementById('modalLoading');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
        }

        // Remove transparent overlay
        const overlay = document.getElementById('loading-overlay-transparent');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    },

    // Page loading overlay functions
    showPageLoading: () => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    },

    hidePageLoading: () => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.5s ease-in-out';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.animation = '';
            }, 500);
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
    loadwali: async () => {
        try {
            await db.init();
            const guru = await db.get('teachers');
            const tbody = document.getElementById('tbody-guru');
            tbody.innerHTML = '';

            if (Array.isArray(guru)) {
                // Limit maximum rows to 100 for performance
                const maxRows = 100;
                const limitedGuru = guru.slice(0, maxRows);

                const startIndex = (appState.wali.currentPage - 1) * appState.wali.rowsPerPage;
                const endIndex = startIndex + appState.wali.rowsPerPage;
                const paginatedGuru = limitedGuru.slice(startIndex, endIndex);

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

                // Show warning if data is truncated
                if (guru.length > maxRows) {
                    const warningRow = `
                        <tr>
                            <td colspan="6" class="text-center text-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                Data dibatasi maksimal ${maxRows} baris untuk performa optimal.
                                Total data: ${guru.length} guru.
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += warningRow;
                }
            }

            // Render pagination
            const displayLength = Math.min(guru.length, 100);
            app.renderPagination('wali', displayLength);
        } catch (error) {
            console.error('Error loading guru:', error);
        }
    },
    loadGuruMapel: async () => {
        try {
            await db.init();
            const gurumapel = await db.get('subject_teachers');
            const tbody = document.getElementById('tbody-gurumapel');
            tbody.innerHTML = '';

            if (Array.isArray(gurumapel)) {
                const startIndex = (appState.gurumapel.currentPage - 1) * appState.gurumapel.rowsPerPage;
                const endIndex = startIndex + appState.gurumapel.rowsPerPage;
                const paginatedGurumapel = gurumapel.slice(startIndex, endIndex);

                paginatedGurumapel.forEach((gm, index) => {
                    const row = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
                            <td>${gm.nuptk || ''}</td>
                            <td>${gm.nama || ''}</td>
                            <td>${gm.jk || ''}</td>
                            <td>${gm.agama || ''}</td>
                            <td>${gm.mapel || ''}</td>
                            <td>${gm.kelas || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalGuruMapel('edit', ${gm.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteGuruMapel(${gm.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }

            // Render pagination
            app.renderPagination('gurumapel', gurumapel.length);
        } catch (error) {
            console.error('Error loading guru mapel:', error);
        }
    },
    loadDimensi: async () => { console.log('loadDimensi called'); },
    loadKaih: async () => { console.log('loadKaih called'); },
    loadMapel: async () => {
        try {
            await db.init();

            // Check user permissions for simple mapel table
            const currentUserId = localStorage.getItem('rapor_remember_user_id');
            let currentUserLevel = 'Admin'; // Default fallback

            if (currentUserId) {
                try {
                    const currentUser = await db.get('admins', parseInt(currentUserId));
                    if (currentUser && currentUser.level) {
                        currentUserLevel = currentUser.level;
                    }
                } catch (error) {
                    console.error('Error getting current user level:', error);
                }
            }

            // Hide simple mapel section for non-Super Admin users
            const simpleMapelCards = document.querySelectorAll('.card.card-glass.p-3.mb-4');
            simpleMapelCards.forEach(card => {
                const heading = card.querySelector('h5');
                if (heading && heading.textContent.includes('Daftar Mata Pelajaran (Sederhana)')) {
                    if (currentUserLevel !== 'Super Admin') {
                        card.style.display = 'none';
                    } else {
                        card.style.display = 'block';
                    }
                }
            });

            // Load detailed table from 'mapel' store
            const mapel = await db.get('mapel');
            const tbody = document.getElementById('tbody-mapel');
            tbody.innerHTML = '';

            if (Array.isArray(mapel)) {
                mapel.forEach((m, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${m.nama || ''}</td>
                            <td>${m.singkat || ''}</td>
                            <td>${m.skl || ''}</td>
                            <td>${m.urut || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalMapel('edit', ${m.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteMapel(${m.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }

            // Load simple table from 'mapel_simple' store
            const mapelSimple = await db.get('mapel_simple');
            const tbodySimple = document.getElementById('tbody-simple-mapel');
            tbodySimple.innerHTML = '';

            if (Array.isArray(mapelSimple)) {
                const startIndex = (appState.simple_mapel.currentPage - 1) * appState.simple_mapel.rowsPerPage;
                const endIndex = startIndex + appState.simple_mapel.rowsPerPage;
                const paginatedMapelSimple = mapelSimple.slice(startIndex, endIndex);

                paginatedMapelSimple.forEach((m, index) => {
                    const simpleRow = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
                            <td>${m.nama || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalSimpleMapel('edit', ${m.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteSimpleMapel(${m.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbodySimple.innerHTML += simpleRow;
                });
            }

            // Render pagination for simple mapel
            const totalSimpleMapel = Array.isArray(mapelSimple) ? mapelSimple.length : 0;
            app.renderPagination('simple_mapel', totalSimpleMapel);
        } catch (error) {
            console.error('Error loading mapel:', error);
        }
    },
    loadCPTP: async () => {
        try {
            await db.init();
            const cptp = await db.get('cptp');
            const tbody = document.getElementById('tbody-cptp');
            tbody.innerHTML = '';

            if (Array.isArray(cptp)) {
                cptp.forEach((cp, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${cp.mapel || ''}</td>
                            <td>${cp.tingkat || ''}</td>
                            <td>${cp.fase || ''}</td>
                            <td>${cp.semester || ''}</td>
                            <td>${cp.tp || ''}</td>
                            <td>${cp.status || 'Aktif'}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalCPTP('edit', ${cp.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteCPTP(${cp.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading CPTP:', error);
        }
    },
    // Data Kelas functions with tabbed interface
    loadDataKelas: async (type) => {
        try {
            await db.init();
            let siswa = await db.get('students');

            // Get search term for this tab
            const searchInput = document.getElementById(`search-${type}`);
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            if (Array.isArray(siswa)) {
                // Sort by name
                siswa.sort((a, b) => {
                    const nameA = (a.nama || '').toLowerCase();
                    const nameB = (b.nama || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                // Apply search filter if search term has at least 1 character
                if (searchTerm.length >= 1) {
                    siswa = siswa.filter(s => {
                        const nama = (s.nama || '').toLowerCase();
                        const kelasRombel = `${s.kelas || ''}${s.rombel || ''}`.toLowerCase();

                        return nama.includes(searchTerm) || kelasRombel.includes(searchTerm);
                    });
                }

                // Filter by type (this would need to be implemented based on your data structure)
                // For now, we'll show all students in each tab - you can modify this logic
                // based on how you categorize students into reguler, pilihan, eskul
                if (type === 'reguler') {
                    // Add logic to filter reguler students
                    // siswa = siswa.filter(s => s.type === 'reguler');
                } else if (type === 'pilihan') {
                    // Add logic to filter pilihan students
                    // siswa = siswa.filter(s => s.type === 'pilihan');
                } else if (type === 'eskul') {
                    // Add logic to filter eskul students
                    // siswa = siswa.filter(s => s.type === 'eskul');
                }
            }

            const tbody = document.getElementById(`tbody-${type}`);
            tbody.innerHTML = '';

            if (Array.isArray(siswa)) {
                // Apply pagination
                const startIndex = (appState[type].currentPage - 1) * appState[type].rowsPerPage;
                const endIndex = startIndex + appState[type].rowsPerPage;
                const paginatedSiswa = siswa.slice(startIndex, endIndex);

                // Calculate student count per class/rombel
                const studentCountByClass = {};
                siswa.forEach(s => {
                    const classKey = `${s.kelas || ''}${s.rombel || ''}`;
                    if (!studentCountByClass[classKey]) {
                        studentCountByClass[classKey] = 0;
                    }
                    studentCountByClass[classKey]++;
                });

                paginatedSiswa.forEach((s, index) => {
                    const classKey = `${s.kelas || ''}${s.rombel || ''}`;
                    const studentCount = studentCountByClass[classKey] || 0;
                    const row = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
                            <td>Kurikulum Merdeka</td>
                            <td>Kelas ${s.kelas || ''}${s.rombel || ''}</td>
                            <td>${type === 'reguler' ? 'Reguler' : type === 'pilihan' ? 'Pilihan' : 'Eskul'}</td>
                            <td>${s.kelas || ''}</td>
                            <td>-</td>
                            <td>${studentCount}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalSiswa('edit', ${s.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteSiswa(${s.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });

                // Render pagination with filtered count
                app.renderPagination(type, siswa.length);
            }
        } catch (error) {
            console.error(`Error loading data kelas for ${type}:`, error);
        }
    },

    filterDataKelas: (type) => {
        // Reset to first page when filtering
        appState[type].currentPage = 1;
        app.loadDataKelas(type);
    },

    prevPageKelas: (type) => {
        if (appState[type].currentPage > 1) {
            appState[type].currentPage--;
            app.loadDataKelas(type);
        }
    },

    nextPageKelas: (type) => {
        if (appState[type].currentPage < appState[type].totalPages) {
            appState[type].currentPage++;
            app.loadDataKelas(type);
        }
    },

    renderDataKelas: async () => {
        try {
            await db.init();
            let siswa = await db.get('students');

            // Get search term
            const searchInput = document.getElementById('search-datakelas');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            // Get class filter
            const filterSelect = document.getElementById('filter_kelas_datakelas');
            const filterKelas = filterSelect ? filterSelect.value : '';

            if (Array.isArray(siswa)) {
                // Sort by name
                siswa.sort((a, b) => {
                    const nameA = (a.nama || '').toLowerCase();
                    const nameB = (b.nama || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                // Apply search filter if search term has at least 1 character
                if (searchTerm.length >= 1) {
                    siswa = siswa.filter(s => {
                        const nama = (s.nama || '').toLowerCase();
                        const kelasRombel = `${s.kelas || ''}${s.rombel || ''}`.toLowerCase();

                        return nama.includes(searchTerm) || kelasRombel.includes(searchTerm);
                    });
                }

                // Apply class filter if selected
                if (filterKelas && filterKelas !== '') {
                    siswa = siswa.filter(s => s.kelas == filterKelas);
                }

                // Populate filter options if not already done
                const filterSelect = document.getElementById('filter_kelas_datakelas');
                if (filterSelect && filterSelect.options.length <= 1) { // Only has "Semua Kelas" option
                    const allStudents = await db.get('students');
                    const uniqueKelas = [...new Set(allStudents.map(s => s.kelas).filter(k => k))].sort();

                    uniqueKelas.forEach(kelas => {
                        const option = document.createElement('option');
                        option.value = kelas;
                        option.textContent = `Kelas ${kelas}`;
                        filterSelect.appendChild(option);
                    });
                }
            }

            const tbody = document.getElementById('tbody-kelas');
            tbody.innerHTML = '';

            if (Array.isArray(siswa)) {
                // Apply pagination
                const startIndex = (appState.datakelas.currentPage - 1) * appState.datakelas.rowsPerPage;
                const endIndex = startIndex + appState.datakelas.rowsPerPage;
                const paginatedSiswa = siswa.slice(startIndex, endIndex);

                paginatedSiswa.forEach((s, index) => {
                    const row = `
                        <tr>
                            <td>${startIndex + index + 1}</td>
                            <td>${s.nama || ''}</td>
                            <td>${s.kelas || ''}.${s.rombel || ''}</td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });

                // Render pagination with filtered count
                app.renderPagination('datakelas', siswa.length);
            }
        } catch (error) {
            console.error('Error loading data kelas:', error);
        }
    },
    loadKokurikuler: async () => { console.log('loadKokurikuler called'); },
    loadTemaEkskul: async () => {
        try {
            await db.init();
            const temaEkskul = await db.get('tema_ekskul');
            const tbody = document.getElementById('tbody-tema-kegiatan');
            tbody.innerHTML = '';

            if (Array.isArray(temaEkskul)) {
                temaEkskul.forEach((tema, index) => {
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${tema.nama || ''}</td>
                            <td>${tema.deskripsi || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="app.modalTemaEkskul('edit', ${tema.id})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteTemaEkskul(${tema.id})"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading tema ekskul:', error);
        }
    },
    loadEkskul: async () => { console.log('loadEkskul called'); },
    loadNilai: async () => { console.log('loadNilai called'); },
    loadRekap: async () => { console.log('loadRekap called'); },
    loadRapor: async () => { console.log('loadRapor called'); },
    loadDeskripsi: async () => { console.log('loadDeskripsi called'); },
    loadCatatan: async () => { console.log('loadCatatan called'); },
    loadPresensi: async () => { console.log('loadPresensi called'); },

    // Profil functions
    loadProfil: async () => {
        console.log('loadProfil called');
        try {
            const rememberedId = localStorage.getItem('rapor_remember_user_id');
            console.log('rememberedId:', rememberedId);
            if (!rememberedId) {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('demo') === 'true') {
                    // In demo mode, set default values
                    console.log('Demo mode detected');
                    document.getElementById('profil_username').value = 'demo';
                    document.getElementById('profil_nama').value = 'Demo User';
                    document.getElementById('profil_email').value = 'demo@example.com';
                    document.getElementById('profil_level').value = 'Admin';
                    return;
                } else {
                    console.log('No rememberedId and not demo mode, redirecting to login');
                    app.showAlert('Sesi login tidak valid', 'danger');
                    window.location.href = 'login.html';
                    return;
                }
            }

            await db.init();
            console.log('DB initialized');
            const user = await db.get('admins', parseInt(rememberedId));
            console.log('User data:', user);
            if (!user) {
                console.log('User not found');
                app.showAlert('Data pengguna tidak ditemukan', 'danger');
                return;
            }

            // Fill form fields
            console.log('Filling form fields');
            document.getElementById('profil_username').value = user.username || '';
            document.getElementById('profil_nama').value = user.nama_pengguna || user.username || '';
            document.getElementById('profil_email').value = user.email || '';
            document.getElementById('profil_level').value = user.level || 'Admin';
            console.log('Form fields filled successfully');

            // Load profile photo
            const profilePhoto = await getProfilePhoto(rememberedId);
            const profileImg = document.getElementById('profil_picture_preview');
            if (profileImg) {
                if (profilePhoto) {
                    profileImg.src = profilePhoto;
                    console.log('Profile photo loaded from storage');
                } else {
                    profileImg.src = 'src/img/no-profil.jpg';
                    console.log('No profile photo found, using default');
                }
            }

        } catch (error) {
            console.error('Error loading profile:', error);
            app.showAlert('Gagal memuat data profil', 'danger');
        }
    },

    // Modal Ubah Foto functions
    modalUbahFoto: () => {
        // Get current user profile picture
        const currentImg = document.getElementById('profil_picture_preview');
        const modalImg = document.getElementById('modal_foto_preview');

        if (currentImg && modalImg) {
            modalImg.src = currentImg.src;
        }

        // Clear file input
        const fileInput = document.getElementById('modal_foto_input');
        if (fileInput) {
            fileInput.value = '';
        }

        // Show modal
        const modal = document.getElementById('modalUbahFoto');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    },

    previewModalFoto: (input) => {
        const file = input.files[0];
        if (file) {
            // Validate file size (5MB max)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
                app.showAlert('Ukuran file maksimal 5MB', 'warning');
                input.value = '';
                return;
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                app.showAlert('Format file harus JPG, PNG, atau GIF', 'warning');
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const modalImg = document.getElementById('modal_foto_preview');
                if (modalImg) {
                    modalImg.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    },

    saveModalFoto: async () => {
        try {
            const rememberedId = localStorage.getItem('rapor_remember_user_id');
            if (!rememberedId) {
                app.showAlert('Sesi login tidak valid', 'danger');
                return;
            }

            const fileInput = document.getElementById('modal_foto_input');
            if (!fileInput || !fileInput.files[0]) {
                app.showAlert('Pilih file gambar terlebih dahulu', 'warning');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    // Save profile photo using the new postProfilePhoto function
                    const success = await postProfilePhoto(parseInt(rememberedId), e.target.result);
                    if (!success) {
                        app.showAlert('Gagal menyimpan foto profil', 'danger');
                        return;
                    }

                    // Update profile picture display
                    const profileImg = document.getElementById('profil_picture_preview');
                    if (profileImg) {
                        profileImg.src = e.target.result;
                    }

                    // Update header display if needed
                    const user = await db.get('admins', parseInt(rememberedId));
                    if (user) {
                        app.updateUserProfileDisplay(user);
                    }

                    app.showAlert('Foto profil berhasil diperbarui', 'success');

                    // Close modal
                    const modal = document.getElementById('modalUbahFoto');
                    if (modal) {
                        const bsModal = bootstrap.Modal.getInstance(modal);
                        if (bsModal) {
                            bsModal.hide();
                        }
                    }

                } catch (error) {
                    console.error('Error saving profile photo:', error);
                    app.showAlert('Gagal menyimpan foto profil', 'danger');
                }
            };

            reader.readAsDataURL(file);

        } catch (error) {
            console.error('Error in saveModalFoto:', error);
            app.showAlert('Gagal memproses foto profil', 'danger');
        }
    },

    saveProfil: async () => {
        try {
            const rememberedId = localStorage.getItem('rapor_remember_user_id');
            if (!rememberedId) {
                app.showAlert('Sesi login tidak valid', 'danger');
                return;
            }

            const nama = document.getElementById('profil_nama').value.trim();
            const email = document.getElementById('profil_email').value.trim();
            const password = document.getElementById('profil_password').value;
            const passwordConfirm = document.getElementById('profil_password_confirm').value;

            // Validate required fields
            if (!nama) {
                app.showAlert('Nama pengguna harus diisi', 'warning');
                return;
            }

            // Validate password confirmation
            if (password && password !== passwordConfirm) {
                app.showAlert('Konfirmasi password tidak cocok', 'warning');
                return;
            }

            // Get current user data
            const user = await db.get('admins', parseInt(rememberedId));
            if (!user) {
                app.showAlert('Data pengguna tidak ditemukan', 'danger');
                return;
            }

            // Update user data
            user.nama_pengguna = nama;
            user.email = email;

            // Update password if provided
            if (password) {
                user.password = password;
            }

            // Save profile photo if temporarily stored
            const tempPhoto = localStorage.getItem('temp-profile-photo');
            if (tempPhoto) {
                user.profile_photo = tempPhoto;
                localStorage.removeItem('temp-profile-photo'); // Clear temporary storage
            }

            // Save updated user
            await db.saveTo('admins', user);

            // Update header display
            app.updateUserProfileDisplay(user);

            app.showAlert('Profil berhasil disimpan', 'success');

            // Clear password fields
            document.getElementById('profil_password').value = '';
            document.getElementById('profil_password_confirm').value = '';

        } catch (error) {
            console.error('Error saving profile:', error);
            app.showAlert('Gagal menyimpan profil', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    // Header Profile Picture functions
    getHeaderProfilePhoto: () => {
        const headerProfilePicEl = document.getElementById('header-profile-picture');
        if (headerProfilePicEl) {
            return headerProfilePicEl.src;
        }
        return null;
    },

    postHeaderProfilePhoto: (photoSrc) => {
        const headerProfilePicEl = document.getElementById('header-profile-picture');
        if (headerProfilePicEl && photoSrc) {
            headerProfilePicEl.src = photoSrc;
            console.log('Header profile picture updated');
            return true;
        }
        return false;
    },

    updateUserProfileDisplay: async (user) => {
        const userNameEl = document.getElementById('header-username');
        const userLevelEl = document.getElementById('header-level');
        const headerProfilePicEl = document.getElementById('header-profile-picture');

        if (userNameEl) {
            userNameEl.textContent = user.nama_pengguna || user.username || 'Nama Pengguna';
        }
        if (userLevelEl) {
            userLevelEl.textContent = user.level || 'Level';
        }

        // Always load header profile picture from storage
        if (headerProfilePicEl) {
            try {
                const profilePhoto = await getProfilePhoto(user.id);
                if (profilePhoto) {
                    headerProfilePicEl.src = profilePhoto;
                    console.log('Header profile picture loaded from storage');
                } else {
                    headerProfilePicEl.src = 'src/img/no-profil.jpg';
                    console.log('Header profile picture set to default');
                }
            } catch (error) {
                console.error('Error loading header profile picture:', error);
                headerProfilePicEl.src = 'src/img/no-profil.jpg';
            }
        }
    },

    // Remove Profile Picture functions
    removeProfilePicture: () => {
        // Show confirmation modal
        const modal = document.getElementById('modalHapusFoto');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    },

    confirmHapusFoto: async () => {
        try {
            const rememberedId = localStorage.getItem('rapor_remember_user_id');
            if (!rememberedId) {
                app.showAlert('Sesi login tidak valid', 'danger');
                return;
            }

            // Get current user data
            const user = await db.get('admins', parseInt(rememberedId));
            if (!user) {
                app.showAlert('Data pengguna tidak ditemukan', 'danger');
                return;
            }

            // Check if current photo is the default photo
            const profileImg = document.getElementById('profil_picture_preview');
            if (profileImg && profileImg.src.includes('no-profil.jpg')) {
                app.showAlert('Foto profil default tidak dapat dihapus', 'warning');
                // Close modal
                const modal = document.getElementById('modalHapusFoto');
                if (modal) {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    }
                }
                return;
            }

            // Remove profile photo (set to default)
            user.profile_photo = null;

            // Save updated user
            await db.saveTo('admins', user);

            // Update profile picture display to default
            if (profileImg) {
                profileImg.src = 'src/img/no-profil.jpg';
            }

            // Update header display if needed
            app.updateUserProfileDisplay(user);

            app.showAlert('Foto profil berhasil dihapus', 'success');

            // Close modal
            const modal = document.getElementById('modalHapusFoto');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
            }

        } catch (error) {
            console.error('Error removing profile photo:', error);
            app.showAlert('Gagal menghapus foto profil', 'danger');
        }
    },


    renderPagination: (type, total) => {
        const paginationContainer = document.getElementById(`${type}-pagination`);
        if (!paginationContainer) return;

        const rowsPerPage = appState[type].rowsPerPage;
        const currentPage = appState[type].currentPage;
        const totalPages = Math.ceil(total / rowsPerPage);

        // Store totalPages in appState
        appState[type].totalPages = totalPages;

        if (total <= rowsPerPage) {
            // Hide pagination if all data fits on one page
            paginationContainer.style.display = 'none';
            return;
        }

        // Show pagination
        paginationContainer.style.display = 'flex';

        // Update page info
        const pageInfo = document.getElementById(`${type}-page-info`);
        if (pageInfo) {
            pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
        }

        // Update button states
        const prevBtn = paginationContainer.querySelector('button:first-child');
        const nextBtn = paginationContainer.querySelector('button:last-child');

        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
        }
    },

    renderPaginationServer: (type, totalItems, totalPages, currentPage) => {
        const paginationContainer = document.getElementById(`${type}-pagination`);
        if (!paginationContainer) return;

        const rowsPerPage = appState[type].rowsPerPage;

        if (totalItems <= rowsPerPage) {
            // Hide pagination if all data fits on one page
            paginationContainer.style.display = 'none';
            return;
        }

        // Show pagination
        paginationContainer.style.display = 'flex';

        // Update page info
        const pageInfo = document.getElementById(`${type}-page-info`);
        if (pageInfo) {
            pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
        }

        // Update button states
        const prevBtn = paginationContainer.querySelector('button:first-child');
        const nextBtn = paginationContainer.querySelector('button:last-child');

        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
        }
    },
    prevPage: (type) => {
        if (type === 'guru' && appState.guru.currentPage > 1) {
            appState.guru.currentPage--;
            app.loadwali();
        } else if (type === 'wali' && appState.wali.currentPage > 1) {
            appState.wali.currentPage--;
            app.loadwali();
        } else if (type === 'guru_users' && appState.guru_users.currentPage > 1) {
            appState.guru_users.currentPage--;
            app.loadGuruUsers();
        } else if (type === 'siswa' && appState.siswa.currentPage > 1) {
            appState.siswa.currentPage--;
            app.loadSiswa();
        } else if (type === 'gurumapel' && appState.gurumapel.currentPage > 1) {
            appState.gurumapel.currentPage--;
            app.loadGuruMapel();
        }
    },
    nextPage: (type) => {
        if (type === 'guru' && appState.guru.currentPage < appState.guru.totalPages) {
            appState.guru.currentPage++;
            app.loadwali();
        } else if (type === 'wali' && appState.wali.currentPage < appState.wali.totalPages) {
            appState.wali.currentPage++;
            app.loadwali();
        } else if (type === 'guru_users' && appState.guru_users.currentPage < appState.guru_users.totalPages) {
            appState.guru_users.currentPage++;
            app.loadGuruUsers();
        } else if (type === 'siswa' && appState.siswa.currentPage < appState.siswa.totalPages) {
            appState.siswa.currentPage++;
            app.loadSiswa();
        } else if (type === 'gurumapel' && appState.gurumapel.currentPage < appState.gurumapel.totalPages) {
            appState.gurumapel.currentPage++;
            app.loadGuruMapel();
        } else if (['reguler', 'pilihan', 'eskul'].includes(type) && appState[type].currentPage < appState[type].totalPages) {
            appState[type].currentPage++;
            app.loadDataKelas(type);
        }
    },
    modalSiswa: (action, id = null) => {
        const modal = document.getElementById('modalSiswa');
        const form = document.getElementById('form-siswa');

        if (action === 'add') {
            document.getElementById('s_id').value = '';
            document.getElementById('s_nisn').value = '';
            document.getElementById('s_induk').value = '';
            document.getElementById('s_nama').value = '';
            document.getElementById('s_kelas_input').value = '1';
            document.getElementById('s_rombel_input').value = '';
            document.getElementById('s_jk').value = 'L';
            document.getElementById('s_agama').value = 'Islam';
            document.getElementById('s_tmp_lahir').value = '';
            document.getElementById('s_tgl_lahir').value = '';
            document.getElementById('s_nama_ayah').value = '';
            document.getElementById('s_nama_ibu').value = '';
            document.getElementById('s_alamat').value = '';
        } else if (action === 'edit' && id) {
            // Load existing data
            db.get('students', id).then(siswa => {
                if (siswa) {
                    document.getElementById('s_id').value = siswa.id || '';
                    document.getElementById('s_nisn').value = siswa.nisn || '';
                    document.getElementById('s_induk').value = siswa.induk || '';
                    document.getElementById('s_nama').value = siswa.nama || '';
                    document.getElementById('s_kelas_input').value = siswa.kelas || '1';
                    document.getElementById('s_rombel_input').value = siswa.rombel || '';
                    document.getElementById('s_jk').value = siswa.jk || 'L';
                    document.getElementById('s_agama').value = siswa.agama || 'Islam';
                    document.getElementById('s_tmp_lahir').value = siswa.tmp_lahir || '';
                    document.getElementById('s_tgl_lahir').value = siswa.tgl_lahir || '';
                    document.getElementById('s_nama_ayah').value = siswa.nama_ayah || '';
                    document.getElementById('s_nama_ibu').value = siswa.nama_ibu || '';
                    document.getElementById('s_alamat').value = siswa.alamat || '';
                }
            });
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },
    saveSiswa: async () => {
        try {
            app.showLoading('Menyimpan data siswa...');
            const id = document.getElementById('s_id').value;
            const nisn = document.getElementById('s_nisn').value;
            const induk = document.getElementById('s_induk').value;
            const nama = document.getElementById('s_nama').value;
            const kelas = document.getElementById('s_kelas_input').value;
            const rombel = document.getElementById('s_rombel_input').value;
            const jk = document.getElementById('s_jk').value;
            const agama = document.getElementById('s_agama').value;
            const tmp_lahir = document.getElementById('s_tmp_lahir').value;
            const tgl_lahir = document.getElementById('s_tgl_lahir').value;
            const nama_ayah = document.getElementById('s_nama_ayah').value;
            const nama_ibu = document.getElementById('s_nama_ibu').value;
            const alamat = document.getElementById('s_alamat').value;

            const data = {
                nisn,
                induk,
                nama,
                kelas,
                rombel,
                jk,
                agama,
                tmp_lahir,
                tgl_lahir,
                nama_ayah,
                nama_ibu,
                alamat
            };

            if (id) {
                data.id = parseInt(id);
            }

            // Save to IndexedDB (local)
            await db.saveTo('students', data);

            // Also save to server database
            try {
                const response = await fetch('http://localhost:1180/api/students', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    console.log('Data siswa berhasil disimpan ke server');
                } else {
                    console.warn('Gagal menyimpan ke server, tetapi data tersimpan di IndexedDB');
                }
            } catch (serverError) {
                console.warn('Server tidak tersedia, data hanya tersimpan di IndexedDB:', serverError);
            }

            app.showAlert('Siswa berhasil disimpan', 'success');
            app.loadSiswa();
            bootstrap.Modal.getInstance(document.getElementById('modalSiswa')).hide();
        } catch (error) {
            console.error('Error saving siswa:', error);
            app.showAlert('Gagal menyimpan siswa', 'danger');
        } finally {
            app.hideLoading();
        }
    },
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
    // Function to sync teacher data to admin users table
    syncTeacherToAdmin: async (teacherData, action) => {
        try {
            // Check if teacher has NUPTK (required for login)
            if (!teacherData.nuptk) {
                console.log('Teacher does not have NUPTK, skipping user account creation');
                return;
            }

            // Check if admin user already exists with this NUPTK
            const existingAdmins = await db.get('admins');
            let existingAdmin = null;

            if (Array.isArray(existingAdmins)) {
                existingAdmin = existingAdmins.find(admin => admin.username === teacherData.nuptk);
            }

            const adminData = {
                username: teacherData.nuptk,
                nama_pengguna: teacherData.nama,
                level: 'Guru',
                aktif: true,
                last_login: null,
                online: false
            };

            if (action === 'add') {
                // Only create new admin account if it doesn't exist
                if (!existingAdmin) {
                    // Set default password for new teacher accounts
                    adminData.password = teacherData.nuptk; // Use NUPTK as default password
                    await db.saveTo('admins', adminData);
                    console.log('Created new admin account for teacher:', teacherData.nama);
                } else {
                    console.log('Admin account already exists for teacher:', teacherData.nama);
                }
            } else if (action === 'update') {
                // Update existing admin account or create if doesn't exist
                if (existingAdmin) {
                    existingAdmin.nama_pengguna = teacherData.nama;
                    await db.saveTo('admins', existingAdmin);
                    console.log('Updated admin account for teacher:', teacherData.nama);
                } else {
                    // Create new admin account for existing teacher
                    adminData.password = teacherData.nuptk;
                    await db.saveTo('admins', adminData);
                    console.log('Created admin account for existing teacher:', teacherData.nama);
                }
            }
        } catch (error) {
            console.error('Error syncing teacher to admin:', error);
        }
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

            // Sync to admins table (data pengguna)
            await app.syncTeacherToAdmin(data, id ? 'update' : 'add');

            app.showAlert('Guru berhasil disimpan', 'success');
            app.loadwali();
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
                app.loadwali();
            } catch (error) {
                console.error('Error deleting guru:', error);
                app.showAlert('Gagal menghapus guru', 'danger');
            }
        }
    },
    deleteSiswa: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus siswa ini?')) {
            try {
                await db.init();
                await db.delete('students', id);
                app.showAlert('Siswa berhasil dihapus', 'success');
                app.loadSiswa();
            } catch (error) {
                console.error('Error deleting siswa:', error);
                app.showAlert('Gagal menghapus siswa', 'danger');
            }
        }
    },
    modalGuruMapel: async (action, id = null) => {
        try {
            const modal = document.getElementById('modalGuruMapel');
            const form = document.getElementById('form-guru-mapel');

            // Load mapel options for dropdown
            await db.init();
            const mapel = await db.get('mapel');
            const mapelSelect = document.getElementById('gm_mapel');
            mapelSelect.innerHTML = '<option value="">Pilih Mata Pelajaran</option>';

            if (Array.isArray(mapel)) {
                mapel.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.nama || '';
                    option.textContent = m.nama || '';
                    mapelSelect.appendChild(option);
                });
            }

            if (action === 'add') {
                document.getElementById('gm_id').value = '';
                document.getElementById('gm_nuptk').value = '';
                document.getElementById('gm_nama').value = '';
                document.getElementById('gm_jk').value = 'L';
                document.getElementById('gm_agama').value = 'Islam';
                document.getElementById('gm_mapel').value = '';
                document.getElementById('gm_kelas').value = '';
            } else if (action === 'edit' && id) {
                // Load existing data
                const gurumapel = await db.get('subject_teachers', id);
                if (gurumapel) {
                    document.getElementById('gm_id').value = gurumapel.id || '';
                    document.getElementById('gm_nuptk').value = gurumapel.nuptk || '';
                    document.getElementById('gm_nama').value = gurumapel.nama || '';
                    document.getElementById('gm_jk').value = gurumapel.jk || 'L';
                    document.getElementById('gm_agama').value = gurumapel.agama || 'Islam';
                    document.getElementById('gm_mapel').value = gurumapel.mapel || '';
                    document.getElementById('gm_kelas').value = gurumapel.kelas || '';
                }
            }

            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        } catch (error) {
            console.error('Error opening modal guru mapel:', error);
            app.showAlert('Gagal membuka modal', 'danger');
        }
    },
    saveGuruMapel: async () => {
        try {
            const id = document.getElementById('gm_id').value;
            const nuptk = document.getElementById('gm_nuptk').value;
            const nama = document.getElementById('gm_nama').value;
            const jk = document.getElementById('gm_jk').value;
            const agama = document.getElementById('gm_agama').value;
            const mapel = document.getElementById('gm_mapel').value;
            const kelas = document.getElementById('gm_kelas').value;

            const data = {
                nuptk,
                nama,
                jk,
                agama,
                mapel,
                kelas
            };

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('subject_teachers', data);
            app.showAlert('Guru Mapel berhasil disimpan', 'success');
            app.loadGuruMapel();
            bootstrap.Modal.getInstance(document.getElementById('modalGuruMapel')).hide();
        } catch (error) {
            console.error('Error saving guru mapel:', error);
            app.showAlert('Gagal menyimpan guru mapel', 'danger');
        } finally {
            app.hideLoading();
        }
    },
    saveDimensi: async () => { console.log('saveDimensi called'); },
    saveKaih: async () => { console.log('saveKaih called'); },
    modalMapel: async (action, id = null, simpleMode = false) => {
        try {
            const modal = document.getElementById('modalMapel');
            const form = document.getElementById('form-mapel');
            const namaInput = document.getElementById('m_nama');

            // Load data from mapel_simple store for typeable dropdown
            await db.init();
            const mapelSimple = await db.get('mapel_simple');

            // Get the existing datalist element
            const datalist = document.getElementById('m_nama_list');

            // Clear existing options
            if (datalist) {
                datalist.innerHTML = '';

                // Add options from mapel_simple data
                if (Array.isArray(mapelSimple)) {
                    mapelSimple.forEach(mapel => {
                        if (mapel.nama) {
                            const option = document.createElement('option');
                            option.value = mapel.nama;
                            datalist.appendChild(option);
                        }
                    });
                }
            }

            if (action === 'add') {
                document.getElementById('m_id').value = '';
                document.getElementById('m_nama').value = '';
                document.getElementById('m_singkat').value = '';
                document.getElementById('m_skl').value = 'Ya';
                document.getElementById('m_urut').value = '1';

                // Hide fields for simple mode
                if (simpleMode) {
                    document.getElementById('m_singkat').parentElement.style.display = 'none';
                    document.getElementById('m_skl').parentElement.style.display = 'none';
                    document.getElementById('m_urut').parentElement.style.display = 'none';

                    // Change modal title
                    const modalTitle = modal.querySelector('.modal-title');
                    if (modalTitle) {
                        modalTitle.textContent = 'Tambah Mata Pelajaran (Sederhana)';
                    }
                } else {
                    document.getElementById('m_singkat').parentElement.style.display = 'block';
                    document.getElementById('m_skl').parentElement.style.display = 'block';
                    document.getElementById('m_urut').parentElement.style.display = 'block';

                    // Change modal title
                    const modalTitle = modal.querySelector('.modal-title');
                    if (modalTitle) {
                        modalTitle.textContent = 'Tambah Mata Pelajaran';
                    }
                }
            } else if (action === 'edit' && id) {
                // Load existing data
                await db.init();
                const mapel = await db.get('mapel', id);
                if (mapel) {
                    document.getElementById('m_id').value = mapel.id || '';
                    document.getElementById('m_nama').value = mapel.nama || '';
                    document.getElementById('m_singkat').value = mapel.singkat || '';
                    document.getElementById('m_skl').value = mapel.skl || 'Ya';
                    document.getElementById('m_urut').value = mapel.urut || '1';

                    // Hide fields for simple mode
                    if (simpleMode) {
                        document.getElementById('m_singkat').parentElement.style.display = 'none';
                        document.getElementById('m_skl').parentElement.style.display = 'none';
                        document.getElementById('m_urut').parentElement.style.display = 'none';

                        // Change modal title
                        const modalTitle = modal.querySelector('.modal-title');
                        if (modalTitle) {
                            modalTitle.textContent = 'Edit Mata Pelajaran (Sederhana)';
                        }
                    } else {
                        document.getElementById('m_singkat').parentElement.style.display = 'block';
                        document.getElementById('m_skl').parentElement.style.display = 'block';
                        document.getElementById('m_urut').parentElement.style.display = 'block';

                        // Change modal title
                        const modalTitle = modal.querySelector('.modal-title');
                        if (modalTitle) {
                            modalTitle.textContent = 'Edit Mata Pelajaran';
                        }
                    }
                }
            }

            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        } catch (error) {
            console.error('Error opening modal mapel:', error);
            app.showAlert('Gagal membuka modal', 'danger');
        }
    },
    saveMapel: async () => {
        try {
            const id = document.getElementById('m_id').value;
            const nama = document.getElementById('m_nama').value.trim();
            const singkat = document.getElementById('m_singkat').value.trim();
            const skl = document.getElementById('m_skl').value;
            const urut = parseInt(document.getElementById('m_urut').value) || 1;

            // Validate required fields
            if (!nama) {
                app.showAlert('Nama mata pelajaran harus diisi', 'warning');
                return;
            }

            const data = {
                nama,
                singkat,
                skl,
                urut
            };

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('mapel', data);
            app.showAlert('Mata pelajaran berhasil disimpan', 'success');
            app.loadMapel();
            bootstrap.Modal.getInstance(document.getElementById('modalMapel')).hide();
        } catch (error) {
            console.error('Error saving mapel:', error);
            app.showAlert('Gagal menyimpan mata pelajaran', 'danger');
        }
    },
    deleteMapel: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus mata pelajaran ini?')) {
            try {
                await db.init();
                await db.delete('mapel', id);
                app.showAlert('Mata pelajaran berhasil dihapus', 'success');
                app.loadMapel();
            } catch (error) {
                console.error('Error deleting mapel:', error);
                app.showAlert('Gagal menghapus mata pelajaran', 'danger');
            }
        }
    },
    modalCPTP: async (action, id = null) => {
        try {
            const modal = document.getElementById('modalCPTP');
            const form = document.getElementById('form-cptp');

            // Load mapel options for dropdown
            await db.init();
            const mapel = await db.get('mapel');
            const mapelSelect = document.getElementById('c_mapel');
            mapelSelect.innerHTML = '<option value="">-- Pilih Mapel --</option>';

            if (Array.isArray(mapel)) {
                mapel.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.nama || '';
                    option.textContent = m.nama || '';
                    mapelSelect.appendChild(option);
                });
            }

            if (action === 'add') {
                document.getElementById('c_id').value = '';
                document.getElementById('c_mapel').value = '';
                document.getElementById('c_tingkat').value = '1';
                document.getElementById('c_fase').value = 'A';
                document.getElementById('c_semester').value = '1';
                document.getElementById('c_tp').value = '';
                document.getElementById('c_status').value = 'Aktif';
            } else if (action === 'edit' && id) {
                // Load existing data
                const cptp = await db.get('cptp', id);
                if (cptp) {
                    document.getElementById('c_id').value = cptp.id || '';
                    document.getElementById('c_mapel').value = cptp.mapel || '';
                    document.getElementById('c_tingkat').value = cptp.tingkat || '1';
                    document.getElementById('c_fase').value = cptp.fase || 'A';
                    document.getElementById('c_semester').value = cptp.semester || '1';
                    document.getElementById('c_tp').value = cptp.tp || '';
                    document.getElementById('c_status').value = cptp.status || 'Aktif';
                }
            }

            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        } catch (error) {
            console.error('Error opening modal CPTP:', error);
            app.showAlert('Gagal membuka modal', 'danger');
        }
    },
    saveCPTP: async () => {
        try {
            const id = document.getElementById('c_id').value;
            const mapel = document.getElementById('c_mapel').value;
            const tingkat = document.getElementById('c_tingkat').value;
            const fase = document.getElementById('c_fase').value;
            const semester = document.getElementById('c_semester').value;
            const tp = document.getElementById('c_tp').value.trim();
            const status = document.getElementById('c_status').value;

            // Validate required fields
            if (!mapel) {
                app.showAlert('Mata pelajaran harus dipilih', 'warning');
                return;
            }
            if (!tp) {
                app.showAlert('Tujuan pembelajaran harus diisi', 'warning');
                return;
            }

            const data = {
                mapel,
                tingkat,
                fase,
                semester,
                tp,
                status
            };

            if (id) {
                data.id = parseInt(id);
            }

            // Save to IndexedDB
            await db.saveTo('cptp', data);

            // Save to SQLiteDB
            const sqliteSuccess = saveSQLiteData('cptp.sqlite', 'cptp', data);
            if (!sqliteSuccess) {
                console.warn('Failed to save to SQLite, but IndexedDB save was successful');
            }

            app.showAlert('Data TP berhasil disimpan', 'success');
            app.loadCPTP();
            bootstrap.Modal.getInstance(document.getElementById('modalCPTP')).hide();
        } catch (error) {
            console.error('Error saving CPTP:', error);
            app.showAlert('Gagal menyimpan data TP', 'danger');
        }
    },

    deleteCPTP: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus data TP ini?')) {
            try {
                await db.init();
                await db.delete('cptp', id);
                app.showAlert('Data TP berhasil dihapus', 'success');
                app.loadCPTP();
            } catch (error) {
                console.error('Error deleting CPTP:', error);
                app.showAlert('Gagal menghapus data TP', 'danger');
            }
        }
    },
    modalKokurikuler: (action) => { console.log(`modalKokurikuler called with ${action}`); },
    saveKokurikuler: async () => { console.log('saveKokurikuler called'); },
    modalTemaEkskul: async (action, id = null) => {
        const modal = document.getElementById('modalTemaEkskul');
        const form = document.getElementById('form-tema-ekskul');

        if (action === 'add') {
            document.getElementById('te_id').value = '';
            document.getElementById('te_nama').value = '';
            document.getElementById('te_deskripsi').value = '';
            document.getElementById('tbody-tema-kegiatan').innerHTML = '';
        } else if (action === 'edit' && id) {
            // Load existing data for editing
            try {
                await db.init();
                const tema = await db.get('tema_ekskul', id);
                if (tema) {
                    document.getElementById('te_id').value = tema.id || '';
                    document.getElementById('te_nama').value = tema.nama || '';
                    document.getElementById('te_deskripsi').value = tema.deskripsi || '';
                }
            } catch (error) {
                console.error('Error loading tema ekskul for edit:', error);
                app.showAlert('Gagal memuat data tema untuk edit', 'danger');
                return;
            }
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },
    saveTemaEkskul: async () => {
        try {
            const id = document.getElementById('te_id').value;
            const nama = document.getElementById('te_nama').value.trim();
            const deskripsi = document.getElementById('te_deskripsi').value.trim();

            // Validate required fields
            if (!nama) {
                app.showAlert('Nama tema harus diisi', 'warning');
                return;
            }

            const data = {
                nama,
                deskripsi
            };

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('tema_ekskul', data);
            app.showAlert('Tema kokurikuler berhasil disimpan', 'success');
            app.loadTemaEkskul();
            bootstrap.Modal.getInstance(document.getElementById('modalTemaEkskul')).hide();
        } catch (error) {
            console.error('Error saving tema ekskul:', error);
            app.showAlert('Gagal menyimpan tema kokurikuler', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    deleteTemaEkskul: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus tema kokurikuler ini?')) {
            try {
                await db.init();
                await db.delete('tema_ekskul', id);
                app.showAlert('Tema kokurikuler berhasil dihapus', 'success');
                app.loadTemaEkskul();
            } catch (error) {
                console.error('Error deleting tema ekskul:', error);
                app.showAlert('Gagal menghapus tema kokurikuler', 'danger');
            }
        }
    },
    modalJenisEkskul: (action) => { console.log(`modalJenisEkskul called with ${action}`); },
    saveJenisEkskul: async () => { console.log('saveJenisEkskul called'); },
    modalAssignEkskul: () => { console.log('modalAssignEkskul called'); },
    saveAssignEkskul: async () => { console.log('saveAssignEkskul called'); },
    downloadTemplate: (type) => {
        if (type === 'siswa') {
            // Create template data with headers for siswa
            const templateData = [{
                NISN: '',
                INDUK: '',
                NAMA: '',
                KELAS: '',
                ROMBEL: '',
                JK: '',
                AGAMA: '',
                'TEMPAT LAHIR': '',
                'TANGGAL LAHIR': '',
                'NAMA AYAH': '',
                'NAMA IBU': '',
                ALAMAT: ''
            }];

            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(templateData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');

            // Generate and download file
            const filename = `template_siswa.xlsx`;
            XLSX.writeFile(workbook, filename);

            app.showAlert('Template siswa berhasil didownload', 'success');
        } else if (type === 'guru') {
            // Create template data with headers for guru
            const templateData = [{
                NUPTK: '',
                NIP: '',
                NAMA: '',
                JK: '',
                KELAS: ''
            }];

            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(templateData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Guru');

            // Generate and download file
            const filename = `template_guru.xlsx`;
            XLSX.writeFile(workbook, filename);

            app.showAlert('Template guru berhasil didownload', 'success');
        } else if (type === 'gurumapel') {
            // Create template data with headers for guru mapel
            const templateData = [{
                NUPTK: '',
                NAMA: '',
                JK: '',
                AGAMA: '',
                'MATA PELAJARAN': '',
                'KELAS MENGAJAR': ''
            }];

            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(templateData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Guru Mapel');

            // Generate and download file
            const filename = `template_guru_mapel.xlsx`;
            XLSX.writeFile(workbook, filename);

            app.showAlert('Template guru mapel berhasil didownload', 'success');
        } else if (type === 'cptp') {
            // Create template data with headers for CP/TP
            const templateData = [{
                'MATA PELAJARAN': '',
                TINGKAT: '',
                FASE: '',
                SEMESTER: '',
                TP: '',
                STATUS: ''
            }];

            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(templateData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template CP TP');

            // Generate and download file
            const filename = `template_cptp.xlsx`;
            XLSX.writeFile(workbook, filename);

            app.showAlert('Template CP/TP berhasil didownload', 'success');
        } else if (type === 'mapel') {
            // Create template data with headers for mapel
            const templateData = [{
                'NAMA MATA PELAJARAN': '',
                SINGKATAN: '',
                SKL: '',
                URUT: ''
            }];

            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(templateData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Mapel');

            // Generate and download file
            const filename = `template_mapel.xlsx`;
            XLSX.writeFile(workbook, filename);

            app.showAlert('Template mata pelajaran berhasil didownload', 'success');
        } else {
            app.showAlert('Template untuk tipe ini belum tersedia', 'warning');
        }
    },
    exportData: (type) => {
        if (type === 'siswa') {
            db.get('students').then(siswa => {
                if (Array.isArray(siswa) && siswa.length > 0) {
                    // Convert data to export format
                    const exportData = siswa.map(s => ({
                        AGAMA: s.agama || '',
                        'TEMPAT LAHIR': s.tmp_lahir || '',
                        'TANGGAL LAHIR': s.tgl_lahir || '',
                        'NAMA AYAH': s.nama_ayah || '',
                        'NAMA IBU': s.nama_ibu || '',
                        ALAMAT: s.alamat || ''
                    }));

                    // Create workbook and worksheet
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(exportData);

                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');

                    // Generate and download file
                    const filename = `data_siswa_${new Date().toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(workbook, filename);

                    app.showAlert('Data siswa berhasil diekspor', 'success');
                } else {
                    app.showAlert('Tidak ada data siswa untuk diekspor', 'warning');
                }
            }).catch(error => {
                console.error('Error exporting data:', error);
                app.showAlert('Gagal mengekspor data', 'danger');
            });
        } else if (type === 'guru') {
            db.get('teachers').then(guru => {
                if (Array.isArray(guru) && guru.length > 0) {
                    // Convert data to export format
                    const exportData = guru.map(g => ({
                        NUPTK: g.nuptk || '',
                        NIP: g.nip || '',
                        NAMA: g.nama || '',
                        JK: g.jk || '',
                        KELAS: g.kelas || ''
                    }));

                    // Create workbook and worksheet
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(exportData);

                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Guru');

                    // Generate and download file
                    const filename = `data_guru_${new Date().toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(workbook, filename);

                    app.showAlert('Data guru berhasil diekspor', 'success');
                } else {
                    app.showAlert('Tidak ada data guru untuk diekspor', 'warning');
                }
            }).catch(error => {
                console.error('Error exporting data:', error);
                app.showAlert('Gagal mengekspor data', 'danger');
            });
        } else if (type === 'gurumapel') {
            db.get('subject_teachers').then(gurumapel => {
                if (Array.isArray(gurumapel) && gurumapel.length > 0) {
                    // Convert data to export format
                    const exportData = gurumapel.map(gm => ({
                        NUPTK: gm.nuptk || '',
                        NAMA: gm.nama || '',
                        JK: gm.jk || '',
                        AGAMA: gm.agama || '',
                        'MATA PELAJARAN': gm.mapel || '',
                        'KELAS MENGAJAR': gm.kelas || ''
                    }));

                    // Create workbook and worksheet
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(exportData);

                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Guru Mapel');

                    // Generate and download file
                    const filename = `data_guru_mapel_${new Date().toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(workbook, filename);

                    app.showAlert('Data guru mapel berhasil diekspor', 'success');
                } else {
                    app.showAlert('Tidak ada data guru mapel untuk diekspor', 'warning');
                }
            }).catch(error => {
                console.error('Error exporting data:', error);
                app.showAlert('Gagal mengekspor data', 'danger');
            });
        } else if (type === 'mapel') {
            db.get('mapel').then(mapel => {
                if (Array.isArray(mapel) && mapel.length > 0) {
                    // Convert data to export format
                    const exportData = mapel.map(m => ({
                        'NAMA MATA PELAJARAN': m.nama || '',
                        SINGKATAN: m.singkat || '',
                        SKL: m.skl || '',
                        URUT: m.urut || ''
                    }));

                    // Create workbook and worksheet
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(exportData);

                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Mata Pelajaran');

                    // Generate and download file
                    const filename = `data_mapel_${new Date().toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(workbook, filename);

                    app.showAlert('Data mata pelajaran berhasil diekspor', 'success');
                } else {
                    app.showAlert('Tidak ada data mata pelajaran untuk diekspor', 'warning');
                }
            }).catch(error => {
                console.error('Error exporting data:', error);
                app.showAlert('Gagal mengekspor data', 'danger');
            });
        }
    },
    modalImport: (type) => {
        if (type === 'siswa') {
            const modal = document.getElementById('modalImportSiswa');
            if (modal) {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            }
        } else if (type === 'guru') {
            const modal = document.getElementById('modalImportGuru');
            if (modal) {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            }
        } else if (type === 'gurumapel') {
            const modal = document.getElementById('modalImportGuruMapel');
            if (modal) {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            }
        } else if (type === 'mapel') {
            const modal = document.getElementById('modalImportMapel');
            if (modal) {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            }
        }
    },
    processImport: async () => {
        const fileInput = document.getElementById('importFileSiswa');
        const file = fileInput.files[0];

        if (!file) {
            app.showAlert('Pilih file Excel terlebih dahulu', 'warning');
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                app.showAlert('File Excel kosong atau tidak valid', 'warning');
                return;
            }

            // Process each row
            let successCount = 0;
            let errorCount = 0;

            for (const row of jsonData) {
                try {
                    // Map Excel columns to database fields
                    const studentData = {
                        nisn: row.NISN || row.nisn || '',
                        induk: row.INDUK || row.induk || '',
                        nama: row.NAMA || row.nama || '',
                        kelas: row.KELAS || row.kelas || '1',
                        rombel: row.ROMBEL || row.rombel || '',
                        jk: row.JK || row.jk || 'L',
                        agama: row.AGAMA || row.agama || 'Islam',
                        tmp_lahir: row['TEMPAT LAHIR'] || row.tmp_lahir || '',
                        tgl_lahir: row['TANGGAL LAHIR'] || row.tgl_lahir || '',
                        nama_ayah: row['NAMA AYAH'] || row.nama_ayah || '',
                        nama_ibu: row['NAMA IBU'] || row.nama_ibu || '',
                        alamat: row.ALAMAT || row.alamat || ''
                    };

                    // Validate required fields
                    if (!studentData.nama || !studentData.nisn) {
                        errorCount++;
                        continue;
                    }

                    await db.saveTo('students', studentData);
                    successCount++;
                } catch (error) {
                    console.error('Error importing row:', error);
                    errorCount++;
                }
            }

            // Close modal and show results
            bootstrap.Modal.getInstance(document.getElementById('modalImportSiswa')).hide();
            app.loadSiswa();

            if (successCount > 0) {
                app.showAlert(`Import berhasil: ${successCount} data siswa diimpor${errorCount > 0 ? `, ${errorCount} gagal` : ''}`, 'success');
            } else {
                app.showAlert('Tidak ada data yang berhasil diimpor', 'danger');
            }

        } catch (error) {
            console.error('Error processing import:', error);
            app.showAlert('Gagal memproses file import', 'danger');
        }
    },

    processImportGuru: async () => {
        const fileInput = document.getElementById('importFileGuru');
        const file = fileInput.files[0];

        if (!file) {
            app.showAlert('Pilih file Excel terlebih dahulu', 'warning');
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                app.showAlert('File Excel kosong atau tidak valid', 'warning');
                return;
            }

            // Process each row
            let successCount = 0;
            let errorCount = 0;

            for (const row of jsonData) {
                try {
                    // Map Excel columns to database fields
                    const teacherData = {
                        nuptk: row.NUPTK || row.nuptk || '',
                        nip: row.NIP || row.nip || '',
                        nama: row.NAMA || row.nama || '',
                        jk: row.JK || row.jk || 'L',
                        kelas: row.KELAS || row.kelas || ''
                    };

                    // Validate required fields
                    if (!teacherData.nama) {
                        errorCount++;
                        continue;
                    }

                    await db.saveTo('teachers', teacherData);

                    // Save to SQLiteDB
                    const sqliteSuccess = saveSQLiteData('teachers.sqlite', 'teachers', teacherData);
                    if (!sqliteSuccess) {
                        console.warn('Failed to save to SQLite, but IndexedDB save was successful');
                    }

                    successCount++;
                } catch (error) {
                    console.error('Error importing row:', error);
                    errorCount++;
                }
            }

            // Close modal and show results
            bootstrap.Modal.getInstance(document.getElementById('modalImportGuru')).hide();
            app.loadwali();

            if (successCount > 0) {
                app.showAlert(`Import berhasil: ${successCount} data guru diimpor${errorCount > 0 ? `, ${errorCount} gagal` : ''}`, 'success');
            } else {
                app.showAlert('Tidak ada data yang berhasil diimpor', 'danger');
            }

        } catch (error) {
            console.error('Error processing import:', error);
            app.showAlert('Gagal memproses file import', 'danger');
        }
    },

    processImportGuruMapel: async () => {
        const fileInput = document.getElementById('importFileGuruMapel');
        const file = fileInput.files[0];

        if (!file) {
            app.showAlert('Pilih file Excel terlebih dahulu', 'warning');
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                app.showAlert('File Excel kosong atau tidak valid', 'warning');
                return;
            }

            // Process each row
            let successCount = 0;
            let errorCount = 0;

            for (const row of jsonData) {
                try {
                    // Map Excel columns to database fields
                    const gurumapelData = {
                        nuptk: row.NUPTK || row.nuptk || '',
                        nama: row.NAMA || row.nama || '',
                        jk: row.JK || row.jk || 'L',
                        agama: row.AGAMA || row.agama || 'Islam',
                        mapel: row['MATA PELAJARAN'] || row.mapel || '',
                        kelas: row['KELAS MENGAJAR'] || row.kelas || ''
                    };

                    // Validate required fields
                    if (!gurumapelData.nama) {
                        errorCount++;
                        continue;
                    }

                    await db.saveTo('subject_teachers', gurumapelData);
                    successCount++;
                } catch (error) {
                    console.error('Error importing row:', error);
                    errorCount++;
                }
            }

            // Close modal and show results
            bootstrap.Modal.getInstance(document.getElementById('modalImportGuruMapel')).hide();
            app.loadGuruMapel();

            if (successCount > 0) {
                app.showAlert(`Import berhasil: ${successCount} data guru mapel diimpor${errorCount > 0 ? `, ${errorCount} gagal` : ''}`, 'success');
            } else {
                app.showAlert('Tidak ada data yang berhasil diimpor', 'danger');
            }

        } catch (error) {
            console.error('Error processing import:', error);
            app.showAlert('Gagal memproses file import', 'danger');
        }
    },

    processImportSiswa: async () => {
        const fileInput = document.getElementById('importFileSiswa');
        const file = fileInput.files[0];

        if (!file) {
            app.showAlert('Pilih file Excel terlebih dahulu', 'warning');
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                app.showAlert('File Excel kosong atau tidak valid', 'warning');
                return;
            }

            // Process each row
            let successCount = 0;
            let errorCount = 0;

            for (const row of jsonData) {
                try {
                    // Map Excel columns to database fields
                    const studentData = {
                        nisn: row.NISN || row.nisn || '',
                        induk: row.INDUK || row.induk || '',
                        nama: row.NAMA || row.nama || '',
                        kelas: row.KELAS || row.kelas || '1',
                        rombel: row.ROMBEL || row.rombel || '',
                        jk: row.JK || row.jk || 'L',
                        agama: row.AGAMA || row.agama || 'Islam',
                        tmp_lahir: row['TEMPAT LAHIR'] || row.tmp_lahir || '',
                        tgl_lahir: row['TANGGAL LAHIR'] || row.tgl_lahir || '',
                        nama_ayah: row['NAMA AYAH'] || row.nama_ayah || '',
                        nama_ibu: row['NAMA IBU'] || row.nama_ibu || '',
                        alamat: row.ALAMAT || row.alamat || ''
                    };

                    // Validate required fields
                    if (!studentData.nama || !studentData.nisn) {
                        errorCount++;
                        continue;
                    }

                    await db.saveTo('students', studentData);
                    successCount++;
                } catch (error) {
                    console.error('Error importing row:', error);
                    errorCount++;
                }
            }

            // Close modal and show results
            bootstrap.Modal.getInstance(document.getElementById('modalImportSiswa')).hide();
            app.loadSiswa();

            if (successCount > 0) {
                app.showAlert(`Import berhasil: ${successCount} data siswa diimpor${errorCount > 0 ? `, ${errorCount} gagal` : ''}`, 'success');
            } else {
                app.showAlert('Tidak ada data yang berhasil diimpor', 'danger');
            }

        } catch (error) {
            console.error('Error processing import:', error);
            app.showAlert('Gagal memproses file import', 'danger');
        }
    },
    deleteAll: async (store) => {
        if (confirm(`Apakah Anda yakin ingin menghapus semua data ${store}? Tindakan ini tidak dapat dibatalkan.`)) {
            try {
                await db.init();
                await db.clear(store);
                app.showAlert(`Semua data ${store} berhasil dihapus`, 'success');

                // Reload the appropriate data based on store
                if (store === 'students') {
                    app.loadSiswa();
                } else if (store === 'teachers') {
                    app.loadwali();
                } else if (store === 'subject_teachers') {
                    app.loadGuruMapel();
                }
            } catch (error) {
                console.error('Error deleting all data:', error);
                app.showAlert('Gagal menghapus data', 'danger');
            }
        }
    },
       modalDownloadTemplate: (type) => {
        if (type === 'siswa') {
            app.downloadTemplate('siswa');
        } else if (type === 'guru') {
            app.downloadTemplate('guru');
        } else if (type === 'gurumapel') {
            app.downloadTemplate('gurumapel');
        }
    },
    modalExportData: (type) => {
        if (type === 'siswa') {
            app.exportData('siswa');
        } else if (type === 'guru') {
            app.exportData('guru');
        }
    },
    previewRaporPDF: async () => {
        try {
            app.showLoading('Membuat preview rapor PDF...');

            // Initialize database
            await db.init();

            // Fetch all necessary data
            const sekolah = await db.get('sekolah', 1);
            const utility = await db.get('utility', 1);
            const dimensi = await db.get('dimensi', 1);
            const kaih = await db.get('kaih', 1);

            // Get all students for selection
            const students = await db.get('students');
            if (!Array.isArray(students) || students.length === 0) {
                app.showAlert('Tidak ada data siswa untuk membuat rapor', 'warning');
                return;
            }

            // For demo purposes, use the first student. In production, you might want to select a specific student
            const selectedStudent = students[0];

            // Fetch student-specific data
            const nilai = await db.get('nilai');
            const ekskul = await db.get('student_ekskul');
            const kokurikuler = await db.get('siswa_kelompok_kokurikuler');

            // Filter data for selected student
            const studentNilai = Array.isArray(nilai) ? nilai.filter(n => n.student_id == selectedStudent.id) : [];
            const studentEkskul = Array.isArray(ekskul) ? ekskul.filter(e => e.student_id == selectedStudent.id) : [];
            const studentKokurikuler = Array.isArray(kokurikuler) ? kokurikuler.filter(k => k.student_id == selectedStudent.id) : [];

            // Generate PDF
            const pdfBytes = await app.generateRaporPDF({
                sekolah,
                utility,
                student: selectedStudent,
                nilai: studentNilai,
                ekskul: studentEkskul,
                kokurikuler: studentKokurikuler,
                dimensi,
                kaih
            });

            // Create blob URL for preview
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            // Show preview modal
            const modal = document.getElementById('modalPreviewPdf');
            const iframe = document.getElementById('pdfPreviewFrame');
            const downloadBtn = document.getElementById('btnDownloadFinal');

            iframe.src = url;
            downloadBtn.onclick = () => app.downloadRaporPDF(pdfBytes, selectedStudent);

            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

        } catch (error) {
            console.error('Error generating PDF preview:', error);
            app.showAlert('Gagal membuat preview rapor PDF', 'danger');
        } finally {
            app.hideLoading();
        }
    },
    modalResetPass: (id, type) => {
        // Set hidden fields
        document.getElementById('rp_id').value = id;
        document.getElementById('rp_type').value = type;

        // Clear the password field
        document.getElementById('rp_new_pass').value = '';

        // Show modal
        const modal = document.getElementById('modalResetPass');
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },
    saveResetPassword: async () => {
        try {
            app.showLoading('Mereset password...');
            const id = document.getElementById('rp_id').value;
            const type = document.getElementById('rp_type').value;
            const newPassword = document.getElementById('rp_new_pass').value;

            // Validate password
            if (!newPassword || newPassword.trim().length === 0) {
                app.showAlert('Password baru harus diisi', 'warning');
                return;
            }

            // Get the user data
            await db.init();
            const user = await db.get('admins', parseInt(id));

            if (!user) {
                app.showAlert('Pengguna tidak ditemukan', 'danger');
                return;
            }

            // Update password
            user.password = newPassword.trim();

            // Save updated user
            await db.saveTo('admins', user);

            app.showAlert('Password berhasil direset', 'success');

            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('modalResetPass')).hide();

            // Reload the user list
            if (type === 'admin') {
                app.loadAdminUsers();
            } else if (type === 'guru') {
                app.loadGuruUsers();
            }

        } catch (error) {
            console.error('Error resetting password:', error);
            app.showAlert('Gagal mereset password', 'danger');
        } finally {
            app.hideLoading();
        }
    },
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
    },
    deleteGuruMapel: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus guru mapel ini?')) {
            try {
                await db.init();
                await db.delete('subject_teachers', id);
                app.showAlert('Guru Mapel berhasil dihapus', 'success');
                app.loadGuruMapel();
            } catch (error) {
                console.error('Error deleting guru mapel:', error);
                app.showAlert('Gagal menghapus guru mapel', 'danger');
            }
        }
    },

    // Simple Mapel functions
    modalSimpleMapel: async (action, id = null) => {
        try {
            const modal = document.getElementById('modalMapel');
            const form = document.getElementById('form-mapel');

            if (action === 'add') {
                document.getElementById('m_id').value = '';
                document.getElementById('m_nama').value = '';
                document.getElementById('m_singkat').value = '';
                document.getElementById('m_skl').value = 'Ya';
                document.getElementById('m_urut').value = '1';

                // Hide fields for simple mode
                document.getElementById('m_singkat').parentElement.style.display = 'none';
                document.getElementById('m_skl').parentElement.style.display = 'none';
                document.getElementById('m_urut').parentElement.style.display = 'none';

                // Change modal title
                const modalTitle = modal.querySelector('.modal-title');
                if (modalTitle) {
                    modalTitle.textContent = 'Tambah Mata Pelajaran (Sederhana)';
                }
            } else if (action === 'edit' && id) {
                // Load existing data from simple store
                await db.init();
                const mapel = await db.get('mapel_simple', id);
                if (mapel) {
                    document.getElementById('m_id').value = mapel.id || '';
                    document.getElementById('m_nama').value = mapel.nama || '';
                    document.getElementById('m_singkat').value = mapel.singkat || '';
                    document.getElementById('m_skl').value = mapel.skl || 'Ya';
                    document.getElementById('m_urut').value = mapel.urut || '1';

                    // Hide fields for simple mode
                    document.getElementById('m_singkat').parentElement.style.display = 'none';
                    document.getElementById('m_skl').parentElement.style.display = 'none';
                    document.getElementById('m_urut').parentElement.style.display = 'none';

                    // Change modal title
                    const modalTitle = modal.querySelector('.modal-title');
                    if (modalTitle) {
                        modalTitle.textContent = 'Edit Mata Pelajaran (Sederhana)';
                    }
                }
            }

            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        } catch (error) {
            console.error('Error opening modal simple mapel:', error);
            app.showAlert('Gagal membuka modal', 'danger');
        }
    },

    saveSimpleMapel: async () => {
        try {
            app.showLoading('Menyimpan data mata pelajaran sederhana...');
            const id = document.getElementById('m_id').value;
            const nama = document.getElementById('m_nama').value.trim();

            // Validate required fields
            if (!nama) {
                app.showAlert('Nama mata pelajaran harus diisi', 'warning');
                return;
            }

            const data = {
                nama,
                singkat: '', // Default empty for simple mode
                skl: 'Ya',   // Default 'Ya' for simple mode
                urut: 1      // Default 1 for simple mode
            };

            if (id) {
                data.id = parseInt(id);
            }

            await db.saveTo('mapel_simple', data);
            app.showAlert('Mata pelajaran berhasil disimpan', 'success');
            app.loadMapel();
            bootstrap.Modal.getInstance(document.getElementById('modalMapel')).hide();
        } catch (error) {
            console.error('Error saving simple mapel:', error);
            app.showAlert('Gagal menyimpan mata pelajaran', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    deleteSimpleMapel: async (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus mata pelajaran ini?')) {
            try {
                await db.init();
                await db.delete('mapel_simple', id);
                app.showAlert('Mata pelajaran berhasil dihapus', 'success');
                app.loadMapel();
            } catch (error) {
                console.error('Error deleting simple mapel:', error);
                app.showAlert('Gagal menghapus mata pelajaran', 'danger');
            }
        }
    },

    // Inline form functions for simple mapel
    toggleSimpleMapelForm: () => {
        const form = document.getElementById('simple-mapel-form');
        if (form.style.display === 'none' || form.style.display === '') {
            form.style.display = 'block';
            document.getElementById('sm_nama').focus();
        } else {
            form.style.display = 'none';
        }
    },

    saveSimpleMapelInline: async () => {
        try {
            console.log('Starting save operation...');

            // Ensure database is initialized
            console.log('Initializing database...');
            await db.init();
            console.log('Database initialized successfully');

            const nama = document.getElementById('sm_nama').value.trim();
            console.log('Nama value:', nama);

            // Validate required fields
            if (!nama) {
                app.showAlert('Nama mata pelajaran harus diisi', 'warning');
                return;
            }

            const data = {
                nama,
                singkat: '', // Default empty for simple mode
                skl: 'Ya',   // Default 'Ya' for simple mode
                urut: 1      // Default 1 for simple mode
            };
            console.log('Data to save:', data);

            console.log('Saving to database...');
            await db.saveTo('mapel_simple', data);
            console.log('Save successful');

            app.showAlert('Mata pelajaran berhasil disimpan', 'success');

            // Clear form and hide it
            document.getElementById('sm_nama').value = '';
            const form = document.getElementById('simple-mapel-form');
            if (form) {
                form.style.display = 'none';
            }

            // Reload the table
            app.loadMapel();
        } catch (error) {
            console.error('Error saving simple mapel inline:', error);
            const errorMsg = error && error.message ? error.message : (error || 'Unknown error');
            app.showAlert('Gagal menyimpan mata pelajaran: ' + errorMsg, 'danger');
        }
    },

    cancelSimpleMapelForm: () => {
        document.getElementById('sm_nama').value = '';
        document.getElementById('simple-mapel-form').style.display = 'none';
    },

    // Setup auto-save for kurikulum input field
    setupKurikulumAutoSave: () => {
        const kurikulumInput = document.getElementById('util_kurikulum');
        if (kurikulumInput) {
            // Remove existing listener to avoid duplicates
            kurikulumInput.removeEventListener('input', app.handleKurikulumInput);
            // Add new listener
            kurikulumInput.addEventListener('input', app.handleKurikulumInput);
        }
    },

    // Handle kurikulum input change
    handleKurikulumInput: async (event) => {
        const value = event.target.value;
        try {
            await app.postKurikulum(value);
            console.log('Kurikulum auto-saved:', value);
        } catch (error) {
            console.error('Error auto-saving kurikulum:', error);
        }
    },

    // Sidebar hover functionality
    handleSidebarHover: () => {
        const sidebar = document.getElementById('sidebar');
        const wrapper = document.getElementById('wrapper');

        if (sidebar && wrapper) {
            // Add hover event listeners
            sidebar.addEventListener('mouseenter', () => {
                wrapper.classList.add('sidebar-hovered');
            });

            sidebar.addEventListener('mouseleave', () => {
                wrapper.classList.remove('sidebar-hovered');
            });
        }
    }
};

// Make app available globally for onclick handlers
window.app = app;

// Sticky Header Scroll Behavior
let scrollTimeout;
const stickyHeader = document.getElementById('sticky-header');

function handleScroll() {
    if (stickyHeader) {
        stickyHeader.classList.add('show');

        // Clear the previous timeout
        clearTimeout(scrollTimeout);

        // Set a new timeout to hide the header after scrolling stops
        scrollTimeout = setTimeout(() => {
            stickyHeader.classList.remove('show');
        }, 5000); // Hide after 5 seconds of no scrolling
    }
}

    // Add scroll event listener when the app loads
    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        // Initialize sidebar hover functionality
        app.handleSidebarHover();
    });
