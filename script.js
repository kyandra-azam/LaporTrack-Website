/**
 * LaporTrack - Client Side Script dengan Integrasi Database MySQL
 * Mendukung integrasi REST API (tabel users, reports, report_timelines)
 * dan fallback lokal jika server database belum aktif.
 */

// =========================================================================
// 1. KONFIGURASI API & DETEKSI OTOMATIS ENDPOINT
// =========================================================================
let isOnlineDb = false;

function getApiBaseUrl() {
    if (window.API_BASE_URL) return window.API_BASE_URL;

    const host = window.location.hostname;
    const port = window.location.port;
    const path = window.location.pathname;

    // Jika diakses via XAMPP localhost
    if (host === 'localhost' || host === '127.0.0.1') {
        if (path.includes('/laportrack-backend')) {
            return `${window.location.protocol}//${window.location.host}/laportrack-backend/api`;
        }
        if (path.includes('/Lapor_Track')) {
            return `${window.location.protocol}//${window.location.host}/Lapor_Track/api`;
        }
        // Jika port adalah 8000 (PHP built-in server)
        if (port === '8000') {
            return `${window.location.protocol}//${window.location.host}/api`;
        }
        // Default Apache XAMPP path
        if (!port || port === '80') {
            return '/laportrack-backend/api';
        }
    }

    // Default untuk Live Server VSCode (port 5500) atau file:///
    // Mencoba koneksi ke backend lokal XAMPP atau PHP server port 8000
    return 'http://localhost/laportrack-backend/api';
}

const API_BASE = getApiBaseUrl();

// Fallback daftar petugas jika database offline
let fieldOfficersList = [
    { id: "FO-01", name: "Budi Santoso", dept: "Dinas PUPR - Tim Jalan" },
    { id: "FO-02", name: "Rahmat Hidayat", dept: "Dinas Perhubungan - PJU" },
    { id: "FO-03", name: "Agus Pratama", dept: "Dinas LH - Kebersihan" }
];

// Fallback data demo laporan untuk localStorage jika MySQL belum di-start
const defaultReports = [
    {
        id: "LPR-2026-X8B9",
        title: "Jalan Berlubang dan Aspal Amblas",
        category: "Fasilitas Jalan",
        agency: "Dinas PUPR",
        location: "Jl. Sudirman No. 45, Jakarta Selatan",
        date: "2026-10-21",
        status: "Diproses",
        description: "Terdapat lubang sedalam kurang lebih 15cm di lajur kiri dekat shelter busway. Membahayakan pengendara motor.",
        image: "https://placehold.co/600x400/1e3a8a/ffffff?text=Foto+Kerusakan+Jalan",
        reporterEmail: "warga1@mail.com",
        assignedOfficerId: "FO-01",
        assignedOfficerName: "Budi Santoso",
        timeline: [
            { status: "Menunggu Verifikasi", date: "2026-10-21 08:30 WIB", actor: "Sistem", note: "Laporan diterima oleh portal LaporTrack." },
            { status: "Diproses", date: "2026-10-21 11:15 WIB", actor: "Admin Dispatcher", note: "Diverifikasi & ditugaskan ke Petugas Lapangan: Budi Santoso (Dinas PUPR)." }
        ],
        adminResponse: "Petugas lapangan Budi Santoso telah dijadwalkan membawa penambal aspal sore ini.",
        resolutionNotes: "",
        proofImage: ""
    },
    {
        id: "LPR-2026-K72P",
        title: "Lampu Penerangan PJU Padam Total",
        category: "Lampu Penerangan",
        agency: "Dinas Perhubungan",
        location: "Jl. Melati Raya Blok C3",
        date: "2026-10-20",
        status: "Selesai",
        description: "Dua titik lampu jalan pemukiman padam total sejak pekan lalu.",
        image: "https://placehold.co/600x400/0284c7/ffffff?text=Lampu+PJU+Mati",
        reporterEmail: "warga2@mail.com",
        assignedOfficerId: "FO-02",
        assignedOfficerName: "Rahmat Hidayat",
        timeline: [
            { status: "Menunggu Verifikasi", date: "2026-10-20 09:10 WIB", actor: "Sistem", note: "Laporan terdaftar." },
            { status: "Diproses", date: "2026-10-20 13:00 WIB", actor: "Admin Dispatcher", note: "Penugasan ke Rahmat Hidayat (Dishub PJU)." },
            { status: "Selesai", date: "2026-10-21 15:00 WIB", actor: "Petugas Lapangan", note: "Pemasangan LED baru selesai dilaksanakan." }
        ],
        adminResponse: "Perbaikan telah rampung dilaksanakan oleh tim Dishub.",
        resolutionNotes: "Komponen trafo diganti dan 2 lampu LED PJU telah kembali menyala normal.",
        proofImage: "https://placehold.co/600x400/059669/ffffff?text=Bukti+Lampu+Jalan+Menyala"
    },
    {
        id: "LPR-2026-M41Q",
        title: "Saluran Air Tersumbat Sampah Limbah Pasar",
        category: "Saluran Air",
        agency: "Dinas Lingkungan Hidup",
        location: "Jl. Mawar Raya No. 12",
        date: "2026-10-23",
        status: "Menunggu Verifikasi",
        description: "Drainase tersumbat penumpukan kantong plastik dan lumpur tebal.",
        image: "https://placehold.co/600x400/4f46e5/ffffff?text=Got+Tersumbat",
        reporterEmail: "warga1@mail.com",
        assignedOfficerId: "",
        assignedOfficerName: "-",
        timeline: [
            { status: "Menunggu Verifikasi", date: "2026-10-23 07:45 WIB", actor: "Sistem", note: "Laporan masuk dalam antrean verifikasi Admin." }
        ],
        adminResponse: "",
        resolutionNotes: "",
        proofImage: ""
    }
];

// Akun demo untuk tombol pengujian cepat
const demoAccounts = {
    user:  { email: 'warga1@mail.com', password: 'lapor123' },
    admin: { email: 'admin@laportrack.id', password: 'lapor123' },
    field: { email: 'petugas@laportrack.id', password: 'lapor123' },
};

let currentUser = null;
let cachedReports = [];

// =========================================================================
// 2. CEK KONEKSI DATABASE MYSQL & SINKRONISASI
// =========================================================================
async function checkDatabaseConnection() {
    const badge = document.getElementById('db-status-badge');
    
    // Coba koneksi ke endpoint status
    const candidates = [
        API_BASE,
        'http://localhost/laportrack-backend/api',
        'http://localhost/Lapor_Track/api',
        'http://localhost:8000/api',
        './api'
    ];

    for (const url of candidates) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${url}/auth.php?action=status`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    window.API_BASE_URL = url;
                    isOnlineDb = true;
                    if (badge) {
                        badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50';
                        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> MySQL: Terhubung (laportrack_db)`;
                    }
                    // Muat daftar petugas lapangan dari database
                    loadOfficersFromDatabase();
                    return true;
                }
            }
        } catch (err) {
            // Lanjutkan ke kandidat berikutnya
        }
    }

    // Jika semua kandidat gagal
    isOnlineDb = false;
    if (badge) {
        badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-700/50';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> MySQL: Offline (XAMPP belum aktif)`;
        badge.title = 'Nyalakan Apache & MySQL di XAMPP Control Panel untuk menyimpan ke database permanen.';
    }
    return false;
}

// Mengambil daftar petugas lapangan langsung dari tabel users di database
async function loadOfficersFromDatabase() {
    if (!isOnlineDb) return;
    try {
        const res = await fetch(`${window.API_BASE_URL || API_BASE}/auth.php?action=officers`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                fieldOfficersList = data.data;
            }
        }
    } catch (e) {
        console.warn("Gagal memuat daftar petugas dari database, menggunakan data default.");
    }
}

// =========================================================================
// 3. OPERASI DATA REPORTS (DATABASE MYSQL + LOCALSTORAGE FALLBACK)
// =========================================================================

// Mengambil seluruh laporan
async function fetchReportsAsync() {
    if (isOnlineDb) {
        try {
            const res = await fetch(`${window.API_BASE_URL || API_BASE}/reports.php`);
            if (res.ok) {
                const result = await res.json();
                if (result.success && Array.isArray(result.data)) {
                    cachedReports = result.data;
                    return cachedReports;
                }
            }
        } catch (err) {
            console.warn("Fetch reports database gagal, beralih ke cache lokal:", err);
        }
    }

    // Fallback ke localStorage
    const stored = localStorage.getItem('laportrack_v13_db');
    if (!stored) {
        localStorage.setItem('laportrack_v13_db', JSON.stringify(defaultReports));
        cachedReports = defaultReports;
    } else {
        cachedReports = JSON.parse(stored);
    }
    return cachedReports;
}

function getReports() {
    return cachedReports.length > 0 ? cachedReports : defaultReports;
}

function saveReportsLocal(data) {
    cachedReports = data;
    localStorage.setItem('laportrack_v13_db', JSON.stringify(data));
}

// Reset data laporan ke default
async function resetDataToDefault() {
    if (isOnlineDb) {
        try {
            const res = await fetch(`${window.API_BASE_URL || API_BASE}/reports.php?action=reset`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                await fetchReportsAsync();
                renderCurrentView();
                showToast(data.message || "Data database MySQL berhasil direset ke kondisi default!");
                return;
            }
        } catch (e) {
            console.error("Gagal reset data ke database:", e);
        }
    }

    saveReportsLocal(defaultReports);
    renderCurrentView();
    showToast("Data simulasi lokal berhasil direset ke kondisi default!");
}

// =========================================================================
// 4. OTENTIKASI & LOGIN (TABEL users)
// =========================================================================
function fillDemoLogin(role) {
    document.getElementById('login-role').value = role;
    document.getElementById('login-email').value = demoAccounts[role].email;
    document.getElementById('login-password').value = demoAccounts[role].password;
    document.getElementById('login-error').classList.add('hidden');
}

async function loginFromPage(event) {
    event.preventDefault();
    const role = document.getElementById('login-role').value;
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    // 1. Coba verifikasi dengan Database MySQL via API
    if (isOnlineDb) {
        try {
            const res = await fetch(`${window.API_BASE_URL || API_BASE}/auth.php?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role })
            });
            const data = await res.json();

            if (!data.success) {
                errorEl.textContent = data.message || 'Login gagal. Periksa kembali kredensial Anda.';
                errorEl.classList.remove('hidden');
                return;
            }

            // Berhasil login dari database users
            currentUser = data.user;
            showToast(`Masuk sebagai ${currentUser.name} (Tabel Users MySQL)`);
            finishLogin(role);
            return;
        } catch (err) {
            console.warn("Gagal menghubungi server otentikasi database, mencoba pengecekan lokal:", err);
        }
    }

    // 2. Fallback pengecekan manual jika MySQL offline
    const account = demoAccounts[role];
    if (!account || email !== account.email || password !== account.password) {
        errorEl.textContent = 'Email atau password tidak sesuai. Jika MySQL belum aktif, gunakan kredensial akun demo di bawah.';
        errorEl.classList.remove('hidden');
        return;
    }

    if (role === 'user') {
        currentUser = { role: 'user', name: 'Warga Pelapor', email: account.email };
    } else if (role === 'admin') {
        currentUser = { role: 'admin', name: 'Admin Central PUPR/Dishub', email: account.email };
    } else if (role === 'field') {
        currentUser = { role: 'field', officerId: 'FO-01', name: 'Budi Santoso', dept: 'Dinas PUPR', email: account.email };
    }

    showToast(`Masuk sebagai ${currentUser.name} (Mode Simulasi)`);
    finishLogin(role);
}

function finishLogin(role) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    updateAuthUI();

    const destination = role === 'admin' ? 'admin' : role === 'field' ? 'field' : 'home';
    try {
        switchView(destination);
    } catch (err) {
        console.error('Gagal membuka dashboard:', err);
        switchView('home');
    }
}

function loginAs(role) {
    if (role === 'user') {
        currentUser = { role: 'user', name: 'Warga Pelapor', email: 'warga1@mail.com' };
    } else if (role === 'admin') {
        currentUser = { role: 'admin', name: 'Admin Central PUPR/Dishub' };
    } else if (role === 'field') {
        currentUser = { role: 'field', officerId: 'FO-01', name: 'Budi Santoso', dept: 'Dinas PUPR' };
    }
    toggleLoginModal(false);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    updateAuthUI();
    showToast(`Masuk sebagai ${currentUser.name}`);

    if (role === 'admin') switchView('admin');
    else if (role === 'field') switchView('field');
    else switchView('home');
}

function logout() {
    currentUser = null;
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-form').reset();
    document.getElementById('login-error').classList.add('hidden');
    updateAuthUI();
    activeViewName = 'home';
}

function toggleLoginModal(show) {
    document.getElementById('login-modal').classList.toggle('hidden', !show);
}

function updateAuthUI() {
    const container = document.getElementById('auth-actions-container');
    const badge = document.getElementById('current-user-badge');
    
    const adminBtn = document.getElementById('nav-admin');
    const fieldBtn = document.getElementById('nav-field');
    const myRepBtn = document.getElementById('nav-my-reports');

    if (!currentUser) {
        badge.innerText = "Status: Anonim (Tamu)";
        container.innerHTML = `
            <button onclick="toggleLoginModal(true)" class="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5">
                <i class="fa-solid fa-right-to-bracket text-slate-400"></i> Masuk / Login
            </button>
        `;
        adminBtn.classList.add('hidden');
        fieldBtn.classList.add('hidden');
        myRepBtn.classList.add('hidden');
    } else {
        badge.innerText = `Akun: ${currentUser.name} (${currentUser.role.toUpperCase()})`;
        container.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-civic-900 bg-civic-50 border border-civic-200 px-2.5 py-1 rounded-lg">
                    <i class="fa-solid fa-circle-user mr-1"></i> ${currentUser.name}
                </span>
                <button onclick="logout()" class="p-2 text-slate-400 hover:text-red-600 text-xs" title="Keluar">
                    <i class="fa-solid fa-power-off"></i>
                </button>
            </div>
        `;

        adminBtn.classList.toggle('hidden', currentUser.role !== 'admin');
        fieldBtn.classList.toggle('hidden', currentUser.role !== 'field');
        myRepBtn.classList.toggle('hidden', currentUser.role !== 'user');
    }
}

// =========================================================================
// 5. NAVIGASI VIEW & DASHBOARD UTAMA
// =========================================================================
let activeViewName = 'home';

async function switchView(viewName) {
    activeViewName = viewName;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const viewEl = document.getElementById(`view-${viewName}`);
    if (viewEl) viewEl.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-civic-900', 'bg-slate-100');
        btn.classList.add('text-slate-600');
    });
    const activeNav = document.getElementById(`nav-${viewName}`);
    if (activeNav) {
        activeNav.classList.remove('text-slate-600');
        activeNav.classList.add('text-civic-900', 'bg-slate-100');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    await renderCurrentView();
}

async function renderCurrentView() {
    await fetchReportsAsync();
    if (activeViewName === 'home') renderHomeDashboard();
    if (activeViewName === 'admin') renderAdminTable();
    if (activeViewName === 'field') renderFieldTasks();
    if (activeViewName === 'my-reports') renderMyReports();
}

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
}

function getStatusBadge(status) {
    switch (status) {
        case 'Menunggu Verifikasi':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"><i class="fa-solid fa-hourglass-start text-[9px]"></i> Menunggu</span>`;
        case 'Diproses':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1"><i class="fa-solid fa-spinner text-[9px]"></i> Diproses</span>`;
        case 'Menunggu Informasi dari Pelapor':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1"><i class="fa-solid fa-circle-question text-[9px]"></i> Butuh Info</span>`;
        case 'Selesai':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-circle-check text-[9px]"></i> Selesai</span>`;
        default:
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">${status}</span>`;
    }
}

function renderHomeDashboard() {
    const reports = getReports();
    document.getElementById('stat-total').innerText = reports.length;
    document.getElementById('stat-pending').innerText = reports.filter(r => r.status === 'Menunggu Verifikasi').length;
    document.getElementById('stat-process').innerText = reports.filter(r => r.status === 'Diproses').length;
    document.getElementById('stat-info').innerText = reports.filter(r => r.status === 'Menunggu Informasi dari Pelapor').length;
    document.getElementById('stat-done').innerText = reports.filter(r => r.status === 'Selesai').length;

    renderHomeReports();
}

function renderHomeReports() {
    const reports = getReports();
    const search = (document.getElementById('public-search')?.value || '').toLowerCase();
    const categoryFilter = document.getElementById('public-category-filter')?.value || '';
    const grid = document.getElementById('home-reports-grid');
    if (!grid) return;

    const filtered = reports.filter(r => {
        const matchesSearch = (r.title || '').toLowerCase().includes(search) || 
                              (r.location || '').toLowerCase().includes(search) || 
                              (r.id || '').toLowerCase().includes(search);
        const matchesCategory = categoryFilter === "" || r.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">Tidak ada laporan publik yang cocok.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(r => `
        <div class="bg-white rounded-xl border border-slate-200 p-5 hover:border-civic-900 transition shadow-sm flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="font-mono text-[11px] font-bold text-slate-500">${r.id}</span>
                    ${getStatusBadge(r.status)}
                </div>
                <h3 class="font-bold text-slate-900 text-sm mb-1 line-clamp-1">${r.title}</h3>
                <p class="text-slate-500 text-xs line-clamp-2 mb-3 leading-relaxed">${r.description}</p>
            </div>

            <div class="pt-3 border-t border-slate-100 space-y-2">
                <div class="flex items-center justify-between text-[11px] text-slate-500">
                    <span class="truncate"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i> ${r.location}</span>
                    <span class="shrink-0 font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">${r.agency || 'Dinas Terkait'}</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span class="text-slate-400"><i class="fa-regular fa-calendar mr-1"></i> ${r.date}</span>
                    <button onclick="viewReportDetail('${r.id}')" class="text-civic-900 font-bold hover:underline">
                        Cek Progres →
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// =========================================================================
// 6. FORMULIR PENGIRIMAN LAPORAN (TABEL reports & report_timelines)
// =========================================================================
let uploadedFileSim = null;

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        uploadedFileSim = file;
        document.getElementById('file-preview-display').innerText = `Berkas Terpilih: ${file.name}`;
    }
}

async function handleReportSubmit(e) {
    e.preventDefault();

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomCode = '';
    for (let i = 0; i < 4; i++) randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    const generatedId = `LPR-2026-${randomCode}`;

    const title = document.getElementById('rep-title').value;
    const category = document.getElementById('rep-category').value;
    const agency = document.getElementById('rep-agency').value;
    const location = document.getElementById('rep-location').value;
    const description = document.getElementById('rep-desc').value;
    const reporterEmail = currentUser ? currentUser.email : "anonim@mail.com";
    const actorName = currentUser ? currentUser.name : "Masyarakat";

    // 1. Simpan ke Database MySQL jika online
    if (isOnlineDb) {
        try {
            const formData = new FormData();
            formData.append('id', generatedId);
            formData.append('title', title);
            formData.append('category', category);
            formData.append('agency', agency);
            formData.append('location', location);
            formData.append('description', description);
            formData.append('reporterEmail', reporterEmail);
            formData.append('actorName', actorName);
            formData.append('date', new Date().toISOString().split('T')[0]);

            if (uploadedFileSim) {
                formData.append('image_file', uploadedFileSim);
            } else {
                formData.append('image', '');
            }

            const res = await fetch(`${window.API_BASE_URL || API_BASE}/reports.php?action=create`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                showSuccessModal(generatedId);
                document.getElementById('report-form').reset();
                uploadedFileSim = null;
                document.getElementById('file-preview-display').innerText = '';
                showToast("Laporan berhasil disimpan permanen ke database MySQL!");
                await fetchReportsAsync();
                return;
            }
        } catch (err) {
            console.warn("Gagal simpan ke database, fallback simpan lokal:", err);
        }
    }

    // 2. Fallback simpan lokal jika MySQL offline
    const reports = getReports();
    const newReport = {
        id: generatedId,
        title: title,
        category: category,
        agency: agency,
        location: location,
        date: new Date().toISOString().split('T')[0],
        status: "Menunggu Verifikasi",
        description: description,
        image: uploadedFileSim ? "https://placehold.co/600x400/1e3a8a/ffffff?text=Foto+Bukti+Laporan" : "",
        reporterEmail: reporterEmail,
        assignedOfficerId: "",
        assignedOfficerName: "-",
        timeline: [
            { status: "Menunggu Verifikasi", date: new Date().toLocaleDateString('id-ID') + ' WIB', actor: actorName, note: "Laporan dikirimkan ke sistem." }
        ],
        adminResponse: "",
        resolutionNotes: "",
        proofImage: "",
    };

    reports.unshift(newReport);
    saveReportsLocal(reports);

    showSuccessModal(generatedId);
    document.getElementById('report-form').reset();
    uploadedFileSim = null;
    document.getElementById('file-preview-display').innerText = '';
}

function showSuccessModal(id) {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="text-center">
            <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl mx-auto mb-3">
                <i class="fa-solid fa-check"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-1">Laporan Berhasil Diterbitkan</h3>
            <p class="text-slate-500 text-xs mb-4">Simpan ID Referensi Unik berikut untuk melacak perkembangan penanganan:</p>
            
            <div class="bg-slate-100 p-3 rounded-lg border border-slate-200 mb-5 flex items-center justify-between">
                <span class="font-mono text-xl font-bold text-civic-900">${id}</span>
                <button onclick="copyToClipboard('${id}')" class="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded font-semibold hover:bg-slate-50">
                    <i class="fa-regular fa-copy"></i> Salin
                </button>
            </div>

            <div class="flex gap-2">
                <button onclick="closeModal(); presetTrack('${id}'); switchView('track');" class="flex-1 bg-civic-900 hover:bg-civic-800 text-white font-semibold py-2 px-3 rounded-lg text-xs">
                    Lacak Laporan Ini
                </button>
                <button onclick="closeModal(); switchView('home');" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-lg text-xs">
                    Ke Beranda
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
}

function copyToClipboard(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast("ID Referensi disalin ke clipboard!");
}

// =========================================================================
// 7. PELACAKAN STATUS & AUDIT TIMELINE (TABEL report_timelines)
// =========================================================================
function presetTrack(id) {
    document.getElementById('track-input').value = id;
    handleTrackSearch();
}

async function handleTrackSearch() {
    const inputVal = document.getElementById('track-input').value.trim().toUpperCase();
    const container = document.getElementById('track-result-container');

    if (!inputVal) {
        container.innerHTML = `<div class="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">Silakan masukkan ID referensi laporan.</div>`;
        container.classList.remove('hidden');
        return;
    }

    // 1. Ambil detail laporan langsung dari MySQL jika online
    if (isOnlineDb) {
        try {
            const res = await fetch(`${window.API_BASE_URL || API_BASE}/reports.php?id=${encodeURIComponent(inputVal)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    container.innerHTML = renderReportDetailCard(data.data);
                    container.classList.remove('hidden');
                    return;
                }
            }
        } catch (err) {
            console.warn("Gagal melacak via database, beralih ke cache lokal:", err);
        }
    }

    // 2. Fallback pencarian lokal
    const reports = getReports();
    const report = reports.find(r => r.id === inputVal);

    if (!report) {
        container.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold">Nomor laporan <strong>${inputVal}</strong> tidak ditemukan.</div>`;
        container.classList.remove('hidden');
        return;
    }

    container.innerHTML = renderReportDetailCard(report);
    container.classList.remove('hidden');
}

function viewReportDetail(id) {
    switchView('track');
    document.getElementById('track-input').value = id;
    handleTrackSearch();
}

function renderReportDetailCard(report) {
    const timelineList = Array.isArray(report.timeline) ? report.timeline : [];

    return `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="border-b border-slate-200 p-5 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-xs font-bold text-civic-900 bg-civic-50 px-2 py-0.5 rounded border border-civic-100">${report.id}</span>
                        <span class="text-xs text-slate-500">${report.date}</span>
                    </div>
                    <h2 class="text-lg font-bold text-slate-900 mt-1">${report.title}</h2>
                </div>
                <div>${getStatusBadge(report.status)}</div>
            </div>

            <div class="p-5 space-y-6">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <div>
                        <span class="text-slate-400 block text-[10px] font-bold uppercase">Lokasi Kejadian</span>
                        <p class="text-slate-800 font-medium mt-0.5"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i> ${report.location}</p>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[10px] font-bold uppercase">Instansi</span>
                        <p class="text-slate-800 font-medium mt-0.5"><i class="fa-solid fa-building text-slate-400 mr-1"></i> ${report.agency || 'Dinas Terkait'}</p>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[10px] font-bold uppercase">Petugas Terdisposisi</span>
                        <p class="text-slate-800 font-medium mt-0.5"><i class="fa-solid fa-hard-hat text-amber-500 mr-1"></i> ${report.assignedOfficerName || 'Belum Ditugaskan'}</p>
                    </div>
                </div>

                <div>
                    <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Rincian Deskripsi</h4>
                    <p class="text-slate-600 text-xs leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100">${report.description}</p>
                </div>

                ${report.image ? `
                    <div>
                        <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Lampiran Foto Lapangan</h4>
                        <img src="${report.image}" alt="Foto Kerusakan" class="rounded-lg max-h-52 object-cover border border-slate-200">
                    </div>
                ` : ''}

                <!-- Response Box -->
                <div class="bg-civic-50/60 border border-civic-200 p-4 rounded-lg">
                    <span class="text-xs font-bold text-civic-900 flex items-center gap-1.5 mb-1">
                        <i class="fa-solid fa-user-shield"></i> Tanggapan Resmi Administrator Web
                    </span>
                    <p class="text-slate-700 text-xs leading-relaxed">
                        ${report.adminResponse || 'Belum ada tanggapan resmi dari Admin.'}
                    </p>
                </div>

                <!-- Completion Proof -->
                ${report.status === 'Selesai' ? `
                    <div class="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-3">
                        <span class="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-check"></i> Bukti Penyelesaian Pekerjaan Fisik (Petugas Lapangan)
                        </span>
                        <p class="text-slate-700 text-xs">${report.resolutionNotes || 'Penanganan fisik telah dinyatakan rampung.'}</p>
                        ${report.proofImage ? `
                            <img src="${report.proofImage}" alt="Bukti Perbaikan" class="rounded-lg max-h-48 object-cover border border-emerald-200">
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Audit Progress Timeline (Tersinkron dengan report_timelines) -->
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Timeline Penanganan Audit (Real-Time)</h4>
                        <span class="text-[10px] text-slate-400 font-medium">Tersimpan di tabel report_timelines</span>
                    </div>
                    <div class="border-l-2 border-slate-200 pl-4 space-y-4 ml-1">
                        ${timelineList.length > 0 ? timelineList.map(t => `
                            <div class="relative">
                                <div class="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-civic-900 ring-4 ring-white"></div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-bold text-slate-900">${t.status}</span>
                                    <span class="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded">${t.actor || 'Sistem'}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">${t.date}</span>
                                </div>
                                <p class="text-xs text-slate-600 mt-0.5">${t.note}</p>
                            </div>
                        `).join('') : '<p class="text-xs text-slate-400 italic">Belum ada catatan riwayat timeline.</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =========================================================================
// 8. DASHBOARD ADMIN DISPATCHER (DISPOSISI & UPDATE STATUS)
// =========================================================================
function renderAdminTable() {
    const reports = getReports();
    const search = (document.getElementById('admin-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('admin-filter-status')?.value || '';
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    const filtered = reports.filter(r => {
        const matchesSearch = (r.id || '').toLowerCase().includes(search) || 
                              (r.title || '').toLowerCase().includes(search) || 
                              (r.location || '').toLowerCase().includes(search);
        const matchesStatus = statusFilter === "" || r.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const countLabel = document.getElementById('admin-count-label');
    if (countLabel) countLabel.innerText = `Menampilkan ${filtered.length} dari ${reports.length} laporan`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 text-xs font-medium">Tidak ada data aduan.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(r => `
        <tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-mono font-bold text-slate-900">${r.id}<br><span class="text-[10px] font-normal text-slate-400 font-sans">${r.date}</span></td>
            <td class="py-3 px-4">
                <span class="font-bold text-slate-800 block line-clamp-1">${r.title}</span>
                <span class="text-[10px] font-semibold text-slate-500">${r.category} • ${r.location}</span>
            </td>
            <td class="py-3 px-4 text-xs font-medium text-slate-700">
                <span class="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-bold text-[11px]">
                    <i class="fa-solid fa-hard-hat mr-1 text-amber-600"></i> ${r.assignedOfficerName || 'Belum Ditugaskan'}
                </span>
            </td>
            <td class="py-3 px-4">${getStatusBadge(r.status)}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="openAdminModal('${r.id}')" class="bg-civic-900 hover:bg-civic-800 text-white font-semibold px-3 py-1 rounded text-xs transition">
                    Disposisi & Kelola
                </button>
            </td>
        </tr>
    `).join('');
}

function openAdminModal(id) {
    const reports = getReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div>
                <span class="text-xs font-mono font-bold text-civic-900">${report.id}</span>
                <h3 class="font-bold text-base text-slate-900">Kelola Disposisi Admin Dispatcher</h3>
            </div>
            <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form onsubmit="handleAdminUpdate(event, '${report.id}')" class="space-y-3.5">
            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Status Utama Laporan</label>
                <select id="admin-up-status" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-civic-900 bg-white">
                    <option value="Menunggu Verifikasi" ${report.status === 'Menunggu Verifikasi' ? 'selected' : ''}>Menunggu Verifikasi</option>
                    <option value="Diproses" ${report.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                    <option value="Menunggu Informasi dari Pelapor" ${report.status === 'Menunggu Informasi dari Pelapor' ? 'selected' : ''}>Menunggu Informasi dari Pelapor</option>
                    <option value="Selesai" ${report.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                </select>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Tugaskan Petugas Lapangan (Field Officer)</label>
                <select id="admin-up-officer" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-civic-900 bg-white">
                    <option value="">-- Belum Ditugaskan --</option>
                    ${fieldOfficersList.map(o => `
                        <option value="${o.id}" ${report.assignedOfficerId === o.id ? 'selected' : ''}>${o.name} (${o.dept})</option>
                    `).join('')}
                </select>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Tanggapan Publik Admin</label>
                <textarea id="admin-up-response" rows="3" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-civic-900" placeholder="Berikan instruksi atau tanggapan resmi...">${report.adminResponse || ''}</textarea>
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onclick="closeModal()" class="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold">Batal</button>
                <button type="submit" class="px-4 py-1.5 rounded-lg bg-civic-900 hover:bg-civic-800 text-white text-xs font-semibold">Simpan Disposisi</button>
            </div>
        </form>
    `;
    modal.classList.remove('hidden');
}

async function handleAdminUpdate(e, id) {
    e.preventDefault();

    const newStatus = document.getElementById('admin-up-status').value;
    const newOfficerId = document.getElementById('admin-up-officer').value;
    const newResponse = document.getElementById('admin-up-response').value;

    const officerObj = fieldOfficersList.find(o => o.id === newOfficerId);
    const officerName = officerObj ? officerObj.name : '-';

    // 1. Simpan update ke database MySQL via API
    if (isOnlineDb) {
        try {
            const res = await fetch(`${window.API_BASE_URL || API_BASE}/reports.php?action=admin_update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    status: newStatus,
                    assignedOfficerId: newOfficerId,
                    assignedOfficerName: officerName,
                    adminResponse: newResponse
                })
            });
            const data = await res.json();
            if (data.success) {
                closeModal();
                showToast(`Disposisi laporan ${id} berhasil dicatat ke timeline MySQL!`);
                await fetchReportsAsync();
                renderAdminTable();
                return;
            }
        } catch (err) {
            console.warn("Gagal update admin ke database, beralih ke penyimpanan lokal:", err);
        }
    }

    // 2. Fallback simpan lokal
    const reports = getReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;

    report.status = newStatus;
    report.adminResponse = newResponse;
    report.assignedOfficerId = newOfficerId;
    report.assignedOfficerName = officerName;

    const timeNow = new Date().toLocaleDateString('id-ID') + ' WIB';
    report.timeline.push({
        status: newStatus,
        date: timeNow,
        actor: "Admin Dispatcher",
        note: officerObj ? `Disposisi tugas ke Petugas Lapangan: ${officerName}` : `Status diperbarui ke ${newStatus}`
    });

    saveReportsLocal(reports);
    closeModal();
    renderAdminTable();
    showToast(`Laporan ${id} berhasil diperbarui (Simulasi Lokal)!`);
}

// =========================================================================
// 9. TUGAS PETUGAS LAPANGAN (UPDATE PROGRES & BUKTI FISIK)
// =========================================================================
function renderFieldTasks() {
    const reports = getReports();
    const container = document.getElementById('field-tasks-container');
    if (!container) return;

    const assignedTasks = reports.filter(r => r.assignedOfficerId === 'FO-01' || r.status === 'Diproses');

    const titleEl = document.getElementById('field-officer-name-title');
    if (titleEl) {
        titleEl.innerText = `Tugas Lapangan — ${currentUser ? currentUser.name : 'Budi Santoso'}`;
    }

    if (assignedTasks.length === 0) {
        container.innerHTML = `<div class="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-400 text-xs font-medium">Tidak ada tugas perbaikan lapangan aktif saat ini.</div>`;
        return;
    }

    container.innerHTML = assignedTasks.map(task => `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <span class="font-mono text-xs font-bold text-civic-900">${task.id}</span>
                ${getStatusBadge(task.status)}
            </div>

            <div>
                <h3 class="font-bold text-slate-900 text-sm">${task.title}</h3>
                <p class="text-xs text-slate-600 mt-1"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i> ${task.location}</p>
                <p class="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded border border-slate-100">${task.description}</p>
            </div>

            <div class="flex items-center justify-between pt-2">
                <span class="text-[11px] text-slate-400">Instansi: <strong>${task.agency}</strong></span>
                <button onclick="openFieldUpdateModal('${task.id}')" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5">
                    <i class="fa-solid fa-pen-to-square"></i> Update Progres / Selesaikan
                </button>
            </div>
        </div>
    `).join('');
}

function openFieldUpdateModal(id) {
    const reports = getReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div>
                <span class="text-xs font-mono font-bold text-amber-700">${report.id}</span>
                <h3 class="font-bold text-base text-slate-900">Catatan Teknisi Lapangan</h3>
            </div>
            <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form onsubmit="handleFieldUpdate(event, '${report.id}')" class="space-y-3.5">
            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Status Progres Pekerjaan</label>
                <select id="field-up-status" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white">
                    <option value="Diproses" ${report.status === 'Diproses' ? 'selected' : ''}>Sedang Dikerjakan (Diproses)</option>
                    <option value="Selesai">Pekerjaan Rampung (Selesai)</option>
                </select>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Catatan Progres Lapangan</label>
                <textarea id="field-up-note" required rows="3" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="Contoh: Material aspal sudah datang, sedang proses perataan jalan..."></textarea>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Unggah Bukti Hasil Perbaikan (Foto Selesai)</label>
                <input type="file" id="field-up-file" accept="image/*" class="text-xs text-slate-500">
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onclick="closeModal()" class="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold">Batal</button>
                <button type="submit" class="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">Simpan Lapangan</button>
            </div>
        </form>
    `;
    modal.classList.remove('hidden');
}

async function handleFieldUpdate(e, id) {
    e.preventDefault();

    const newStatus = document.getElementById('field-up-status').value;
    const noteText = document.getElementById('field-up-note').value;
    const fileInput = document.getElementById('field-up-file');
    const selectedFile = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

    // 1. Simpan update ke database MySQL via API
    if (isOnlineDb) {
        try {
            const formData = new FormData();
            formData.append('id', id);
            formData.append('status', newStatus);
            formData.append('resolutionNotes', noteText);
            if (selectedFile) {
                formData.append('proof_file', selectedFile);
            }

            const res = await fetch(`${window.API_BASE_URL || API_BASE}/reports.php?action=field_update`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                closeModal();
                showToast("Update teknisi lapangan berhasil dicatat di database MySQL!");
                await fetchReportsAsync();
                renderFieldTasks();
                return;
            }
        } catch (err) {
            console.warn("Gagal update petugas lapangan ke database, beralih ke lokal:", err);
        }
    }

    // 2. Fallback simpan lokal
    const reports = getReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;

    report.status = newStatus;
    if (newStatus === 'Selesai') {
        report.resolutionNotes = noteText;
        report.proofImage = "https://placehold.co/600x400/059669/ffffff?text=Foto+Bukti+Pekerjaan+Selesai";
    }

    const timeNow = new Date().toLocaleDateString('id-ID') + ' WIB';
    report.timeline.push({
        status: newStatus,
        date: timeNow,
        actor: "Petugas Lapangan",
        note: noteText
    });

    saveReportsLocal(reports);
    closeModal();
    renderFieldTasks();
    showToast("Update teknisi lapangan berhasil tersimpan (Simulasi Lokal)!");
}

// =========================================================================
// 10. RIWAYAT LAPORAN SAYA (BERDASARKAN reporterEmail)
// =========================================================================
function renderMyReports() {
    const reports = getReports();
    const grid = document.getElementById('my-reports-grid');
    if (!grid) return;

    const myEmail = currentUser ? currentUser.email : "warga1@mail.com";
    const myData = reports.filter(r => r.reporterEmail === myEmail);

    if (myData.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">Anda belum pernah mengirim aduan.</div>`;
        return;
    }

    grid.innerHTML = myData.map(r => `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <span class="font-mono text-xs font-bold text-civic-900">${r.id}</span>
                ${getStatusBadge(r.status)}
            </div>
            <h3 class="font-bold text-slate-900 text-sm">${r.title}</h3>
            <p class="text-xs text-slate-500">${r.description}</p>
            <button onclick="viewReportDetail('${r.id}')" class="text-xs font-bold text-civic-900 hover:underline pt-2 block">
                Cek Lacak Detail →
            </button>
        </div>
    `).join('');
}

// =========================================================================
// 11. NOTIFIKASI TOAST & INISIALISASI
// =========================================================================
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-lg flex items-center gap-2 border border-slate-800 animate-bounce`;
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('animate-bounce');
        setTimeout(() => toast.remove(), 2500);
    }, 1000);
}

window.onload = async function() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    
    // Periksa koneksi ke Database MySQL
    await checkDatabaseConnection();
    
    updateAuthUI();
    await renderCurrentView();
};
