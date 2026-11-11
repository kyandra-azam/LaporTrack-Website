<?php
/**
 * LaporTrack - Endpoint Otentikasi & Pengguna (users)
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// ----------------------------------------------------
// 1. CEK KONEKSI / STATUS
// ----------------------------------------------------
if ($method === 'GET' && $action === 'status') {
    sendJsonResponse([
        'success' => true,
        'message' => 'Database MySQL terhubung',
        'database' => DB_NAME,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}

// ----------------------------------------------------
// 2. DAFTAR PETUGAS LAPANGAN (role: field)
// ----------------------------------------------------
if ($method === 'GET' && $action === 'officers') {
    try {
        $stmt = $pdo->query("SELECT officer_id AS id, name, dept FROM users WHERE role = 'field' AND officer_id IS NOT NULL ORDER BY officer_id ASC");
        $officers = $stmt->fetchAll();
        sendJsonResponse([
            'success' => true,
            'data' => $officers
        ]);
    } catch (Exception $e) {
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

// ----------------------------------------------------
// 3. LOGIN PENGGUNA (Menggunakan tabel users & password_verify)
// ----------------------------------------------------
if ($method === 'POST' && ($action === 'login' || empty($action))) {
    $input = getRequestBody();
    $email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
    $password = isset($input['password']) ? $input['password'] : '';
    $role = isset($input['role']) ? trim($input['role']) : '';

    if (empty($email) || empty($password)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Email dan password wajib diisi.'
        ], 400);
    }

    try {
        $stmt = $pdo->prepare("SELECT id, name, email, password, role, officer_id, dept FROM users WHERE LOWER(email) = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Email tidak terdaftar dalam database.'
            ], 401);
        }

        // Verifikasi password yang di-hash menggunakan bcrypt
        if (!password_verify($password, $user['password'])) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Password salah. Silakan periksa kembali.'
            ], 401);
        }

        // Jika opsi role dipilih, pastikan role sesuai
        if (!empty($role) && $user['role'] !== $role) {
            sendJsonResponse([
                'success' => false,
                'message' => "Akun ini terdaftar sebagai role '{$user['role']}', bukan '{$role}'."
            ], 403);
        }

        // Hapus password dari objek respon demi keamanan
        unset($user['password']);

        // Format user object
        $userPayload = [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'officerId' => $user['officer_id'],
            'dept' => $user['dept']
        ];

        sendJsonResponse([
            'success' => true,
            'message' => "Selamat datang, {$user['name']}!",
            'user' => $userPayload
        ]);
    } catch (Exception $e) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Kesalahan server saat login: ' . $e->getMessage()
        ], 500);
    }
}

// ----------------------------------------------------
// 4. REGISTER PENGGUNA BARU (Opsional / Pendaftaran Warga)
// ----------------------------------------------------
if ($method === 'POST' && $action === 'register') {
    $input = getRequestBody();
    $name = isset($input['name']) ? trim($input['name']) : '';
    $email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
    $password = isset($input['password']) ? $input['password'] : '';
    $role = isset($input['role']) ? trim($input['role']) : 'user';

    if (empty($name) || empty($email) || empty($password)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Nama, email, dan password wajib diisi.'
        ], 400);
    }

    try {
        // Cek apakah email sudah terdaftar
        $check = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1");
        $check->execute([$email]);
        if ($check->fetch()) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Email sudah terdaftar. Silakan gunakan email lain atau langsung login.'
            ], 409);
        }

        $hashed = password_hash($password, PASSWORD_BCRYPT);
        $insert = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
        $insert->execute([$name, $email, $hashed, $role]);

        $newId = $pdo->lastInsertId();

        sendJsonResponse([
            'success' => true,
            'message' => 'Pendaftaran akun berhasil.',
            'user' => [
                'id' => (int)$newId,
                'name' => $name,
                'email' => $email,
                'role' => $role
            ]
        ], 201);
    } catch (Exception $e) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Gagal mendaftarkan akun: ' . $e->getMessage()
        ], 500);
    }
}

sendJsonResponse(['success' => false, 'message' => 'Action tidak dikenali.'], 404);

