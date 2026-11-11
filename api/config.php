<?php
/**
 * LaporTrack - Konfigurasi Database & Helper API
 */

// Header CORS agar API dapat diakses dari browser, Live Server, maupun domain lain
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Konfigurasi Kredensial MySQL (Default XAMPP)
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'laportrack_db');

/**
 * Mendapatkan koneksi PDO ke MySQL dengan auto-migration jika database belum ada
 */
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsnWithDb = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO($dsnWithDb, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // Jika database belum ada, coba koneksi ke server MySQL dan inisialisasi otomatis
        try {
            $dsnWithoutDb = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";charset=utf8mb4";
            $rootPdo = new PDO($dsnWithoutDb, DB_USER, DB_PASS, $options);
            $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            
            // Sekarang hubungkan ke database baru
            $pdo = new PDO($dsnWithDb, DB_USER, DB_PASS, $options);
            
            // Jalankan inisialisasi tabel dan data awal
            initDatabaseTables($pdo);
        } catch (Exception $initErr) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Gagal terhubung ke MySQL: ' . $initErr->getMessage(),
                'hint' => 'Pastikan MySQL di XAMPP Control Panel sudah dalam status START.'
            ], 500);
        }
    }

    // Pastikan tabel sudah ada
    ensureTablesExist($pdo);

    return $pdo;
}

/**
 * Memastikan tabel users, reports, dan report_timelines sudah dibuat
 */
function ensureTablesExist($pdo) {
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'reports'");
        if ($check->rowCount() === 0) {
            initDatabaseTables($pdo);
        }
    } catch (Exception $e) {
        // ignore
    }
}

/**
 * Inisialisasi tabel dan data default dari skema SQL
 */
function initDatabaseTables($pdo) {
    // 1. Tabel users
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `users` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(100) NOT NULL,
            `email` VARCHAR(150) NOT NULL UNIQUE,
            `password` VARCHAR(255) NOT NULL,
            `role` ENUM('user', 'admin', 'field') NOT NULL DEFAULT 'user',
            `officer_id` VARCHAR(50) NULL,
            `dept` VARCHAR(150) NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 2. Tabel reports
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `reports` (
            `id` VARCHAR(50) NOT NULL PRIMARY KEY,
            `title` VARCHAR(255) NOT NULL,
            `category` VARCHAR(100) NOT NULL,
            `agency` VARCHAR(100) NOT NULL DEFAULT 'Dinas Terkait',
            `location` VARCHAR(255) NOT NULL,
            `date` DATE NOT NULL,
            `status` ENUM('Menunggu Verifikasi', 'Diproses', 'Menunggu Informasi dari Pelapor', 'Selesai') NOT NULL DEFAULT 'Menunggu Verifikasi',
            `description` TEXT NOT NULL,
            `image` TEXT NULL,
            `reporter_email` VARCHAR(150) NOT NULL,
            `assigned_officer_id` VARCHAR(50) NULL,
            `assigned_officer_name` VARCHAR(100) NULL,
            `admin_response` TEXT NULL,
            `resolution_notes` TEXT NULL,
            `proof_image` TEXT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_status` (`status`),
            INDEX `idx_reporter` (`reporter_email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 3. Tabel report_timelines
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `report_timelines` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `report_id` VARCHAR(50) NOT NULL,
            `status` VARCHAR(100) NOT NULL,
            `actor` VARCHAR(100) NOT NULL,
            `note` TEXT NOT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_timeline_report` (`report_id`),
            CONSTRAINT `fk_timeline_report` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Seed Akun Pengguna jika tabel kosong
    $userCount = $pdo->query("SELECT COUNT(*) FROM `users`")->fetchColumn();
    if ($userCount == 0) {
        $hash = password_hash('lapor123', PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO `users` (`name`, `email`, `password`, `role`, `officer_id`, `dept`) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute(['Warga Pelapor', 'warga1@mail.com', $hash, 'user', null, null]);
        $stmt->execute(['Admin Central PUPR/Dishub', 'admin@laportrack.id', $hash, 'admin', null, null]);
        $stmt->execute(['Budi Santoso', 'petugas@laportrack.id', $hash, 'field', 'FO-01', 'Dinas PUPR - Tim Jalan']);
        $stmt->execute(['Rahmat Hidayat', 'petugas2@laportrack.id', $hash, 'field', 'FO-02', 'Dinas Perhubungan - PJU']);
        $stmt->execute(['Agus Pratama', 'petugas3@laportrack.id', $hash, 'field', 'FO-03', 'Dinas LH - Kebersihan']);
    }

    // Seed Data Laporan jika tabel kosong
    $reportCount = $pdo->query("SELECT COUNT(*) FROM `reports`")->fetchColumn();
    if ($reportCount == 0) {
        seedDefaultReports($pdo);
    }
}

/**
 * Menyuntikkan 3 laporan awal default beserta timeline-nya
 */
function seedDefaultReports($pdo) {
    // Laporan 1
    $stmt = $pdo->prepare("
        INSERT INTO `reports` (`id`, `title`, `category`, `agency`, `location`, `date`, `status`, `description`, `image`, `reporter_email`, `assigned_officer_id`, `assigned_officer_name`, `admin_response`, `resolution_notes`, `proof_image`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        'LPR-2026-X8B9',
        'Jalan Berlubang dan Aspal Amblas',
        'Fasilitas Jalan',
        'Dinas PUPR',
        'Jl. Sudirman No. 45, Jakarta Selatan',
        '2026-10-21',
        'Diproses',
        'Terdapat lubang sedalam kurang lebih 15cm di lajur kiri dekat shelter busway. Membahayakan pengendara motor.',
        'https://placehold.co/600x400/1e3a8a/ffffff?text=Foto+Kerusakan+Jalan',
        'warga1@mail.com',
        'FO-01',
        'Budi Santoso',
        'Petugas lapangan Budi Santoso telah dijadwalkan membawa penambal aspal sore ini.',
        '',
        ''
    ]);

    // Laporan 2
    $stmt->execute([
        'LPR-2026-K72P',
        'Lampu Penerangan PJU Padam Total',
        'Lampu Penerangan',
        'Dinas Perhubungan',
        'Jl. Melati Raya Blok C3',
        '2026-10-20',
        'Selesai',
        'Dua titik lampu jalan pemukiman padam total sejak pekan lalu.',
        'https://placehold.co/600x400/0284c7/ffffff?text=Lampu+PJU+Mati',
        'warga2@mail.com',
        'FO-02',
        'Rahmat Hidayat',
        'Perbaikan telah rampung dilaksanakan oleh tim Dishub.',
        'Komponen trafo diganti dan 2 lampu LED PJU telah kembali menyala normal.',
        'https://placehold.co/600x400/059669/ffffff?text=Bukti+Lampu+Jalan+Menyala'
    ]);

    // Laporan 3
    $stmt->execute([
        'LPR-2026-M41Q',
        'Saluran Air Tersumbat Sampah Limbah Pasar',
        'Saluran Air',
        'Dinas Lingkungan Hidup',
        'Jl. Mawar Raya No. 12',
        '2026-10-23',
        'Menunggu Verifikasi',
        'Drainase tersumbat penumpukan kantong plastik dan lumpur tebal.',
        'https://placehold.co/600x400/4f46e5/ffffff?text=Got+Tersumbat',
        'warga1@mail.com',
        null,
        '-',
        '',
        '',
        ''
    ]);

    // Timeline Laporan
    $stmtT = $pdo->prepare("INSERT INTO `report_timelines` (`report_id`, `status`, `actor`, `note`, `created_at`) VALUES (?, ?, ?, ?, ?)");
    $stmtT->execute(['LPR-2026-X8B9', 'Menunggu Verifikasi', 'Sistem', 'Laporan diterima oleh portal LaporTrack.', '2026-10-21 08:30:00']);
    $stmtT->execute(['LPR-2026-X8B9', 'Diproses', 'Admin Dispatcher', 'Diverifikasi & ditugaskan ke Petugas Lapangan: Budi Santoso (Dinas PUPR).', '2026-10-21 11:15:00']);

    $stmtT->execute(['LPR-2026-K72P', 'Menunggu Verifikasi', 'Sistem', 'Laporan terdaftar.', '2026-10-20 09:10:00']);
    $stmtT->execute(['LPR-2026-K72P', 'Diproses', 'Admin Dispatcher', 'Penugasan ke Rahmat Hidayat (Dishub PJU).', '2026-10-20 13:00:00']);
    $stmtT->execute(['LPR-2026-K72P', 'Selesai', 'Petugas Lapangan', 'Pemasangan LED baru selesai dilaksanakan.', '2026-10-21 15:00:00']);

    $stmtT->execute(['LPR-2026-M41Q', 'Menunggu Verifikasi', 'Sistem', 'Laporan masuk dalam antrean verifikasi Admin.', '2026-10-23 07:45:00']);
}

/**
 * Mengirim respon JSON terstandar
 */
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Mengambil body JSON atau POST data
 */
function getRequestBody() {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            return array_merge($_POST, $json);
        }
    }
    return $_POST;
}

