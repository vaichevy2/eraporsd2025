const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 1180;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Basic route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'rapor.html'));
});

// Database file paths
const DB_PATHS = {
    students: path.join(__dirname, 'sqlite', 'students.sqlite'),
    teachers: path.join(__dirname, 'sqlite', 'teachers.sqlite'),
    subject_teachers: path.join(__dirname, 'sqlite', 'subject_teachers.sqlite'),
    mapel: path.join(__dirname, 'sqlite', 'mapel.sqlite'),
    nilai: path.join(__dirname, 'sqlite', 'nilai.sqlite'),
    sekolah: path.join(__dirname, 'sqlite', 'sekolah.sqlite'),
    utility: path.join(__dirname, 'sqlite', 'utility.sqlite'),
    admins: path.join(__dirname, 'sqlite', 'admins.sqlite')
};

// Initialize SQLite databases if they don't exist
function initDatabases() {
    const fs = require('fs');
    const initSql = require('sql.js');

    // Ensure sqlite directory exists
    if (!fs.existsSync(path.join(__dirname, 'sqlite'))) {
        fs.mkdirSync(path.join(__dirname, 'sqlite'));
    }

    // Initialize each database
    Object.keys(DB_PATHS).forEach(tableName => {
        const dbPath = DB_PATHS[tableName];
        if (!fs.existsSync(dbPath)) {
            console.log(`Creating database: ${tableName}`);
            const SQL = initSql();
            const db = new SQL.Database();

            // Create basic table structure
            let createTableSQL = '';
            switch(tableName) {
                case 'students':
                    createTableSQL = `
                        CREATE TABLE students (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            nisn TEXT,
                            induk TEXT,
                            nama TEXT,
                            kelas TEXT,
                            rombel TEXT,
                            jk TEXT,
                            agama TEXT,
                            tmp_lahir TEXT,
                            tgl_lahir TEXT,
                            nama_ayah TEXT,
                            nama_ibu TEXT,
                            alamat TEXT
                        )
                    `;
                    break;
                case 'teachers':
                    createTableSQL = `
                        CREATE TABLE teachers (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            nuptk TEXT,
                            nip TEXT,
                            nama TEXT,
                            jk TEXT,
                            kelas TEXT
                        )
                    `;
                    break;
                case 'subject_teachers':
                    createTableSQL = `
                        CREATE TABLE subject_teachers (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            nuptk TEXT,
                            nama TEXT,
                            jk TEXT,
                            agama TEXT,
                            mapel TEXT,
                            kelas TEXT
                        )
                    `;
                    break;
                case 'mapel':
                    createTableSQL = `
                        CREATE TABLE mapel (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            nama TEXT,
                            singkat TEXT,
                            skl TEXT,
                            urut INTEGER
                        )
                    `;
                    break;
                case 'nilai':
                    createTableSQL = `
                        CREATE TABLE nilai (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            student_id INTEGER,
                            mapel_id INTEGER,
                            nilai TEXT,
                            semester TEXT,
                            tahun_ajaran TEXT
                        )
                    `;
                    break;
                case 'sekolah':
                    createTableSQL = `
                        CREATE TABLE sekolah (
                            id INTEGER PRIMARY KEY,
                            nama TEXT,
                            npsn TEXT,
                            alamat TEXT,
                            kelurahan TEXT,
                            kecamatan TEXT,
                            kota TEXT,
                            provinsi TEXT,
                            email TEXT,
                            telp TEXT
                        )
                    `;
                    break;
                case 'utility':
                    createTableSQL = `
                        CREATE TABLE utility (
                            id INTEGER PRIMARY KEY,
                            kelas TEXT,
                            rombel TEXT,
                            fase TEXT,
                            semester TEXT,
                            jml_siswa TEXT,
                            tapel TEXT,
                            tanggal TEXT,
                            kepsek TEXT,
                            nip_kepsek TEXT,
                            guru TEXT,
                            nip_guru TEXT
                        )
                    `;
                    break;
                case 'admins':
                    createTableSQL = `
                        CREATE TABLE admins (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            username TEXT UNIQUE,
                            password TEXT,
                            nama_pengguna TEXT,
                            level TEXT,
                            aktif INTEGER DEFAULT 1,
                            last_login TEXT,
                            online INTEGER DEFAULT 0
                        )
                    `;
                    break;
            }

            if (createTableSQL) {
                db.run(createTableSQL);
                const data = db.export();
                const buffer = Buffer.from(data);
                fs.writeFileSync(dbPath, buffer);
                console.log(`Database ${tableName} created successfully`);
            }
        }
    });
}

// API Routes for Students
app.get('/api/students', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        if (!fs.existsSync(DB_PATHS.students)) {
            return res.json({ data: [] });
        }

        const filebuffer = fs.readFileSync(DB_PATHS.students);
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const result = db.exec("SELECT * FROM students ORDER BY nama");
        const data = result.length > 0 ? result[0].values.map(row => {
            const obj = {};
            result[0].columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        }) : [];

        res.json({ data });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch students data' });
    }
});

app.post('/api/students', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        const filebuffer = fs.existsSync(DB_PATHS.students) ?
            fs.readFileSync(DB_PATHS.students) : null;
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const { nisn, induk, nama, kelas, rombel, jk, agama, tmp_lahir, tgl_lahir, nama_ayah, nama_ibu, alamat } = req.body;

        const sql = `INSERT INTO students (nisn, induk, nama, kelas, rombel, jk, agama, tmp_lahir, tgl_lahir, nama_ayah, nama_ibu, alamat)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const stmt = db.prepare(sql);
        stmt.run([nisn, induk, nama, kelas, rombel, jk, agama, tmp_lahir, tgl_lahir, nama_ayah, nama_ibu, alamat]);

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATHS.students, buffer);

        res.json({ success: true, message: 'Student added successfully' });
    } catch (error) {
        console.error('Error saving student:', error);
        res.status(500).json({ error: 'Failed to save student data' });
    }
});

// API Routes for Teachers
app.get('/api/teachers', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        if (!fs.existsSync(DB_PATHS.teachers)) {
            return res.json({ data: [] });
        }

        const filebuffer = fs.readFileSync(DB_PATHS.teachers);
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const result = db.exec("SELECT * FROM teachers ORDER BY nama");
        const data = result.length > 0 ? result[0].values.map(row => {
            const obj = {};
            result[0].columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        }) : [];

        res.json({ data });
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ error: 'Failed to fetch teachers data' });
    }
});

app.post('/api/teachers', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        const filebuffer = fs.existsSync(DB_PATHS.teachers) ?
            fs.readFileSync(DB_PATHS.teachers) : null;
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const { nuptk, nip, nama, jk, kelas } = req.body;

        const sql = `INSERT INTO teachers (nuptk, nip, nama, jk, kelas) VALUES (?, ?, ?, ?, ?)`;
        const stmt = db.prepare(sql);
        stmt.run([nuptk, nip, nama, jk, kelas]);

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATHS.teachers, buffer);

        res.json({ success: true, message: 'Teacher added successfully' });
    } catch (error) {
        console.error('Error saving teacher:', error);
        res.status(500).json({ error: 'Failed to save teacher data' });
    }
});

// API Routes for Subject Teachers
app.get('/api/subject_teachers', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        if (!fs.existsSync(DB_PATHS.subject_teachers)) {
            return res.json({ data: [] });
        }

        const filebuffer = fs.readFileSync(DB_PATHS.subject_teachers);
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const result = db.exec("SELECT * FROM subject_teachers ORDER BY nama");
        const data = result.length > 0 ? result[0].values.map(row => {
            const obj = {};
            result[0].columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        }) : [];

        res.json({ data });
    } catch (error) {
        console.error('Error fetching subject teachers:', error);
        res.status(500).json({ error: 'Failed to fetch subject teachers data' });
    }
});

app.post('/api/subject_teachers', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        const filebuffer = fs.existsSync(DB_PATHS.subject_teachers) ?
            fs.readFileSync(DB_PATHS.subject_teachers) : null;
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const { nuptk, nama, jk, agama, mapel, kelas } = req.body;

        const sql = `INSERT INTO subject_teachers (nuptk, nama, jk, agama, mapel, kelas) VALUES (?, ?, ?, ?, ?, ?)`;
        const stmt = db.prepare(sql);
        stmt.run([nuptk, nama, jk, agama, mapel, kelas]);

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATHS.subject_teachers, buffer);

        res.json({ success: true, message: 'Subject teacher added successfully' });
    } catch (error) {
        console.error('Error saving subject teacher:', error);
        res.status(500).json({ error: 'Failed to save subject teacher data' });
    }
});

// API Routes for Mapel
app.get('/api/mapel', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        if (!fs.existsSync(DB_PATHS.mapel)) {
            return res.json({ data: [] });
        }

        const filebuffer = fs.readFileSync(DB_PATHS.mapel);
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const result = db.exec("SELECT * FROM mapel ORDER BY nama");
        const data = result.length > 0 ? result[0].values.map(row => {
            const obj = {};
            result[0].columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        }) : [];

        res.json({ data });
    } catch (error) {
        console.error('Error fetching mapel:', error);
        res.status(500).json({ error: 'Failed to fetch mapel data' });
    }
});

app.post('/api/mapel', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        const filebuffer = fs.existsSync(DB_PATHS.mapel) ?
            fs.readFileSync(DB_PATHS.mapel) : null;
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const { nama, singkat, skl, urut } = req.body;

        const sql = `INSERT INTO mapel (nama, singkat, skl, urut) VALUES (?, ?, ?, ?)`;
        const stmt = db.prepare(sql);
        stmt.run([nama, singkat, skl, urut]);

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATHS.mapel, buffer);

        res.json({ success: true, message: 'Mapel added successfully' });
    } catch (error) {
        console.error('Error saving mapel:', error);
        res.status(500).json({ error: 'Failed to save mapel data' });
    }
});

// API Routes for Sekolah
app.get('/api/sekolah', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        if (!fs.existsSync(DB_PATHS.sekolah)) {
            return res.json({ data: null });
        }

        const filebuffer = fs.readFileSync(DB_PATHS.sekolah);
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const result = db.exec("SELECT * FROM sekolah WHERE id = 1");
        const data = result.length > 0 && result[0].values.length > 0 ? (() => {
            const obj = {};
            result[0].columns.forEach((col, i) => {
                obj[col] = result[0].values[0][i];
            });
            return obj;
        })() : null;

        res.json({ data });
    } catch (error) {
        console.error('Error fetching sekolah:', error);
        res.status(500).json({ error: 'Failed to fetch sekolah data' });
    }
});

app.post('/api/sekolah', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        const filebuffer = fs.existsSync(DB_PATHS.sekolah) ?
            fs.readFileSync(DB_PATHS.sekolah) : null;
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const { nama, npsn, alamat, kelurahan, kecamatan, kota, provinsi, email, telp } = req.body;

        // Delete existing record
        db.run("DELETE FROM sekolah WHERE id = 1");

        const sql = `INSERT INTO sekolah (id, nama, npsn, alamat, kelurahan, kecamatan, kota, provinsi, email, telp)
                     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const stmt = db.prepare(sql);
        stmt.run([nama, npsn, alamat, kelurahan, kecamatan, kota, provinsi, email, telp]);

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATHS.sekolah, buffer);

        res.json({ success: true, message: 'Sekolah data saved successfully' });
    } catch (error) {
        console.error('Error saving sekolah:', error);
        res.status(500).json({ error: 'Failed to save sekolah data' });
    }
});

// API Routes for Utility
app.get('/api/utility', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        if (!fs.existsSync(DB_PATHS.utility)) {
            return res.json({ data: null });
        }

        const filebuffer = fs.readFileSync(DB_PATHS.utility);
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const result = db.exec("SELECT * FROM utility WHERE id = 1");
        const data = result.length > 0 && result[0].values.length > 0 ? (() => {
            const obj = {};
            result[0].columns.forEach((col, i) => {
                obj[col] = result[0].values[0][i];
            });
            return obj;
        })() : null;

        res.json({ data });
    } catch (error) {
        console.error('Error fetching utility:', error);
        res.status(500).json({ error: 'Failed to fetch utility data' });
    }
});

app.post('/api/utility', async (req, res) => {
    try {
        const fs = require('fs');
        const initSql = require('sql.js');

        const filebuffer = fs.existsSync(DB_PATHS.utility) ?
            fs.readFileSync(DB_PATHS.utility) : null;
        const SQL = initSql();
        const db = new SQL.Database(filebuffer);

        const { kelas, rombel, fase, semester, jml_siswa, tapel, tanggal, kepsek, nip_kepsek, guru, nip_guru } = req.body;

        // Delete existing record
        db.run("DELETE FROM utility WHERE id = 1");

        const sql = `INSERT INTO utility (id, kelas, rombel, fase, semester, jml_siswa, tapel, tanggal, kepsek, nip_kepsek, guru, nip_guru)
                     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const stmt = db.prepare(sql);
        stmt.run([kelas, rombel, fase, semester, jml_siswa, tapel, tanggal, kepsek, nip_kepsek, guru, nip_guru]);

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATHS.utility, buffer);

        res.json({ success: true, message: 'Utility data saved successfully' });
    } catch (error) {
        console.error('Error saving utility:', error);
        res.status(500).json({ error: 'Failed to save utility data' });
    }
});

// Initialize databases on server start
initDatabases();

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Memuat Aplikasi Rapor...');
    console.log('Mohon tunggu sebentar');
});
