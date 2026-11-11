<?php
/**
 * LaporTrack - Endpoint CRUD Laporan (reports) & Log Riwayat (report_timelines)
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

/**
 * Helper upload foto bukti laporan atau foto perbaikan
 */
function handleUploadFile($fileKey) {
    if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $file = $_FILES[$fileKey];
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!in_array(strtolower($file['type']), $allowedMimes)) {
        return null;
    }
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'proof_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . strtolower($ext);
    $targetDir = __DIR__ . '/uploads/';
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0777, true);
    }
    $dest = $targetDir . $filename;
    if (move_uploaded_file($file['tmp_name'], $dest)) {
        return 'api/uploads/' . $filename;
    }
    return null;
}

/**
 * Format tanggal timeline agar seragam dengan format WIB di frontend
 */
function formatWibDate($dateTimeStr) {
    $time = strtotime($dateTimeStr);
    return date('Y-m-d H:i', $time) . ' WIB';
}

// -------------------------------------------------------------------
// 1. GET: Ambil Laporan (Semua atau Satu berdasarkan ID)
// -------------------------------------------------------------------
if ($method === 'GET') {
    $reportId = isset($_GET['id']) ? trim($_GET['id']) : '';

    // Ambil detail SATU laporan beserta seluruh timelinenya
    if (!empty($reportId)) {
        $stmt = $pdo->prepare("SELECT * FROM reports WHERE id = ? LIMIT 1");
        $stmt->execute([$reportId]);
        $row = $stmt->fetch();

        if (!$row) {
            sendJsonResponse([
                'success' => false,
                'message' => "Laporan dengan ID {$reportId} tidak ditemukan."
            ], 404);
        }

        // Ambil timeline log untuk laporan ini dari tabel report_timelines
        $tStmt = $pdo->prepare("SELECT id, status, actor, note, created_at FROM report_timelines WHERE report_id = ? ORDER BY id ASC");
        $tStmt->execute([$reportId]);
        $timelineRows = $tStmt->fetchAll();

        $timeline = array_map(function($t) {
            return [
                'status' => $t['status'],
                'date' => formatWibDate($t['created_at']),
                'actor' => $t['actor'],
                'note' => $t['note']
            ];
        }, $timelineRows);

        $report = [
            'id' => $row['id'],
            'title' => $row['title'],
            'category' => $row['category'],
            'agency' => $row['agency'],
            'location' => $row['location'],
            'date' => $row['date'],
            'status' => $row['status'],
            'description' => $row['description'],
            'image' => $row['image'] ?: '',
            'reporterEmail' => $row['reporter_email'],
            'assignedOfficerId' => $row['assigned_officer_id'] ?: '',
            'assignedOfficerName' => $row['assigned_officer_name'] ?: '-',
            'adminResponse' => $row['admin_response'] ?: '',
            'resolutionNotes' => $row['resolution_notes'] ?: '',
            'proofImage' => $row['proof_image'] ?: '',
            'timeline' => $timeline
        ];

        sendJsonResponse([
            'success' => true,
            'data' => $report
        ]);
    }

    // Ambil DAFTAR laporan dengan filter opsional
    $category = isset($_GET['category']) ? trim($_GET['category']) : '';
    $status = isset($_GET['status']) ? trim($_GET['status']) : '';
    $officerId = isset($_GET['officerId']) ? trim($_GET['officerId']) : '';
    $reporterEmail = isset($_GET['reporterEmail']) ? trim($_GET['reporterEmail']) : '';
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';

    $sql = "SELECT * FROM reports WHERE 1=1";
    $params = [];

    if (!empty($category)) {
        $sql .= " AND category = ?";
        $params[] = $category;
    }
    if (!empty($status)) {
        $sql .= " AND status = ?";
        $params[] = $status;
    }
    if (!empty($officerId)) {
        $sql .= " AND (assigned_officer_id = ? OR status = 'Diproses')";
        $params[] = $officerId;
    }
    if (!empty($reporterEmail)) {
        $sql .= " AND reporter_email = ?";
        $params[] = $reporterEmail;
    }
    if (!empty($search)) {
        $sql .= " AND (id LIKE ? OR title LIKE ? OR location LIKE ?)";
        $term = "%{$search}%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $sql .= " ORDER BY created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reports = $stmt->fetchAll();

    // Ambil timeline untuk tiap laporan
    $results = [];
    foreach ($reports as $r) {
        $tStmt = $pdo->prepare("SELECT id, status, actor, note, created_at FROM report_timelines WHERE report_id = ? ORDER BY id ASC");
        $tStmt->execute([$r['id']]);
        $timelines = array_map(function($t) {
            return [
                'status' => $t['status'],
                'date' => formatWibDate($t['created_at']),
                'actor' => $t['actor'],
                'note' => $t['note']
            ];
        }, $tStmt->fetchAll());

        $results[] = [
            'id' => $r['id'],
            'title' => $r['title'],
            'category' => $r['category'],
            'agency' => $r['agency'],
            'location' => $r['location'],
            'date' => $r['date'],
            'status' => $r['status'],
            'description' => $r['description'],
            'image' => $r['image'] ?: '',
            'reporterEmail' => $r['reporter_email'],
            'assignedOfficerId' => $r['assigned_officer_id'] ?: '',
            'assignedOfficerName' => $r['assigned_officer_name'] ?: '-',
            'adminResponse' => $r['admin_response'] ?: '',
            'resolutionNotes' => $r['resolution_notes'] ?: '',
            'proofImage' => $r['proof_image'] ?: '',
            'timeline' => $timelines
        ];
    }

    sendJsonResponse([
        'success' => true,
        'count' => count($results),
        'data' => $results
    ]);
}

// -------------------------------------------------------------------
// 2. POST ?action=create: Simpan Laporan Baru dari Warga
// -------------------------------------------------------------------
if ($method === 'POST' && $action === 'create') {
    $input = getRequestBody();

    // Generate ID unik jika belum diberikan oleh frontend
    $id = !empty($input['id']) ? trim($input['id']) : '';
    if (empty($id)) {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $rand = '';
        for ($i = 0; $i < 4; $i++) {
            $rand .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $id = 'LPR-' . date('Y') . '-' . $rand;
    }

    $title = isset($input['title']) ? trim($input['title']) : '';
    $category = isset($input['category']) ? trim($input['category']) : '';
    $agency = isset($input['agency']) ? trim($input['agency']) : 'Dinas Terkait';
    $location = isset($input['location']) ? trim($input['location']) : '';
    $description = isset($input['description']) ? trim($input['description']) : '';
    $reporterEmail = isset($input['reporterEmail']) ? trim($input['reporterEmail']) : 'anonim@mail.com';
    $actorName = isset($input['actorName']) ? trim($input['actorName']) : 'Masyarakat';
    $date = !empty($input['date']) ? $input['date'] : date('Y-m-d');

    if (empty($title) || empty($category) || empty($location) || empty($description)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Judul, kategori, lokasi, dan deskripsi wajib diisi.'
        ], 400);
    }

    // Handle foto bukti yang diunggah
    $imagePath = handleUploadFile('image_file');
    if (!$imagePath && !empty($input['image'])) {
        $imagePath = $input['image'];
    }

    try {
        $pdo->beginTransaction();

        // 1. Simpan ke tabel reports
        $stmt = $pdo->prepare("
            INSERT INTO reports (id, title, category, agency, location, date, status, description, image, reporter_email, assigned_officer_id, assigned_officer_name, admin_response, resolution_notes, proof_image)
            VALUES (?, ?, ?, ?, ?, ?, 'Menunggu Verifikasi', ?, ?, ?, NULL, '-', '', '', '')
        ");
        $stmt->execute([
            $id,
            $title,
            $category,
            $agency,
            $location,
            $date,
            $description,
            $imagePath ?: '',
            $reporterEmail
        ]);

        // 2. Simpan log awal ke tabel report_timelines
        $tStmt = $pdo->prepare("
            INSERT INTO report_timelines (report_id, status, actor, note, created_at)
            VALUES (?, 'Menunggu Verifikasi', ?, 'Laporan dikirimkan ke sistem.', NOW())
        ");
        $tStmt->execute([$id, $actorName]);

        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => 'Laporan berhasil disimpan ke database MySQL.',
            'id' => $id
        ], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJsonResponse([
            'success' => false,
            'message' => 'Gagal menyimpan laporan: ' . $e->getMessage()
        ], 500);
    }
}

// -------------------------------------------------------------------
// 3. POST ?action=admin_update: Disposisi & Update Status oleh Admin
// -------------------------------------------------------------------
if ($method === 'POST' && $action === 'admin_update') {
    $input = getRequestBody();
    $id = isset($input['id']) ? trim($input['id']) : '';
    $status = isset($input['status']) ? trim($input['status']) : '';
    $officerId = isset($input['assignedOfficerId']) ? trim($input['assignedOfficerId']) : '';
    $officerName = isset($input['assignedOfficerName']) ? trim($input['assignedOfficerName']) : '-';
    $adminResponse = isset($input['adminResponse']) ? trim($input['adminResponse']) : '';

    if (empty($id) || empty($status)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'ID laporan dan status wajib disediakan.'
        ], 400);
    }

    // Jika officerId diisi tetapi officerName belum ada, cari nama petugas dari tabel users
    if (!empty($officerId) && ($officerName === '-' || empty($officerName))) {
        $uStmt = $pdo->prepare("SELECT name FROM users WHERE officer_id = ? LIMIT 1");
        $uStmt->execute([$officerId]);
        $u = $uStmt->fetch();
        if ($u) {
            $officerName = $u['name'];
        }
    }

    try {
        $pdo->beginTransaction();

        // 1. Update tabel reports
        $stmt = $pdo->prepare("
            UPDATE reports 
            SET status = ?, assigned_officer_id = ?, assigned_officer_name = ?, admin_response = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $status,
            $officerId ?: null,
            $officerName,
            $adminResponse,
            $id
        ]);

        // 2. Tambahkan log ke tabel report_timelines
        $note = !empty($officerId) && $officerName !== '-'
            ? "Diverifikasi & ditugaskan ke Petugas Lapangan: {$officerName}"
            : "Status diperbarui oleh Admin ke {$status}";

        $tStmt = $pdo->prepare("
            INSERT INTO report_timelines (report_id, status, actor, note, created_at)
            VALUES (?, ?, 'Admin Dispatcher', ?, NOW())
        ");
        $tStmt->execute([$id, $status, $note]);

        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => "Disposisi laporan {$id} berhasil diperbarui di database."
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJsonResponse([
            'success' => false,
            'message' => 'Gagal memperbarui disposisi admin: ' . $e->getMessage()
        ], 500);
    }
}

// -------------------------------------------------------------------
// 4. POST ?action=field_update: Update Progres & Bukti Petugas Lapangan
// -------------------------------------------------------------------
if ($method === 'POST' && $action === 'field_update') {
    $input = getRequestBody();
    $id = isset($input['id']) ? trim($input['id']) : '';
    $status = isset($input['status']) ? trim($input['status']) : 'Diproses';
    $notes = isset($input['resolutionNotes']) ? trim($input['resolutionNotes']) : '';

    if (empty($id) || empty($notes)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'ID laporan dan catatan progres wajib diisi.'
        ], 400);
    }

    // Handle foto bukti perbaikan lapangan
    $proofPath = handleUploadFile('proof_file');
    if (!$proofPath && !empty($input['proofImage'])) {
        $proofPath = $input['proofImage'];
    }

    try {
        $pdo->beginTransaction();

        // Jika status selesai, simpan catatan penyelesaian & foto bukti
        if ($status === 'Selesai') {
            if (!$proofPath) {
                $proofPath = "https://placehold.co/600x400/059669/ffffff?text=Bukti+Pekerjaan+Selesai";
            }
            $stmt = $pdo->prepare("
                UPDATE reports 
                SET status = ?, resolution_notes = ?, proof_image = ?
                WHERE id = ?
            ");
            $stmt->execute([$status, $notes, $proofPath, $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE reports SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);
        }

        // Simpan log ke report_timelines
        $tStmt = $pdo->prepare("
            INSERT INTO report_timelines (report_id, status, actor, note, created_at)
            VALUES (?, ?, 'Petugas Lapangan', ?, NOW())
        ");
        $tStmt->execute([$id, $status, $notes]);

        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => "Progres lapangan laporan {$id} berhasil dicatat di timeline database."
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJsonResponse([
            'success' => false,
            'message' => 'Gagal memperbarui progres lapangan: ' . $e->getMessage()
        ], 500);
    }
}

// -------------------------------------------------------------------
// 5. POST ?action=reset: Reset Data Laporan ke Default Seed
// -------------------------------------------------------------------
if ($method === 'POST' && $action === 'reset') {
    try {
        $pdo->beginTransaction();
        $pdo->exec("DELETE FROM report_timelines");
        $pdo->exec("DELETE FROM reports");
        seedDefaultReports($pdo);
        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => 'Data simulasi berhasil direset ke kondisi default di database MySQL!'
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJsonResponse([
            'success' => false,
            'message' => 'Gagal mereset data: ' . $e->getMessage()
        ], 500);
    }
}

sendJsonResponse(['success' => false, 'message' => 'Metode atau action tidak valid.'], 405);

