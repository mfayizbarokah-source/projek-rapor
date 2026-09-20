/* =========================================================
   SIPRAPOR — Sistem Penilaian Rapor Siswa
   script.js — Seluruh logika frontend (Vanilla JavaScript ES6+)

   Arsitektur:
   1. STORAGE   : LocalStorage sebagai database sementara
   2. API LAYER : fungsi async siap diganti Fetch API (Django/Flask)
   3. AUTH      : login simulasi (siap diganti autentikasi backend)
   4. ROUTER    : navigasi antar halaman per role
   5. VIEWS     : render halaman Admin, Guru, Murid
   6. REAL-TIME : CustomEvent + Storage Event (siap diganti WebSocket)
========================================================= */

'use strict';

/* global Chart */ // dimuat via CDN Chart.js di index.html

/* ===================== KONSTANTA ===================== */
const DB_KEY = 'raporAppDB';
const SESSION_KEY = 'raporSession';
const THEME_KEY = 'raporTheme';
const REMEMBER_KEY = 'raporRemember';
const KKM = 75;

const SCHOOL = {
    name: 'SMA Negeri Nusantara',
    address: 'Jl. Pendidikan Raya No. 45, Jakarta Selatan',
    headmaster: 'Drs. H. Muhammad Yusuf, M.Pd.'
};

const SIKAP_OPTS = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'];
const PERKEMBANGAN_OPTS = ['Meningkat Pesat', 'Meningkat', 'Stabil', 'Menurun'];
const PREDIKAT_OPTS = ['A', 'B', 'C', 'D', 'E'];

/* ===================== UTILITAS ===================== */
const uid = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 10);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const round1 = (n) => Math.round(n * 10) / 10;

function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/* ===================== PERHITUNGAN NILAI ===================== */
// Nilai Akhir = Tugas 20% + Quiz 20% + UTS 25% + UAS 35%
function hitungNilaiAkhir(g) {
    if (!g) return null;
    const vals = [g.tugas, g.quiz, g.uts, g.uas];
    if (vals.some(v => v === null || v === undefined || v === '' || isNaN(v))) return null;
    return round1(g.tugas * 0.20 + g.quiz * 0.20 + g.uts * 0.25 + g.uas * 0.35);
}

function predikat(n) {
    if (n === null || n === undefined) return '-';
    if (n >= 90) return 'A';
    if (n >= 80) return 'B';
    if (n >= 70) return 'C';
    if (n >= 60) return 'D';
    return 'E';
}

function statusLulus(n) {
    if (n === null || n === undefined) return '-';
    return n >= KKM ? 'LULUS' : 'TIDAK LULUS';
}

function statusBadge(n) {
    if (n === null || n === undefined) return '<span class="badge badge-muted">-</span>';
    return n >= KKM
        ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> LULUS</span>'
        : '<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> TIDAK LULUS</span>';
}

function predikatBadge(p) {
    if (!p || p === '-') return '<span class="badge badge-muted">-</span>';
    return `<span class="predikat-badge predikat-${p}">${p}</span>`;
}

function persenKehadiran(a) {
    const total = (+a.hadir || 0) + (+a.sakit || 0) + (+a.izin || 0) + (+a.alpa || 0);
    if (!total) return 0;
    return round1((+a.hadir || 0) / total * 100);
}

function progressBar(pct) {
    const cls = pct >= 90 ? 'green' : pct >= 75 ? '' : pct >= 60 ? 'amber' : 'red';
    return `<div>
        <div class="progress"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
        <span class="progress-label">${pct}%</span>
    </div>`;
}

/* ===================== SEED DATA (DATA DUMMY) ===================== */
function seedData() {
    const subjects = [
        { id: 'mp1', nama: 'Matematika', kkm: 75 },
        { id: 'mp2', nama: 'Bahasa Indonesia', kkm: 75 },
        { id: 'mp3', nama: 'Bahasa Inggris', kkm: 75 },
        { id: 'mp4', nama: 'IPA Terpadu', kkm: 75 },
        { id: 'mp5', nama: 'IPS Terpadu', kkm: 75 }
    ];
    const classes = [
        { id: 'k1', nama: 'X-A', wali: 'Budi Santoso, S.Pd.' },
        { id: 'k2', nama: 'X-B', wali: 'Siti Rahmawati, S.Pd.' }
    ];
    const teachers = [
        { id: 't1', nama: 'Budi Santoso, S.Pd.', nip: '19850112 201001 1 001', mapel: 'Matematika' },
        { id: 't2', nama: 'Siti Rahmawati, S.Pd.', nip: '19880324 201203 2 004', mapel: 'Bahasa Indonesia' },
        { id: 't3', nama: 'Ahmad Hidayat, S.Pd.', nip: '19900217 201501 1 002', mapel: 'IPA Terpadu' }
    ];
    const names = [
        ['Andi Pratama', 'X-A', 'L'], ['Sinta Dewi', 'X-A', 'P'],
        ['Rizky Ramadhan', 'X-A', 'L'], ['Putri Ayu Lestari', 'X-A', 'P'],
        ['Dewa Kurniawan', 'X-B', 'L'], ['Maya Anjani', 'X-B', 'P'],
        ['Fajar Nugraha', 'X-B', 'L'], ['Laila Sari', 'X-B', 'P']
    ];
    const students = names.map((n, i) => ({
        id: 'st' + (i + 1), nama: n[0], nis: '2026' + String(i + 1).padStart(3, '0'), kelas: n[1], jk: n[2]
    }));

    // Nilai deterministik agar data konsisten
    const base = { st1: 88, st2: 76, st3: 92, st4: 65, st5: 81, st6: 71, st7: 58, st8: 85 };
    const jit = [0, 4, -6, 8, -3];
    const grades = [];
    students.forEach(s => {
        subjects.forEach((m, mi) => {
            const b = base[s.id] + jit[mi];
            const mk = (o) => Math.max(40, Math.min(100, b + o));
            grades.push({ id: `g_${s.id}_${m.id}_1`, studentId: s.id, subjectId: m.id, tahunAjaran: '2026/2027', semester: '1', tugas: mk(2), quiz: mk(-2), uts: mk(0), uas: mk(3) });
            grades.push({ id: `g_${s.id}_${m.id}_2`, studentId: s.id, subjectId: m.id, tahunAjaran: '2026/2027', semester: '2', tugas: mk(5), quiz: mk(1), uts: mk(4), uas: mk(6) });
        });
    });

    const attendance = students.map((s, i) => ({
        id: 'at_' + s.id, studentId: s.id, tahunAjaran: '2026/2027', semester: '1',
        hadir: 88 + (i % 4), sakit: i % 3, izin: i % 2, alpa: i % 2 === 0 ? 0 : 1
    }));

    const evaluations = [
        { id: 'ev1', studentId: 'st1', subjectId: 'mp1', guru: 'Budi Santoso, S.Pd.', sikap: 'Baik', kedisiplinan: 'Sangat Baik', keaktifan: 'Baik', tanggungJawab: 'Baik', perkembangan: 'Meningkat', evaluasi: 'Siswa menunjukkan kedisiplinan yang baik dalam mengikuti kegiatan pembelajaran. Siswa juga aktif dalam berdiskusi dan mengalami perkembangan yang cukup baik selama semester.', catatan: 'Pertahankan konsistensi belajar dan terus berlatih soal.' },
        { id: 'ev2', studentId: 'st1', subjectId: 'mp2', guru: 'Siti Rahmawati, S.Pd.', sikap: 'Sangat Baik', kedisiplinan: 'Baik', keaktifan: 'Sangat Baik', tanggungJawab: 'Baik', perkembangan: 'Meningkat Pesat', evaluasi: 'Siswa sangat aktif dalam kegiatan diskusi dan presentasi. Kemampuan berbahasa menunjukkan perkembangan yang pesat.', catatan: 'Perbanyak membaca literatur.' },
        { id: 'ev3', studentId: 'st1', subjectId: 'mp4', guru: 'Ahmad Hidayat, S.Pd.', sikap: 'Baik', kedisiplinan: 'Baik', keaktifan: 'Cukup', tanggungJawab: 'Baik', perkembangan: 'Stabil', evaluasi: 'Siswa memahami materi praktikum dengan baik, namun perlu lebih aktif bertanya saat pembelajaran teori.', catatan: '' },
        { id: 'ev4', studentId: 'st4', subjectId: 'mp1', guru: 'Budi Santoso, S.Pd.', sikap: 'Cukup', kedisiplinan: 'Cukup', keaktifan: 'Kurang', tanggungJawab: 'Cukup', perkembangan: 'Menurun', evaluasi: 'Siswa perlu bimbingan tambahan dalam memahami konsep dasar. Disarankan mengikuti remedial dan les tambahan.', catatan: 'Orang tua telah dihubungi.' }
    ];

    const ekskul = [
        { id: 'ek1', studentId: 'st1', nama: 'Basket', nilai: 'A', deskripsi: 'Sangat aktif, menjadi kapten tim basket sekolah.' },
        { id: 'ek2', studentId: 'st1', nama: 'Robotik', nilai: 'B', deskripsi: 'Mampu merakit robot line follower dengan baik.' },
        { id: 'ek3', studentId: 'st2', nama: 'Pramuka', nilai: 'A', deskripsi: 'Disiplin dan menjadi pemimpin regu.' },
        { id: 'ek4', studentId: 'st3', nama: 'KIR', nilai: 'A', deskripsi: 'Lolos seleksi olimpiade sains tingkat kota.' },
        { id: 'ek5', studentId: 'st5', nama: 'Futsal', nilai: 'B', deskripsi: 'Bermain konsisten sebagai gelandang.' }
    ];

    const ekskulMaster = ['Pramuka', 'PMR', 'Basket', 'Futsal', 'Voli', 'Paskibra', 'KIR', 'Robotik', 'Seni', 'Musik']
        .map((e, i) => ({ id: 'em' + (i + 1), nama: e, pembina: teachers[i % 3].nama }));

    const tahunAjaran = [
        { id: 'ta1', nama: '2025/2026', status: 'Nonaktif' },
        { id: 'ta2', nama: '2026/2027', status: 'Aktif' }
    ];
    const semesters = [
        { id: 'sm1', nama: '1', status: 'Aktif' },
        { id: 'sm2', nama: '2', status: 'Aktif' }
    ];
    const users = [
        { id: 'u1', username: 'admin', password: 'admin123', role: 'admin', nama: 'Administrator' },
        { id: 'u2', username: 'guru', password: 'guru123', role: 'guru', nama: 'Budi Santoso, S.Pd.', refId: 't1' },
        { id: 'u3', username: 'murid', password: 'murid123', role: 'murid', nama: 'Andi Pratama', refId: 'st1' }
    ];

    return { users, teachers, students, classes, subjects, tahunAjaran, semesters, grades, attendance, evaluations, ekskul, ekskulMaster };
}

/* ===================== STORAGE (LocalStorage) ===================== */
const DB = {
    data: null,
    load() {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) {
            this.data = JSON.parse(raw);
        } else {
            this.data = seedData();
            this.persist();
        }
    },
    persist() { localStorage.setItem(DB_KEY, JSON.stringify(this.data)); },
    save() {
        this.persist();
        // Event sinkronisasi real-time (siap diganti WebSocket / Django Channels)
        window.dispatchEvent(new CustomEvent('rapor:data-changed'));
    }
};

// Sinkronisasi lintas-tab: perubahan di tab Guru langsung tampil di tab Murid
window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY && e.newValue) {
        DB.data = JSON.parse(e.newValue);
        rerender();
    }
});
window.addEventListener('rapor:data-changed', () => rerender());

/* ===================== API LAYER =====================
   Semua fungsi di bawah ini memakai LocalStorage untuk prototype.
   Untuk integrasi backend Python (Django/Flask + PostgreSQL),
   ganti isi fungsi dengan Fetch API sesuai komentar endpoint. */

// API Django: GET /api/students/
async function getStudents() { return DB.data.students; }

// API Django: GET /api/teachers/
async function getTeachers() { return DB.data.teachers; }

// API Django: GET /api/grades/
async function getGrades() { return DB.data.grades; }

// API Django: POST /api/grades/
async function saveGrade(data) {
    const g = { id: uid('g'), ...data };
    DB.data.grades.push(g);
    DB.save();
    return g;
}

// API Django: PUT /api/grades/{id}/
async function updateGrade(id, data) {
    const i = DB.data.grades.findIndex(g => g.id === id);
    if (i > -1) { DB.data.grades[i] = { ...DB.data.grades[i], ...data }; DB.save(); }
}

// API Django: DELETE /api/grades/{id}/
async function deleteGrade(id) {
    DB.data.grades = DB.data.grades.filter(g => g.id !== id);
    DB.save();
}

// API Django: GET /api/attendance/
async function getAttendance() { return DB.data.attendance; }

// API Django: POST /api/attendance/  (juga dipakai untuk update/upsert)
async function saveAttendance(data) {
    const i = DB.data.attendance.findIndex(a =>
        a.studentId === data.studentId && a.tahunAjaran === data.tahunAjaran && a.semester === data.semester);
    if (i > -1) DB.data.attendance[i] = { ...DB.data.attendance[i], ...data };
    else DB.data.attendance.push({ id: uid('at'), ...data });
    DB.save();
}

// API Django: DELETE /api/attendance/{id}/
async function deleteAttendance(id) {
    DB.data.attendance = DB.data.attendance.filter(a => a.id !== id);
    DB.save();
}

// API Django: GET /api/evaluations/
async function getEvaluations() { return DB.data.evaluations; }

// API Django: POST /api/evaluations/
async function saveEvaluation(data) {
    if (data.id) {
        const i = DB.data.evaluations.findIndex(e => e.id === data.id);
        if (i > -1) DB.data.evaluations[i] = { ...DB.data.evaluations[i], ...data };
    } else {
        DB.data.evaluations.push({ id: uid('ev'), ...data });
    }
    DB.save();
}

// API Django: DELETE /api/evaluations/{id}/
async function deleteEvaluation(id) {
    DB.data.evaluations = DB.data.evaluations.filter(e => e.id !== id);
    DB.save();
}

// API Django: GET /api/extracurricular/
async function getExtracurricular() { return DB.data.ekskul; }

// API Django: POST /api/extracurricular/
async function saveExtracurricular(data) {
    if (data.id) {
        const i = DB.data.ekskul.findIndex(e => e.id === data.id);
        if (i > -1) DB.data.ekskul[i] = { ...DB.data.ekskul[i], ...data };
    } else {
        DB.data.ekskul.push({ id: uid('ek'), ...data });
    }
    DB.save();
}

// API Django: DELETE /api/extracurricular/{id}/
async function deleteExtracurricular(id) {
    DB.data.ekskul = DB.data.ekskul.filter(e => e.id !== id);
    DB.save();
}

// API generik master data — API Django: GET/POST/PUT/DELETE /api/{resource}/
async function addEntity(key, data) { DB.data[key].push({ id: uid(key), ...data }); DB.save(); }
async function updateEntity(key, id, data) {
    const arr = DB.data[key];
    const i = arr.findIndex(x => x.id === id);
    if (i > -1) { arr[i] = { ...arr[i], ...data }; DB.save(); }
}
async function deleteEntityById(key, id) {
    DB.data[key] = DB.data[key].filter(x => x.id !== id);
    DB.save();
}

/* ===================== AUTH (SIMULASI) =====================
   Siap diganti: POST /api/auth/login/ (Django REST / Flask-JWT) */
let session = null;

function doLogin(username, password, remember) {
    const u = DB.data.users.find(x => x.username === username && x.password === password);
    if (!u) return null;
    session = { id: u.id, username: u.username, role: u.role, nama: u.nama, refId: u.refId || null };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (remember) localStorage.setItem(REMEMBER_KEY, username);
    else localStorage.removeItem(REMEMBER_KEY);
    return session;
}

function doLogout() {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    showLogin();
    toast('Anda telah keluar.', 'info');
}

const getStudent = (id) => DB.data.students.find(s => s.id === id);
const getSubject = (id) => DB.data.subjects.find(s => s.id === id);
const currentStudent = () => getStudent(session.refId);

/* ===================== STATE & ROUTER ===================== */
let charts = {};

const state = {
    page: 'dashboard',
    search: '',
    sort: 'nama',
    filters: { tahunAjaran: '2026/2027', semester: '1', kelas: 'X-A', mapel: 'mp1', siswa: 'all' }
};

const MENUS = {
    admin: [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { id: 'guru', label: 'Data Guru', icon: 'fa-chalkboard-user' },
        { id: 'murid', label: 'Data Murid', icon: 'fa-user-graduate' },
        { id: 'kelas', label: 'Data Kelas', icon: 'fa-door-open' },
        { id: 'mapel', label: 'Mata Pelajaran', icon: 'fa-book' },
        { id: 'tahun', label: 'Tahun Ajaran', icon: 'fa-calendar-days' },
        { id: 'semester', label: 'Semester', icon: 'fa-layer-group' },
        { id: 'ekskul', label: 'Ekstrakurikuler', icon: 'fa-futbol' },
        { id: 'users', label: 'Akun Pengguna', icon: 'fa-users-gear' }
    ],
    guru: [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { id: 'nilai', label: 'Input Nilai', icon: 'fa-pen-to-square' },
        { id: 'absensi', label: 'Absensi Siswa', icon: 'fa-clipboard-check' },
        { id: 'evaluasi', label: 'Evaluasi Murid', icon: 'fa-comments' },
        { id: 'ekskul', label: 'Ekstrakurikuler', icon: 'fa-futbol' }
    ],
    murid: [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { id: 'transkrip', label: 'Transkrip Nilai', icon: 'fa-file-lines' },
        { id: 'absensi', label: 'Absensi Saya', icon: 'fa-clipboard-check' },
        { id: 'evaluasi', label: 'Evaluasi Guru', icon: 'fa-comments' },
        { id: 'ekskul', label: 'Ekstrakurikuler', icon: 'fa-futbol' }
    ]
};

const PAGE_TITLES = {
    dashboard: 'Dashboard', guru: 'Data Guru', murid: 'Data Murid', kelas: 'Data Kelas',
    mapel: 'Mata Pelajaran', tahun: 'Tahun Ajaran', semester: 'Semester',
    ekskul: 'Ekstrakurikuler', users: 'Akun Pengguna', nilai: 'Input Nilai Siswa',
    absensi: 'Absensi Siswa', evaluasi: 'Evaluasi Murid', transkrip: 'Transkrip Nilai'
};

function navigate(page) {
    state.page = page;
    state.search = '';
    renderPage();
    $$('#sidebar-nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $('#page-title').textContent = PAGE_TITLES[page] || 'Dashboard';
    closeSidebarMobile();
}

function rerender() {
    if (session) renderPage();
}

function renderPage() {
    Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) { /* noop */ } });
    charts = {};
    const key = session.role + ':' + state.page;
    const views = {
        'admin:dashboard': renderAdminDashboard,
        'admin:guru': () => renderEntityPage('guru'),
        'admin:murid': () => renderEntityPage('murid'),
        'admin:kelas': () => renderEntityPage('kelas'),
        'admin:mapel': () => renderEntityPage('mapel'),
        'admin:tahun': () => renderEntityPage('tahun'),
        'admin:semester': () => renderEntityPage('semester'),
        'admin:ekskul': () => renderEntityPage('ekskul'),
        'admin:users': () => renderEntityPage('users'),
        'guru:dashboard': renderGuruDashboard,
        'guru:nilai': renderGuruNilai,
        'guru:absensi': renderGuruAbsensi,
        'guru:evaluasi': renderGuruEvaluasi,
        'guru:ekskul': renderGuruEkskul,
        'murid:dashboard': renderMuridDashboard,
        'murid:transkrip': renderMuridTranskrip,
        'murid:absensi': renderMuridAbsensi,
        'murid:evaluasi': renderMuridEvaluasi,
        'murid:ekskul': renderMuridEkskul
    };
    (views[key] || (() => { $('#main-content').innerHTML = '<div class="panel">Halaman tidak ditemukan.</div>'; }))();
}

/* ===================== UI HELPERS ===================== */
function toast(msg, type = 'success') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('data-testid', 'toast-notification');
    el.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
    $('#toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); }, 3200);
}

function openModal(title, bodyHtml) {
    $('#modal-box').innerHTML = `
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" id="modal-close" data-testid="modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">${bodyHtml}</div>`;
    $('#modal-overlay').classList.remove('hidden');
    $('#modal-close').onclick = closeModal;
}

function closeModal() { $('#modal-overlay').classList.add('hidden'); }

function confirmDialog(msg) {
    return new Promise((resolve) => {
        openModal('Konfirmasi Hapus', `
            <div class="confirm-body">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>${msg}</p>
                <div class="modal-actions">
                    <button class="btn btn-ghost" id="cf-no" data-testid="confirm-cancel-btn">Batal</button>
                    <button class="btn btn-danger" id="cf-yes" data-testid="confirm-delete-btn"><i class="fa-solid fa-trash"></i> Hapus</button>
                </div>
            </div>`);
        $('#cf-no').onclick = () => { closeModal(); resolve(false); };
        $('#cf-yes').onclick = () => { closeModal(); resolve(true); };
    });
}

function formFieldsHtml(fields, item = {}) {
    return fields.map(f => {
        const v = item[f.k] ?? '';
        if (f.type === 'select') {
            const opts = (typeof f.options === 'function' ? f.options() : f.options) || [];
            return `<div class="form-group ${f.span ? 'span-2' : ''}">
                <label>${f.l}</label>
                <select class="form-control" name="${f.k}" data-testid="field-${f.k}">
                    ${opts.map(o => {
                        const val = Array.isArray(o) ? o[0] : o;
                        const lbl = Array.isArray(o) ? o[1] : o;
                        return `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${lbl}</option>`;
                    }).join('')}
                </select></div>`;
        }
        if (f.type === 'textarea') {
            return `<div class="form-group span-2"><label>${f.l}</label>
                <textarea class="form-control" name="${f.k}" data-testid="field-${f.k}" rows="3" placeholder="${f.ph || ''}">${v}</textarea></div>`;
        }
        const extra = f.type === 'number' ? 'min="0" max="100"' : '';
        return `<div class="form-group ${f.span ? 'span-2' : ''}"><label>${f.l}</label>
            <input class="form-control" type="${f.type || 'text'}" name="${f.k}" data-testid="field-${f.k}" value="${v}" ${extra} required></div>`;
    }).join('');
}

function statCard(icon, color, value, label, delay = 0) {
    return `<div class="stat-card anim-delay-${delay}" data-testid="stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
        <div class="stat-icon ${color}"><i class="fa-solid ${icon}"></i></div>
        <div class="stat-info"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>
    </div>`;
}

function emptyRow(colspan, msg = 'Belum ada data.') {
    return `<tr><td colspan="${colspan}"><div class="empty-state"><i class="fa-solid fa-inbox"></i>${msg}</div></td></tr>`;
}

function bindSearch(inputId, onChange) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', (e) => {
        onChange(e.target.value);
        const n = document.getElementById(inputId);
        if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    });
}

function filterSelectsHtml(items) {
    return items.map(f => `
        <div class="filter-group">
            <label>${f.label}</label>
            <select class="form-control" id="${f.id}" data-testid="${f.id}">
                ${f.options.map(o => `<option value="${o[0]}" ${String(o[0]) === String(f.value) ? 'selected' : ''}>${o[1]}</option>`).join('')}
            </select>
        </div>`).join('');
}

function bindFilter(id, key, afterChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => { state.filters[key] = e.target.value; if (afterChange) afterChange(); else renderPage(); });
}

const tahunOptions = () => DB.data.tahunAjaran.map(t => [t.nama, t.nama]);
const semesterOptions = () => DB.data.semesters.map(s => [s.nama, 'Semester ' + s.nama]);
const kelasOptions = () => DB.data.classes.map(k => [k.nama, k.nama]);
const mapelOptions = () => DB.data.subjects.map(m => [m.id, m.nama]);

/* ===================== CHART HELPER ===================== */
function makeChart(id, cfg) {
    const el = document.getElementById(id);
    const ChartLib = window.Chart; // global dari CDN Chart.js
    if (!el || !ChartLib) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    ChartLib.defaults.color = dark ? '#94a3b8' : '#64748b';
    ChartLib.defaults.borderColor = dark ? 'rgba(148,163,184,.15)' : 'rgba(100,116,139,.12)';
    ChartLib.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    if (charts[id]) charts[id].destroy();
    charts[id] = new ChartLib(el, cfg);
}

const CHART_COLORS = ['#2563eb', '#38bdf8', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

/* ===================== DASHBOARD ADMIN ===================== */
function renderAdminDashboard() {
    const d = DB.data;
    const allFinal = d.grades.map(hitungNilaiAkhir).filter(n => n !== null);
    const avg = allFinal.length ? round1(allFinal.reduce((a, b) => a + b, 0) / allFinal.length) : 0;

    $('#main-content').innerHTML = `
        <div class="stat-grid">
            ${statCard('fa-chalkboard-user', 'blue', d.teachers.length, 'Jumlah Guru', 0)}
            ${statCard('fa-user-graduate', 'green', d.students.length, 'Jumlah Murid', 1)}
            ${statCard('fa-door-open', 'violet', d.classes.length, 'Jumlah Kelas', 2)}
            ${statCard('fa-book', 'cyan', d.subjects.length, 'Mata Pelajaran', 3)}
            ${statCard('fa-star', 'amber', avg, 'Rata-rata Nilai Siswa', 4)}
        </div>
        <div class="chart-grid">
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-column"></i> Jumlah Murid per Kelas</h3>
                <div class="chart-box"><canvas id="chart-admin-kelas"></canvas></div>
            </div>
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-pie"></i> Distribusi Predikat Siswa</h3>
                <div class="chart-box"><canvas id="chart-admin-predikat"></canvas></div>
            </div>
        </div>
        <div class="panel">
            <h3 class="panel-title"><i class="fa-solid fa-circle-info"></i> Ringkasan Sistem</h3>
            <p style="color:var(--muted-color);font-size:14px">
                Selamat datang, <b>${session.nama}</b>. Gunakan menu di samping untuk mengelola data guru, murid, kelas,
                mata pelajaran, tahun ajaran, semester, kegiatan ekstrakurikuler, dan akun pengguna.
                Tahun ajaran aktif: <b>${(d.tahunAjaran.find(t => t.status === 'Aktif') || {}).nama || '-'}</b>.
            </p>
        </div>`;

    makeChart('chart-admin-kelas', {
        type: 'bar',
        data: {
            labels: d.classes.map(k => k.nama),
            datasets: [{
                label: 'Jumlah Murid',
                data: d.classes.map(k => d.students.filter(s => s.kelas === k.nama).length),
                backgroundColor: CHART_COLORS, borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const predCount = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    d.grades.forEach(g => { const p = predikat(hitungNilaiAkhir(g)); if (predCount[p] !== undefined) predCount[p]++; });
    makeChart('chart-admin-predikat', {
        type: 'doughnut',
        data: {
            labels: Object.keys(predCount),
            datasets: [{ data: Object.values(predCount), backgroundColor: ['#16a34a', '#2563eb', '#d97706', '#ea580c', '#dc2626'], borderWidth: 2, borderColor: 'transparent' }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%' }
    });
}

/* ===================== CRUD MASTER DATA (ADMIN) ===================== */
const ENTITIES = {
    guru: {
        key: 'teachers', title: 'Data Guru',
        columns: [{ k: 'nama', l: 'Nama Guru' }, { k: 'nip', l: 'NIP' }, { k: 'mapel', l: 'Mata Pelajaran' }],
        fields: [
            { k: 'nama', l: 'Nama Lengkap' },
            { k: 'nip', l: 'NIP' },
            { k: 'mapel', l: 'Mata Pelajaran', type: 'select', options: () => DB.data.subjects.map(s => s.nama) }
        ]
    },
    murid: {
        key: 'students', title: 'Data Murid',
        columns: [{ k: 'nama', l: 'Nama' }, { k: 'nis', l: 'NIS' }, { k: 'kelas', l: 'Kelas' }, { k: 'jk', l: 'L/P' }],
        fields: [
            { k: 'nama', l: 'Nama Lengkap' },
            { k: 'nis', l: 'NIS' },
            { k: 'kelas', l: 'Kelas', type: 'select', options: () => DB.data.classes.map(k => k.nama) },
            { k: 'jk', l: 'Jenis Kelamin', type: 'select', options: [['L', 'Laki-laki'], ['P', 'Perempuan']] }
        ]
    },
    kelas: {
        key: 'classes', title: 'Data Kelas',
        columns: [{ k: 'nama', l: 'Nama Kelas' }, { k: 'wali', l: 'Wali Kelas' }],
        fields: [
            { k: 'nama', l: 'Nama Kelas' },
            { k: 'wali', l: 'Wali Kelas', type: 'select', options: () => DB.data.teachers.map(t => t.nama) }
        ]
    },
    mapel: {
        key: 'subjects', title: 'Mata Pelajaran',
        columns: [{ k: 'nama', l: 'Nama Mata Pelajaran' }, { k: 'kkm', l: 'KKM' }],
        fields: [
            { k: 'nama', l: 'Nama Mata Pelajaran' },
            { k: 'kkm', l: 'KKM', type: 'number' }
        ]
    },
    tahun: {
        key: 'tahunAjaran', title: 'Tahun Ajaran',
        columns: [{ k: 'nama', l: 'Tahun Ajaran' }, { k: 'status', l: 'Status' }],
        fields: [
            { k: 'nama', l: 'Tahun Ajaran (mis. 2026/2027)' },
            { k: 'status', l: 'Status', type: 'select', options: ['Aktif', 'Nonaktif'] }
        ]
    },
    semester: {
        key: 'semesters', title: 'Semester',
        columns: [{ k: 'nama', l: 'Semester' }, { k: 'status', l: 'Status' }],
        fields: [
            { k: 'nama', l: 'Semester', type: 'select', options: ['1', '2'] },
            { k: 'status', l: 'Status', type: 'select', options: ['Aktif', 'Nonaktif'] }
        ]
    },
    ekskul: {
        key: 'ekskulMaster', title: 'Kegiatan Ekstrakurikuler',
        columns: [{ k: 'nama', l: 'Nama Kegiatan' }, { k: 'pembina', l: 'Pembina' }],
        fields: [
            { k: 'nama', l: 'Nama Ekstrakurikuler' },
            { k: 'pembina', l: 'Pembina', type: 'select', options: () => DB.data.teachers.map(t => t.nama) }
        ]
    },
    users: {
        key: 'users', title: 'Akun Pengguna',
        columns: [{ k: 'username', l: 'Username' }, { k: 'nama', l: 'Nama' }, { k: 'role', l: 'Role' }],
        fields: [
            { k: 'username', l: 'Username' },
            { k: 'password', l: 'Password' },
            { k: 'nama', l: 'Nama Lengkap' },
            { k: 'role', l: 'Role', type: 'select', options: ['admin', 'guru', 'murid'] }
        ]
    }
};

function renderEntityPage(entKey) {
    const ent = ENTITIES[entKey];
    const q = state.search.toLowerCase();
    const rows = DB.data[ent.key].filter(it =>
        ent.columns.some(c => String(it[c.k] ?? '').toLowerCase().includes(q)));

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="filter-group">
                        <label>Cari Data</label>
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input class="form-control" id="table-search" data-testid="table-search-input" placeholder="Cari ${ent.title.toLowerCase()}..." value="${state.search}">
                        </div>
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" id="btn-add" data-testid="add-data-btn"><i class="fa-solid fa-plus"></i> Tambah ${ent.title}</button>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table" data-testid="data-table">
                    <thead><tr>
                        <th>No</th>
                        ${ent.columns.map(c => `<th>${c.l}</th>`).join('')}
                        <th class="text-center">Aksi</th>
                    </tr></thead>
                    <tbody>
                        ${rows.length ? rows.map((it, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                ${ent.columns.map(c => `<td>${it[c.k] ?? '-'}</td>`).join('')}
                                <td class="text-center">
                                    <button class="icon-btn primary btn-edit" data-testid="edit-btn-${it.id}" data-id="${it.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                    <button class="icon-btn danger btn-del" data-testid="delete-btn-${it.id}" data-id="${it.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>`).join('') : emptyRow(ent.columns.length + 2, 'Data tidak ditemukan.')}
                    </tbody>
                </table>
            </div>
        </div>`;

    bindSearch('table-search', (v) => { state.search = v; renderPage(); });
    $('#btn-add').onclick = () => openEntityModal(ent, null);
    $$('.btn-edit').forEach(b => b.onclick = () => openEntityModal(ent, DB.data[ent.key].find(x => x.id === b.dataset.id)));
    $$('.btn-del').forEach(b => b.onclick = async () => {
        const ok = await confirmDialog('Yakin ingin menghapus data ini? Tindakan tidak dapat dibatalkan.');
        if (ok) { await deleteEntityById(ent.key, b.dataset.id); toast('Data berhasil dihapus.'); }
    });
}

function openEntityModal(ent, item) {
    openModal((item ? 'Edit ' : 'Tambah ') + ent.title, `
        <form id="entity-form" class="form-grid" data-testid="entity-form">
            ${formFieldsHtml(ent.fields, item || {})}
            <div class="modal-actions span-2">
                <button type="button" class="btn btn-ghost" id="form-cancel">Batal</button>
                <button type="submit" class="btn btn-primary" data-testid="modal-save-btn"><i class="fa-solid fa-floppy-disk"></i> Simpan</button>
            </div>
        </form>`);
    $('#form-cancel').onclick = closeModal;
    $('#entity-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {};
        ent.fields.forEach(f => {
            let v = form.elements[f.k].value;
            if (f.type === 'number') v = v === '' ? null : +v;
            data[f.k] = v;
        });
        if (item) { await updateEntity(ent.key, item.id, data); toast('Data berhasil diperbarui.'); }
        else { await addEntity(ent.key, data); toast('Data berhasil ditambahkan.'); }
        closeModal();
    };
}

/* ===================== DASHBOARD GURU ===================== */
function gradesFiltered(ta, sem) {
    return DB.data.grades.filter(g => g.tahunAjaran === ta && g.semester === sem);
}

function renderGuruDashboard() {
    const f = state.filters;
    const gf = gradesFiltered(f.tahunAjaran, f.semester);
    const finals = gf.map(hitungNilaiAkhir).filter(n => n !== null);
    const avg = finals.length ? round1(finals.reduce((a, b) => a + b, 0) / finals.length) : 0;
    const lulus = finals.filter(n => n >= KKM).length;
    const tidakLulus = finals.filter(n => n < KKM).length;
    const attPcts = DB.data.attendance
        .filter(a => a.tahunAjaran === f.tahunAjaran && a.semester === f.semester)
        .map(persenKehadiran);
    const avgAtt = attPcts.length ? round1(attPcts.reduce((a, b) => a + b, 0) / attPcts.length) : 0;

    $('#main-content').innerHTML = `
        <div class="stat-grid">
            ${statCard('fa-user-graduate', 'blue', DB.data.students.length, 'Total Siswa', 0)}
            ${statCard('fa-star', 'cyan', avg, 'Rata-rata Nilai', 1)}
            ${statCard('fa-circle-check', 'green', lulus, 'Siswa Lulus', 2)}
            ${statCard('fa-circle-xmark', 'red', tidakLulus, 'Siswa Tidak Lulus', 3)}
            ${statCard('fa-clipboard-check', 'amber', avgAtt + '%', 'Persentase Kehadiran', 4)}
        </div>
        <div class="chart-grid">
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-column"></i> Rata-rata Nilai per Mata Pelajaran</h3>
                <div class="chart-box"><canvas id="chart-guru-mapel"></canvas></div>
            </div>
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-pie"></i> Siswa Lulus / Tidak Lulus</h3>
                <div class="chart-box"><canvas id="chart-guru-lulus"></canvas></div>
            </div>
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-line"></i> Perkembangan Nilai per Semester</h3>
                <div class="chart-box"><canvas id="chart-guru-tren"></canvas></div>
            </div>
        </div>`;

    makeChart('chart-guru-mapel', {
        type: 'bar',
        data: {
            labels: DB.data.subjects.map(m => m.nama),
            datasets: [{
                label: 'Rata-rata Nilai Akhir',
                data: DB.data.subjects.map(m => {
                    const ns = gf.filter(g => g.subjectId === m.id).map(hitungNilaiAkhir).filter(n => n !== null);
                    return ns.length ? round1(ns.reduce((a, b) => a + b, 0) / ns.length) : 0;
                }),
                backgroundColor: CHART_COLORS, borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
    });

    makeChart('chart-guru-lulus', {
        type: 'doughnut',
        data: {
            labels: ['Lulus', 'Tidak Lulus'],
            datasets: [{ data: [lulus, tidakLulus], backgroundColor: ['#16a34a', '#dc2626'], borderWidth: 2, borderColor: 'transparent' }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%' }
    });

    const semLabels = DB.data.semesters.map(s => 'Semester ' + s.nama);
    const semAvg = DB.data.semesters.map(s => {
        const ns = gradesFiltered(f.tahunAjaran, s.nama).map(hitungNilaiAkhir).filter(n => n !== null);
        return ns.length ? round1(ns.reduce((a, b) => a + b, 0) / ns.length) : 0;
    });
    makeChart('chart-guru-tren', {
        type: 'line',
        data: {
            labels: semLabels,
            datasets: [{
                label: 'Rata-rata Nilai', data: semAvg,
                borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.15)',
                fill: true, tension: .4, pointRadius: 5, pointBackgroundColor: '#2563eb'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

/* ===================== GURU — INPUT NILAI ===================== */
function renderGuruNilai() {
    const f = state.filters;
    const q = state.search.toLowerCase();
    let students = DB.data.students.filter(s => s.kelas === f.kelas)
        .filter(s => s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q));

    const gradeOf = (sid) => DB.data.grades.find(g =>
        g.studentId === sid && g.subjectId === f.mapel && g.tahunAjaran === f.tahunAjaran && g.semester === f.semester);

    if (state.sort === 'tertinggi') students = [...students].sort((a, b) => (hitungNilaiAkhir(gradeOf(b.id)) ?? -1) - (hitungNilaiAkhir(gradeOf(a.id)) ?? -1));
    else if (state.sort === 'terendah') students = [...students].sort((a, b) => (hitungNilaiAkhir(gradeOf(a.id)) ?? 999) - (hitungNilaiAkhir(gradeOf(b.id)) ?? 999));
    else students = [...students].sort((a, b) => a.nama.localeCompare(b.nama));

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    ${filterSelectsHtml([
                        { id: 'f-tahun', label: 'Tahun Ajaran', options: tahunOptions(), value: f.tahunAjaran },
                        { id: 'f-semester', label: 'Semester', options: semesterOptions(), value: f.semester },
                        { id: 'f-kelas', label: 'Kelas', options: kelasOptions(), value: f.kelas },
                        { id: 'f-mapel', label: 'Mata Pelajaran', options: mapelOptions(), value: f.mapel }
                    ])}
                </div>
                <div class="toolbar-right">
                    <div class="filter-group">
                        <label>Urutkan</label>
                        <select class="form-control" id="f-sort" data-testid="sort-select">
                            <option value="nama" ${state.sort === 'nama' ? 'selected' : ''}>Nama A-Z</option>
                            <option value="tertinggi" ${state.sort === 'tertinggi' ? 'selected' : ''}>Nilai Tertinggi</option>
                            <option value="terendah" ${state.sort === 'terendah' ? 'selected' : ''}>Nilai Terendah</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Cari Siswa</label>
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input class="form-control" id="table-search" data-testid="table-search-input" placeholder="Nama / NIS..." value="${state.search}">
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table" data-testid="grades-table">
                    <thead><tr>
                        <th>No</th><th>Nama Siswa</th><th>NIS</th>
                        <th>Tugas<br><small style="font-weight:400">20%</small></th>
                        <th>Quiz<br><small style="font-weight:400">20%</small></th>
                        <th>UTS<br><small style="font-weight:400">25%</small></th>
                        <th>UAS<br><small style="font-weight:400">35%</small></th>
                        <th>Nilai Akhir</th><th>Predikat</th><th>Status</th><th class="text-center">Aksi</th>
                    </tr></thead>
                    <tbody>
                        ${students.length ? students.map((s, i) => {
                            const g = gradeOf(s.id);
                            const na = hitungNilaiAkhir(g);
                            return `<tr>
                                <td>${i + 1}</td>
                                <td><b>${s.nama}</b></td>
                                <td>${s.nis}</td>
                                <td>${g?.tugas ?? '-'}</td>
                                <td>${g?.quiz ?? '-'}</td>
                                <td>${g?.uts ?? '-'}</td>
                                <td>${g?.uas ?? '-'}</td>
                                <td><b>${na ?? '-'}</b></td>
                                <td>${predikatBadge(predikat(na))}</td>
                                <td>${statusBadge(na)}</td>
                                <td class="text-center">
                                    <button class="icon-btn primary btn-edit-grade" data-testid="edit-grade-${s.id}" data-id="${s.id}" title="Input / Edit Nilai"><i class="fa-solid fa-pen"></i></button>
                                    ${g ? `<button class="icon-btn danger btn-del-grade" data-testid="delete-grade-${s.id}" data-id="${g.id}" title="Hapus Nilai"><i class="fa-solid fa-trash"></i></button>` : ''}
                                </td>
                            </tr>`;
                        }).join('') : emptyRow(11, 'Tidak ada siswa pada kelas ini.')}
                    </tbody>
                </table>
            </div>
        </div>`;

    bindFilter('f-tahun', 'tahunAjaran');
    bindFilter('f-semester', 'semester');
    bindFilter('f-kelas', 'kelas');
    bindFilter('f-mapel', 'mapel');
    bindSearch('table-search', (v) => { state.search = v; renderPage(); });
    $('#f-sort').addEventListener('change', (e) => { state.sort = e.target.value; renderPage(); });
    $$('.btn-edit-grade').forEach(b => b.onclick = () => openGradeModal(getStudent(b.dataset.id)));
    $$('.btn-del-grade').forEach(b => b.onclick = async () => {
        const ok = await confirmDialog('Hapus nilai siswa ini?');
        if (ok) { await deleteGrade(b.dataset.id); toast('Nilai berhasil dihapus.'); }
    });
}

function openGradeModal(student) {
    const f = state.filters;
    const existing = DB.data.grades.find(g =>
        g.studentId === student.id && g.subjectId === f.mapel && g.tahunAjaran === f.tahunAjaran && g.semester === f.semester);
    const mapel = getSubject(f.mapel);

    openModal(`Nilai ${mapel.nama} — ${student.nama}`, `
        <form id="grade-form" data-testid="grade-form">
            <div class="grade-preview" data-testid="grade-preview">
                <div><span>Nilai Akhir</span><b id="pv-akhir">-</b></div>
                <div><span>Predikat</span><b id="pv-predikat">-</b></div>
                <div><span>Status (KKM ${KKM})</span><b id="pv-status">-</b></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Nilai Tugas (20%)</label><input class="form-control grade-input" type="number" min="0" max="100" name="tugas" data-testid="grade-tugas" value="${existing?.tugas ?? ''}" required></div>
                <div class="form-group"><label>Nilai Quiz (20%)</label><input class="form-control grade-input" type="number" min="0" max="100" name="quiz" data-testid="grade-quiz" value="${existing?.quiz ?? ''}" required></div>
                <div class="form-group"><label>Nilai UTS (25%)</label><input class="form-control grade-input" type="number" min="0" max="100" name="uts" data-testid="grade-uts" value="${existing?.uts ?? ''}" required></div>
                <div class="form-group"><label>Nilai UAS (35%)</label><input class="form-control grade-input" type="number" min="0" max="100" name="uas" data-testid="grade-uas" value="${existing?.uas ?? ''}" required></div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" id="form-cancel">Batal</button>
                <button type="submit" class="btn btn-primary" data-testid="modal-save-btn"><i class="fa-solid fa-floppy-disk"></i> Simpan Nilai</button>
            </div>
        </form>`);

    const updatePreview = () => {
        const form = $('#grade-form');
        const na = hitungNilaiAkhir({
            tugas: +form.elements.tugas.value, quiz: +form.elements.quiz.value,
            uts: +form.elements.uts.value, uas: +form.elements.uas.value
        });
        $('#pv-akhir').textContent = na ?? '-';
        $('#pv-predikat').textContent = predikat(na);
        $('#pv-status').textContent = statusLulus(na);
        $('#pv-status').style.color = na === null ? 'inherit' : (na >= KKM ? 'var(--success-color)' : 'var(--danger-color)');
    };
    $$('.grade-input').forEach(i => i.addEventListener('input', updatePreview));
    updatePreview();

    $('#form-cancel').onclick = closeModal;
    $('#grade-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            studentId: student.id, subjectId: f.mapel,
            tahunAjaran: f.tahunAjaran, semester: f.semester,
            tugas: +form.elements.tugas.value, quiz: +form.elements.quiz.value,
            uts: +form.elements.uts.value, uas: +form.elements.uas.value
        };
        if (existing) { await updateGrade(existing.id, data); toast('Nilai berhasil diperbarui.'); }
        else { await saveGrade(data); toast('Nilai berhasil disimpan.'); }
        closeModal();
    };
}

/* ===================== GURU — ABSENSI ===================== */
function renderGuruAbsensi() {
    const f = state.filters;
    const q = state.search.toLowerCase();
    const students = DB.data.students.filter(s => s.kelas === f.kelas)
        .filter(s => s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q));

    const attOf = (sid) => DB.data.attendance.find(a =>
        a.studentId === sid && a.tahunAjaran === f.tahunAjaran && a.semester === f.semester);

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    ${filterSelectsHtml([
                        { id: 'f-tahun', label: 'Tahun Ajaran', options: tahunOptions(), value: f.tahunAjaran },
                        { id: 'f-semester', label: 'Semester', options: semesterOptions(), value: f.semester },
                        { id: 'f-kelas', label: 'Kelas', options: kelasOptions(), value: f.kelas }
                    ])}
                </div>
                <div class="toolbar-right">
                    <div class="filter-group">
                        <label>Cari Siswa</label>
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input class="form-control" id="table-search" data-testid="table-search-input" placeholder="Nama / NIS..." value="${state.search}">
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table" data-testid="attendance-table">
                    <thead><tr>
                        <th>No</th><th>Nama Siswa</th><th class="text-center">Hadir</th>
                        <th class="text-center">Sakit</th><th class="text-center">Izin</th>
                        <th class="text-center">Alpa</th><th>Persentase Kehadiran</th><th class="text-center">Aksi</th>
                    </tr></thead>
                    <tbody>
                        ${students.length ? students.map((s, i) => {
                            const a = attOf(s.id);
                            const pct = a ? persenKehadiran(a) : 0;
                            return `<tr>
                                <td>${i + 1}</td>
                                <td><b>${s.nama}</b><br><small style="color:var(--muted-color)">${s.nis}</small></td>
                                <td class="text-center"><span class="badge badge-success">${a?.hadir ?? '-'}</span></td>
                                <td class="text-center"><span class="badge badge-warning">${a?.sakit ?? '-'}</span></td>
                                <td class="text-center"><span class="badge badge-info">${a?.izin ?? '-'}</span></td>
                                <td class="text-center"><span class="badge badge-danger">${a?.alpa ?? '-'}</span></td>
                                <td>${a ? progressBar(pct) : '-'}</td>
                                <td class="text-center">
                                    <button class="icon-btn primary btn-edit-att" data-testid="edit-attendance-${s.id}" data-id="${s.id}" title="Input / Edit Absensi"><i class="fa-solid fa-pen"></i></button>
                                    ${a ? `<button class="icon-btn danger btn-del-att" data-testid="delete-attendance-${s.id}" data-id="${a.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>` : ''}
                                </td>
                            </tr>`;
                        }).join('') : emptyRow(8, 'Tidak ada siswa pada kelas ini.')}
                    </tbody>
                </table>
            </div>
        </div>`;

    bindFilter('f-tahun', 'tahunAjaran');
    bindFilter('f-semester', 'semester');
    bindFilter('f-kelas', 'kelas');
    bindSearch('table-search', (v) => { state.search = v; renderPage(); });
    $$('.btn-edit-att').forEach(b => b.onclick = () => openAttendanceModal(getStudent(b.dataset.id)));
    $$('.btn-del-att').forEach(b => b.onclick = async () => {
        const ok = await confirmDialog('Hapus data absensi siswa ini?');
        if (ok) { await deleteAttendance(b.dataset.id); toast('Absensi berhasil dihapus.'); }
    });
}

function openAttendanceModal(student) {
    const f = state.filters;
    const existing = DB.data.attendance.find(a =>
        a.studentId === student.id && a.tahunAjaran === f.tahunAjaran && a.semester === f.semester);

    openModal(`Absensi — ${student.nama}`, `
        <form id="att-form" data-testid="attendance-form">
            <div class="form-grid">
                <div class="form-group"><label>Hadir</label><input class="form-control" type="number" min="0" max="200" name="hadir" data-testid="att-hadir" value="${existing?.hadir ?? 0}" required></div>
                <div class="form-group"><label>Sakit</label><input class="form-control" type="number" min="0" max="200" name="sakit" data-testid="att-sakit" value="${existing?.sakit ?? 0}" required></div>
                <div class="form-group"><label>Izin</label><input class="form-control" type="number" min="0" max="200" name="izin" data-testid="att-izin" value="${existing?.izin ?? 0}" required></div>
                <div class="form-group"><label>Alpa</label><input class="form-control" type="number" min="0" max="200" name="alpa" data-testid="att-alpa" value="${existing?.alpa ?? 0}" required></div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" id="form-cancel">Batal</button>
                <button type="submit" class="btn btn-primary" data-testid="modal-save-btn"><i class="fa-solid fa-floppy-disk"></i> Simpan Absensi</button>
            </div>
        </form>`);

    $('#form-cancel').onclick = closeModal;
    $('#att-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        await saveAttendance({
            studentId: student.id, tahunAjaran: f.tahunAjaran, semester: f.semester,
            hadir: +form.elements.hadir.value, sakit: +form.elements.sakit.value,
            izin: +form.elements.izin.value, alpa: +form.elements.alpa.value
        });
        toast('Absensi berhasil disimpan.');
        closeModal();
    };
}

/* ===================== GURU — EVALUASI ===================== */
function renderGuruEvaluasi() {
    const f = state.filters;
    const q = state.search.toLowerCase();
    let list = DB.data.evaluations.filter(ev => {
        const s = getStudent(ev.studentId);
        const m = getSubject(ev.subjectId);
        return (s && (s.nama.toLowerCase().includes(q) || (m && m.nama.toLowerCase().includes(q))));
    });
    if (f.siswa !== 'all') list = list.filter(ev => ev.studentId === f.siswa);

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="filter-group">
                        <label>Filter Siswa</label>
                        <select class="form-control" id="f-siswa" data-testid="filter-siswa">
                            <option value="all">Semua Siswa</option>
                            ${DB.data.students.map(s => `<option value="${s.id}" ${f.siswa === s.id ? 'selected' : ''}>${s.nama} (${s.kelas})</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Cari Evaluasi</label>
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input class="form-control" id="table-search" data-testid="table-search-input" placeholder="Nama siswa / mapel..." value="${state.search}">
                        </div>
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" id="btn-add-eval" data-testid="add-evaluation-btn"><i class="fa-solid fa-plus"></i> Tambah Evaluasi</button>
                </div>
            </div>
            <div class="eval-grid">
                ${list.length ? list.map(ev => {
                    const s = getStudent(ev.studentId);
                    const m = getSubject(ev.subjectId);
                    return `<div class="eval-card" data-testid="eval-card-${ev.id}">
                        <h4>${m?.nama || '-'} — ${s?.nama || '-'}</h4>
                        <div class="eval-teacher"><i class="fa-solid fa-user"></i> ${ev.guru} &middot; <i class="fa-solid fa-door-open"></i> ${s?.kelas || '-'}</div>
                        <div class="eval-tags">
                            <span class="badge badge-primary">Sikap: ${ev.sikap}</span>
                            <span class="badge badge-info">Disiplin: ${ev.kedisiplinan}</span>
                            <span class="badge badge-success">Aktif: ${ev.keaktifan}</span>
                            <span class="badge badge-warning">T. Jawab: ${ev.tanggungJawab}</span>
                            <span class="badge badge-muted">${ev.perkembangan}</span>
                        </div>
                        <p class="eval-text">"${ev.evaluasi}"</p>
                        ${ev.catatan ? `<p class="eval-note"><i class="fa-solid fa-note-sticky"></i> ${ev.catatan}</p>` : ''}
                        <div class="modal-actions" style="margin-top:14px">
                            <button class="btn btn-sm btn-ghost btn-edit-eval" data-testid="edit-eval-${ev.id}" data-id="${ev.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="btn btn-sm btn-danger btn-del-eval" data-testid="delete-eval-${ev.id}" data-id="${ev.id}"><i class="fa-solid fa-trash"></i> Hapus</button>
                        </div>
                    </div>`;
                }).join('') : '<div class="panel" style="grid-column:1/-1"><div class="empty-state"><i class="fa-solid fa-comments"></i>Belum ada evaluasi.</div></div>'}
            </div>
        </div>`;

    bindFilter('f-siswa', 'siswa');
    bindSearch('table-search', (v) => { state.search = v; renderPage(); });
    $('#btn-add-eval').onclick = () => openEvaluationModal(null);
    $$('.btn-edit-eval').forEach(b => b.onclick = () => openEvaluationModal(DB.data.evaluations.find(e => e.id === b.dataset.id)));
    $$('.btn-del-eval').forEach(b => b.onclick = async () => {
        const ok = await confirmDialog('Hapus evaluasi ini?');
        if (ok) { await deleteEvaluation(b.dataset.id); toast('Evaluasi berhasil dihapus.'); }
    });
}

function openEvaluationModal(item) {
    const fields = [
        { k: 'studentId', l: 'Nama Siswa', type: 'select', options: () => DB.data.students.map(s => [s.id, `${s.nama} (${s.kelas})`]) },
        { k: 'subjectId', l: 'Mata Pelajaran', type: 'select', options: mapelOptions },
        { k: 'sikap', l: 'Sikap', type: 'select', options: SIKAP_OPTS },
        { k: 'kedisiplinan', l: 'Kedisiplinan', type: 'select', options: SIKAP_OPTS },
        { k: 'keaktifan', l: 'Keaktifan', type: 'select', options: SIKAP_OPTS },
        { k: 'tanggungJawab', l: 'Tanggung Jawab', type: 'select', options: SIKAP_OPTS },
        { k: 'perkembangan', l: 'Perkembangan Belajar', type: 'select', options: PERKEMBANGAN_OPTS },
        { k: 'evaluasi', l: 'Evaluasi Guru', type: 'textarea', ph: 'Tulis evaluasi perkembangan siswa...' },
        { k: 'catatan', l: 'Catatan Tambahan', type: 'textarea', ph: 'Opsional...' }
    ];
    openModal((item ? 'Edit' : 'Tambah') + ' Evaluasi Murid', `
        <form id="eval-form" class="form-grid" data-testid="evaluation-form">
            ${formFieldsHtml(fields, item || {})}
            <div class="modal-actions span-2">
                <button type="button" class="btn btn-ghost" id="form-cancel">Batal</button>
                <button type="submit" class="btn btn-primary" data-testid="modal-save-btn"><i class="fa-solid fa-floppy-disk"></i> Simpan Evaluasi</button>
            </div>
        </form>`);
    $('#form-cancel').onclick = closeModal;
    $('#eval-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        await saveEvaluation({
            id: item?.id,
            studentId: form.elements.studentId.value,
            subjectId: form.elements.subjectId.value,
            guru: session.nama,
            sikap: form.elements.sikap.value,
            kedisiplinan: form.elements.kedisiplinan.value,
            keaktifan: form.elements.keaktifan.value,
            tanggungJawab: form.elements.tanggungJawab.value,
            perkembangan: form.elements.perkembangan.value,
            evaluasi: form.elements.evaluasi.value,
            catatan: form.elements.catatan.value
        });
        toast('Evaluasi berhasil disimpan.');
        closeModal();
    };
}

/* ===================== GURU — EKSTRAKURIKULER ===================== */
function renderGuruEkskul() {
    const q = state.search.toLowerCase();
    const list = DB.data.ekskul.filter(ek => {
        const s = getStudent(ek.studentId);
        return s && (s.nama.toLowerCase().includes(q) || ek.nama.toLowerCase().includes(q));
    });

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="filter-group">
                        <label>Cari</label>
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input class="form-control" id="table-search" data-testid="table-search-input" placeholder="Nama siswa / ekskul..." value="${state.search}">
                        </div>
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" id="btn-add-ek" data-testid="add-ekskul-btn"><i class="fa-solid fa-plus"></i> Tambah Nilai Ekskul</button>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table" data-testid="ekskul-table">
                    <thead><tr>
                        <th>No</th><th>Nama Siswa</th><th>Kelas</th><th>Ekstrakurikuler</th>
                        <th>Nilai</th><th>Deskripsi</th><th class="text-center">Aksi</th>
                    </tr></thead>
                    <tbody>
                        ${list.length ? list.map((ek, i) => {
                            const s = getStudent(ek.studentId);
                            return `<tr>
                                <td>${i + 1}</td>
                                <td><b>${s?.nama || '-'}</b></td>
                                <td>${s?.kelas || '-'}</td>
                                <td>${ek.nama}</td>
                                <td>${predikatBadge(ek.nilai)}</td>
                                <td style="white-space:normal;max-width:280px">${ek.deskripsi}</td>
                                <td class="text-center">
                                    <button class="icon-btn primary btn-edit-ek" data-testid="edit-ekskul-${ek.id}" data-id="${ek.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                    <button class="icon-btn danger btn-del-ek" data-testid="delete-ekskul-${ek.id}" data-id="${ek.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>`;
                        }).join('') : emptyRow(7, 'Belum ada nilai ekstrakurikuler.')}
                    </tbody>
                </table>
            </div>
        </div>`;

    bindSearch('table-search', (v) => { state.search = v; renderPage(); });
    $('#btn-add-ek').onclick = () => openEkskulModal(null);
    $$('.btn-edit-ek').forEach(b => b.onclick = () => openEkskulModal(DB.data.ekskul.find(e => e.id === b.dataset.id)));
    $$('.btn-del-ek').forEach(b => b.onclick = async () => {
        const ok = await confirmDialog('Hapus nilai ekstrakurikuler ini?');
        if (ok) { await deleteExtracurricular(b.dataset.id); toast('Data ekstrakurikuler berhasil dihapus.'); }
    });
}

function openEkskulModal(item) {
    const fields = [
        { k: 'studentId', l: 'Nama Siswa', type: 'select', options: () => DB.data.students.map(s => [s.id, `${s.nama} (${s.kelas})`]) },
        { k: 'nama', l: 'Ekstrakurikuler', type: 'select', options: () => DB.data.ekskulMaster.map(e => e.nama) },
        { k: 'nilai', l: 'Nilai (Predikat)', type: 'select', options: PREDIKAT_OPTS },
        { k: 'deskripsi', l: 'Deskripsi', type: 'textarea', ph: 'Deskripsi capaian kegiatan...' }
    ];
    openModal((item ? 'Edit' : 'Tambah') + ' Nilai Ekstrakurikuler', `
        <form id="ek-form" class="form-grid" data-testid="ekskul-form">
            ${formFieldsHtml(fields, item || {})}
            <div class="modal-actions span-2">
                <button type="button" class="btn btn-ghost" id="form-cancel">Batal</button>
                <button type="submit" class="btn btn-primary" data-testid="modal-save-btn"><i class="fa-solid fa-floppy-disk"></i> Simpan</button>
            </div>
        </form>`);
    $('#form-cancel').onclick = closeModal;
    $('#ek-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        await saveExtracurricular({
            id: item?.id,
            studentId: form.elements.studentId.value,
            nama: form.elements.nama.value,
            nilai: form.elements.nilai.value,
            deskripsi: form.elements.deskripsi.value
        });
        toast('Data ekstrakurikuler berhasil disimpan.');
        closeModal();
    };
}

/* ===================== MURID — DASHBOARD ===================== */
function renderMuridDashboard() {
    const st = currentStudent();
    if (!st) { $('#main-content').innerHTML = '<div class="panel">Data murid tidak ditemukan.</div>'; return; }
    const f = state.filters;
    const taAktif = (DB.data.tahunAjaran.find(t => t.status === 'Aktif') || {}).nama || f.tahunAjaran;

    const myGrades = DB.data.grades.filter(g => g.studentId === st.id && g.tahunAjaran === f.tahunAjaran && g.semester === f.semester);
    const finals = myGrades.map(hitungNilaiAkhir).filter(n => n !== null);
    const avg = finals.length ? round1(finals.reduce((a, b) => a + b, 0) / finals.length) : 0;
    const lulus = finals.filter(n => n >= KKM).length;
    const att = DB.data.attendance.find(a => a.studentId === st.id && a.tahunAjaran === f.tahunAjaran && a.semester === f.semester);
    const attPct = att ? persenKehadiran(att) : 0;

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="profile-card" data-testid="student-profile">
                <div class="avatar lg">${initials(st.nama)}</div>
                <div class="profile-info">
                    <h3>${st.nama}</h3>
                    <span class="badge badge-primary"><i class="fa-solid fa-user-graduate"></i> Siswa Aktif</span>
                </div>
                <div class="profile-meta">
                    <div><span>NIS</span><b>${st.nis}</b></div>
                    <div><span>Kelas</span><b>${st.kelas}</b></div>
                    <div><span>Tahun Ajaran</span><b>${taAktif}</b></div>
                    <div><span>Semester</span><b>${f.semester}</b></div>
                </div>
                <button class="btn btn-success" id="btn-download-rapor" data-testid="download-rapor-btn">
                    <i class="fa-solid fa-file-pdf"></i> Download Rapor PDF
                </button>
            </div>
        </div>
        <div class="stat-grid">
            ${statCard('fa-star', 'blue', avg, 'Rata-rata Nilai', 0)}
            ${statCard('fa-book', 'cyan', myGrades.length, 'Mata Pelajaran', 1)}
            ${statCard('fa-circle-check', 'green', lulus, 'Mapel Lulus', 2)}
            ${statCard('fa-circle-xmark', 'red', finals.length - lulus, 'Mapel Tidak Lulus', 3)}
            ${statCard('fa-clipboard-check', 'amber', attPct + '%', 'Kehadiran', 4)}
        </div>
        <div class="chart-grid">
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-column"></i> Nilai per Mata Pelajaran</h3>
                <div class="chart-box"><canvas id="chart-murid-mapel"></canvas></div>
            </div>
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-pie"></i> Persentase Kehadiran</h3>
                <div class="chart-box"><canvas id="chart-murid-hadir"></canvas></div>
            </div>
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-line"></i> Perkembangan Nilai</h3>
                <div class="chart-box"><canvas id="chart-murid-tren"></canvas></div>
            </div>
        </div>`;

    $('#btn-download-rapor').onclick = downloadRapor;

    makeChart('chart-murid-mapel', {
        type: 'bar',
        data: {
            labels: myGrades.map(g => getSubject(g.subjectId)?.nama || '-'),
            datasets: [{
                label: 'Nilai Akhir',
                data: myGrades.map(hitungNilaiAkhir),
                backgroundColor: myGrades.map(g => (hitungNilaiAkhir(g) ?? 0) >= KKM ? '#2563eb' : '#ef4444'),
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
    });

    makeChart('chart-murid-hadir', {
        type: 'doughnut',
        data: {
            labels: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
            datasets: [{
                data: att ? [att.hadir, att.sakit, att.izin, att.alpa] : [0, 0, 0, 0],
                backgroundColor: ['#16a34a', '#d97706', '#0284c7', '#dc2626'],
                borderWidth: 2, borderColor: 'transparent'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%' }
    });

    const semAvg = DB.data.semesters.map(s => {
        const ns = DB.data.grades.filter(g => g.studentId === st.id && g.tahunAjaran === f.tahunAjaran && g.semester === s.nama)
            .map(hitungNilaiAkhir).filter(n => n !== null);
        return ns.length ? round1(ns.reduce((a, b) => a + b, 0) / ns.length) : 0;
    });
    makeChart('chart-murid-tren', {
        type: 'line',
        data: {
            labels: DB.data.semesters.map(s => 'Semester ' + s.nama),
            datasets: [{
                label: 'Rata-rata Nilai', data: semAvg,
                borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.15)',
                fill: true, tension: .4, pointRadius: 5, pointBackgroundColor: '#2563eb'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

/* ===================== MURID — TRANSKRIP ===================== */
function renderMuridTranskrip() {
    const st = currentStudent();
    const f = state.filters;
    const myGrades = DB.data.grades.filter(g => g.studentId === st.id && g.tahunAjaran === f.tahunAjaran && g.semester === f.semester);
    const finals = myGrades.map(hitungNilaiAkhir).filter(n => n !== null);
    const avg = finals.length ? round1(finals.reduce((a, b) => a + b, 0) / finals.length) : 0;
    const lulus = finals.filter(n => n >= KKM).length;

    $('#main-content').innerHTML = `
        <div class="stat-grid">
            ${statCard('fa-star', 'blue', avg, 'Rata-rata Nilai', 0)}
            ${statCard('fa-book', 'cyan', myGrades.length, 'Jumlah Mata Pelajaran', 1)}
            ${statCard('fa-circle-check', 'green', lulus, 'Mapel Lulus', 2)}
            ${statCard('fa-circle-xmark', 'red', finals.length - lulus, 'Mapel Tidak Lulus', 3)}
        </div>
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    ${filterSelectsHtml([
                        { id: 'f-tahun', label: 'Tahun Ajaran', options: tahunOptions(), value: f.tahunAjaran },
                        { id: 'f-semester', label: 'Semester', options: semesterOptions(), value: f.semester }
                    ])}
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-success" id="btn-download-rapor" data-testid="download-rapor-btn">
                        <i class="fa-solid fa-file-pdf"></i> Download Rapor PDF
                    </button>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table" data-testid="transcript-table">
                    <thead><tr>
                        <th>No</th><th>Mata Pelajaran</th><th>Tugas</th><th>Quiz</th>
                        <th>UTS</th><th>UAS</th><th>Nilai Akhir</th><th>Predikat</th><th>Status</th>
                    </tr></thead>
                    <tbody>
                        ${myGrades.length ? myGrades.map((g, i) => {
                            const na = hitungNilaiAkhir(g);
                            return `<tr>
                                <td>${i + 1}</td>
                                <td><b>${getSubject(g.subjectId)?.nama || '-'}</b></td>
                                <td>${g.tugas}</td><td>${g.quiz}</td><td>${g.uts}</td><td>${g.uas}</td>
                                <td><b>${na ?? '-'}</b></td>
                                <td>${predikatBadge(predikat(na))}</td>
                                <td>${statusBadge(na)}</td>
                            </tr>`;
                        }).join('') : emptyRow(9, 'Belum ada nilai untuk periode ini.')}
                    </tbody>
                </table>
            </div>
        </div>`;

    bindFilter('f-tahun', 'tahunAjaran');
    bindFilter('f-semester', 'semester');
    $('#btn-download-rapor').onclick = downloadRapor;
}

/* ===================== MURID — ABSENSI ===================== */
function renderMuridAbsensi() {
    const st = currentStudent();
    const f = state.filters;
    const att = DB.data.attendance.find(a => a.studentId === st.id && a.tahunAjaran === f.tahunAjaran && a.semester === f.semester);
    const pct = att ? persenKehadiran(att) : 0;

    $('#main-content').innerHTML = `
        <div class="panel">
            <div class="toolbar">
                <div class="toolbar-left">
                    ${filterSelectsHtml([
                        { id: 'f-tahun', label: 'Tahun Ajaran', options: tahunOptions(), value: f.tahunAjaran },
                        { id: 'f-semester', label: 'Semester', options: semesterOptions(), value: f.semester }
                    ])}
                </div>
            </div>
            <div class="stat-grid">
                ${statCard('fa-circle-check', 'green', att?.hadir ?? 0, 'Hadir', 0)}
                ${statCard('fa-notes-medical', 'amber', att?.sakit ?? 0, 'Sakit', 1)}
                ${statCard('fa-envelope', 'cyan', att?.izin ?? 0, 'Izin', 2)}
                ${statCard('fa-circle-xmark', 'red', att?.alpa ?? 0, 'Alpa', 3)}
            </div>
            <div class="panel" style="margin-bottom:0">
                <h3 class="panel-title"><i class="fa-solid fa-chart-pie"></i> Grafik Kehadiran (${pct}%)</h3>
                ${progressBar(pct)}
                <div class="chart-box" style="margin-top:18px"><canvas id="chart-absensi-donut"></canvas></div>
            </div>
        </div>`;

    bindFilter('f-tahun', 'tahunAjaran');
    bindFilter('f-semester', 'semester');

    makeChart('chart-absensi-donut', {
        type: 'doughnut',
        data: {
            labels: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
            datasets: [{
                data: att ? [att.hadir, att.sakit, att.izin, att.alpa] : [0, 0, 0, 0],
                backgroundColor: ['#16a34a', '#d97706', '#0284c7', '#dc2626'],
                borderWidth: 2, borderColor: 'transparent'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom' } } }
    });
}

/* ===================== MURID — EVALUASI & EKSKUL ===================== */
function renderMuridEvaluasi() {
    const st = currentStudent();
    const list = DB.data.evaluations.filter(e => e.studentId === st.id);

    $('#main-content').innerHTML = `
        <div class="eval-grid">
            ${list.length ? list.map(ev => `
                <div class="eval-card" data-testid="murid-eval-${ev.id}">
                    <h4><i class="fa-solid fa-book"></i> ${getSubject(ev.subjectId)?.nama || '-'}</h4>
                    <div class="eval-teacher"><i class="fa-solid fa-user"></i> Guru: ${ev.guru}</div>
                    <div class="eval-tags">
                        <span class="badge badge-primary">Sikap: ${ev.sikap}</span>
                        <span class="badge badge-info">Disiplin: ${ev.kedisiplinan}</span>
                        <span class="badge badge-success">Aktif: ${ev.keaktifan}</span>
                        <span class="badge badge-warning">T. Jawab: ${ev.tanggungJawab}</span>
                        <span class="badge badge-muted">${ev.perkembangan}</span>
                    </div>
                    <p class="eval-text">"${ev.evaluasi}"</p>
                    ${ev.catatan ? `<p class="eval-note"><i class="fa-solid fa-note-sticky"></i> ${ev.catatan}</p>` : ''}
                </div>`).join('') :
            '<div class="panel" style="grid-column:1/-1"><div class="empty-state"><i class="fa-solid fa-comments"></i>Belum ada evaluasi dari guru.</div></div>'}
        </div>`;
}

function renderMuridEkskul() {
    const st = currentStudent();
    const list = DB.data.ekskul.filter(e => e.studentId === st.id);

    $('#main-content').innerHTML = `
        <div class="panel">
            <h3 class="panel-title"><i class="fa-solid fa-futbol"></i> Nilai Kegiatan Ekstrakurikuler</h3>
            <div class="table-wrap">
                <table class="data-table" data-testid="murid-ekskul-table">
                    <thead><tr><th>No</th><th>Ekstrakurikuler</th><th>Nilai</th><th>Deskripsi</th></tr></thead>
                    <tbody>
                        ${list.length ? list.map((ek, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><b>${ek.nama}</b></td>
                                <td>${predikatBadge(ek.nilai)}</td>
                                <td style="white-space:normal;max-width:420px">${ek.deskripsi}</td>
                            </tr>`).join('') : emptyRow(4, 'Belum ada data ekstrakurikuler.')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

/* ===================== DOWNLOAD RAPOR PDF (jsPDF) ===================== */
function downloadRapor() {
    const st = currentStudent();
    const f = state.filters;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const wali = (DB.data.classes.find(k => k.nama === st.kelas) || {}).wali || '-';

    // Header resmi
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(19); doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN HASIL BELAJAR SISWA (RAPOR)', 105, 12, { align: 'center' });
    doc.setFontSize(13);
    doc.text(SCHOOL.name.toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(SCHOOL.address, 105, 26, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    let y = 40;

    // Identitas murid
    doc.setFontSize(10);
    const identitas = [
        ['Nama Siswa', st.nama, 'NIS', st.nis],
        ['Kelas', st.kelas, 'Tahun Ajaran', f.tahunAjaran],
        ['Semester', f.semester, 'Wali Kelas', wali]
    ];
    identitas.forEach(r => {
        doc.setFont('helvetica', 'normal'); doc.text(r[0], 14, y);
        doc.setFont('helvetica', 'bold'); doc.text(': ' + r[1], 45, y);
        doc.setFont('helvetica', 'normal'); doc.text(r[2], 115, y);
        doc.setFont('helvetica', 'bold'); doc.text(': ' + r[3], 145, y);
        y += 6;
    });
    y += 3;

    // Tabel nilai
    const myGrades = DB.data.grades.filter(g => g.studentId === st.id && g.tahunAjaran === f.tahunAjaran && g.semester === f.semester);
    const finals = myGrades.map(hitungNilaiAkhir).filter(n => n !== null);
    const avg = finals.length ? round1(finals.reduce((a, b) => a + b, 0) / finals.length) : 0;

    doc.autoTable({
        startY: y,
        head: [['No', 'Mata Pelajaran', 'Tugas', 'Quiz', 'UTS', 'UAS', 'Nilai Akhir', 'Predikat', 'Status']],
        body: myGrades.map((g, i) => {
            const na = hitungNilaiAkhir(g);
            return [i + 1, getSubject(g.subjectId)?.nama || '-', g.tugas, g.quiz, g.uts, g.uas, na ?? '-', predikat(na), statusLulus(na)];
        }),
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8.5 },
        styles: { fontSize: 8.5 },
        margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 6;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`Rata-rata Nilai: ${avg}   |   KKM: ${KKM}   |   Mapel Lulus: ${finals.filter(n => n >= KKM).length}/${myGrades.length}`, 14, y);
    y += 8;

    // Absensi
    const att = DB.data.attendance.find(a => a.studentId === st.id && a.tahunAjaran === f.tahunAjaran && a.semester === f.semester);
    doc.setFontSize(11); doc.text('Ketidakhadiran / Absensi', 14, y);
    doc.autoTable({
        startY: y + 2,
        head: [['Hadir', 'Sakit', 'Izin', 'Alpa', 'Persentase Kehadiran']],
        body: [[att?.hadir ?? 0, att?.sakit ?? 0, att?.izin ?? 0, att?.alpa ?? 0, (att ? persenKehadiran(att) : 0) + '%']],
        theme: 'grid', headStyles: { fillColor: [37, 99, 235], fontSize: 9 }, styles: { fontSize: 9, halign: 'center' },
        margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 8;

    // Ekstrakurikuler
    const eks = DB.data.ekskul.filter(e => e.studentId === st.id);
    doc.setFontSize(11); doc.text('Kegiatan Ekstrakurikuler', 14, y);
    doc.autoTable({
        startY: y + 2,
        head: [['No', 'Ekstrakurikuler', 'Nilai', 'Deskripsi']],
        body: eks.length ? eks.map((e, i) => [i + 1, e.nama, e.nilai, e.deskripsi]) : [['-', 'Belum ada data', '-', '-']],
        theme: 'grid', headStyles: { fillColor: [37, 99, 235], fontSize: 9 }, styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 240) { doc.addPage(); y = 20; }

    // Evaluasi guru
    const evals = DB.data.evaluations.filter(e => e.studentId === st.id);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Evaluasi & Catatan Guru', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (evals.length) {
        evals.forEach(ev => {
            const lines = doc.splitTextToSize(`${getSubject(ev.subjectId)?.nama || '-'} (${ev.guru}): ${ev.evaluasi}`, 178);
            if (y + lines.length * 4.5 > 270) { doc.addPage(); y = 20; }
            doc.text(lines, 14, y);
            y += lines.length * 4.5 + 3;
        });
    } else {
        doc.text('-', 14, y); y += 6;
    }
    y += 8;
    if (y > 240) { doc.addPage(); y = 20; }

    // Tanda tangan
    doc.setFontSize(10);
    doc.text('Mengetahui,', 140, y);
    doc.text('Wali Kelas,', 25, y);
    doc.setFont('helvetica', 'bold');
    doc.text(wali, 25, y + 28);
    doc.text(SCHOOL.headmaster, 140, y + 28);
    doc.setFont('helvetica', 'normal');
    doc.text('Kepala Sekolah', 140, y + 34);
    doc.text('NIP. -', 25, y + 34);

    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Dicetak oleh SIPRAPOR — ${SCHOOL.name} — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 105, 292, { align: 'center' });

    doc.save(`Rapor_${st.nama.replace(/\s+/g, '_')}_Sem${f.semester}.pdf`);
    toast('Rapor berhasil dibuat.');
}

/* ===================== THEME (DARK MODE) ===================== */
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.dataset.theme = saved;
    updateThemeBtn(saved);
}

function updateThemeBtn(theme) {
    const btn = $('#theme-toggle');
    btn.innerHTML = theme === 'dark'
        ? '<i class="fa-solid fa-moon"></i><span class="theme-label">Dark Mode</span>'
        : '<i class="fa-solid fa-sun"></i><span class="theme-label">Light Mode</span>';
}

function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    updateThemeBtn(next);
    rerender();
}

/* ===================== NAVIGASI & SHELL ===================== */
function buildSidebar() {
    const menus = MENUS[session.role];
    $('#sidebar-nav').innerHTML = menus.map(m => `
        <button class="nav-item ${state.page === m.id ? 'active' : ''}" data-page="${m.id}" data-testid="nav-${m.id}">
            <i class="fa-solid ${m.icon}"></i><span>${m.label}</span>
        </button>`).join('');
    $$('#sidebar-nav .nav-item').forEach(b => b.onclick = () => navigate(b.dataset.page));

    $('#sidebar-avatar').textContent = initials(session.nama);
    $('#sidebar-username').textContent = session.nama;
    $('#sidebar-role').textContent = session.role;
    $('#topbar-avatar').textContent = initials(session.nama);
    $('#topbar-username').textContent = session.nama;
    $('#topbar-role').textContent = session.role;
}

function closeSidebarMobile() {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('show');
}

function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app').classList.remove('hidden');
    buildSidebar();
    navigate('dashboard');
}

function showLogin() {
    $('#app').classList.add('hidden');
    $('#login-view').classList.remove('hidden');
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
    DB.load();
    initTheme();

    // Prefill "Ingat Saya"
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) { $('#login-username').value = remembered; $('#remember-me').checked = true; }

    // Login
    $('#login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = $('#login-username').value.trim();
        const p = $('#login-password').value;
        const s = doLogin(u, p, $('#remember-me').checked);
        if (s) {
            toast(`Selamat datang, ${s.nama}!`);
            showApp();
        } else {
            toast('Username atau password salah.', 'error');
        }
    });

    // Tampilkan / sembunyikan password
    $('#toggle-password').addEventListener('click', () => {
        const inp = $('#login-password');
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        $('#toggle-password').innerHTML = `<i class="fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
    });

    // Lupa password (simulasi — siap diganti endpoint reset password backend)
    $('#forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        toast('Silakan hubungi admin sekolah untuk reset password.', 'info');
    });

    // Shell events
    $('#logout-btn').addEventListener('click', doLogout);
    $('#theme-toggle').addEventListener('click', toggleTheme);
    $('#hamburger-btn').addEventListener('click', () => {
        $('#sidebar').classList.toggle('open');
        $('#sidebar-overlay').classList.toggle('show');
    });
    $('#sidebar-overlay').addEventListener('click', closeSidebarMobile);
    $('#modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });

    // Restore sesi
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
        try { session = JSON.parse(saved); showApp(); } catch (e) { showLogin(); }
    } else {
        showLogin();
    }
});