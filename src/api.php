<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configuração de fuso horário brasileiro para os logs e checks
date_default_timezone_set('America/Sao_Paulo');

$db_path = '/var/www/db/database.sqlite';

try {
    $pdo = new PDO("sqlite:$db_path");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // Habilitar integridade de chaves estrangeiras no SQLite
    $pdo->exec("PRAGMA foreign_keys = ON;");
    
    // Criação das tabelas caso não existam
    $pdo->exec("CREATE TABLE IF NOT EXISTS monitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        check_interval INTEGER DEFAULT 60,
        status TEXT DEFAULT 'unknown',
        is_muted INTEGER DEFAULT 0,
        categories TEXT DEFAULT '',
        last_check TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");
    
    // Migration segura para bancos já existentes
    try {
        $pdo->exec("ALTER TABLE monitors ADD COLUMN is_muted INTEGER DEFAULT 0;");
    } catch (PDOException $e) {}
    
    try {
        $pdo->exec("ALTER TABLE monitors ADD COLUMN categories TEXT DEFAULT '';");
    } catch (PDOException $e) {}
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitor_id INTEGER NOT NULL,
        status_code INTEGER,
        response_time_ms INTEGER,
        success INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );");

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Falha na conexão ou inicialização do banco SQLite: ' . $e->getMessage()
    ]);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list_monitors':
        listMonitors($pdo);
        break;
    case 'create_monitor':
        createMonitor($pdo);
        break;
    case 'update_monitor':
        updateMonitor($pdo);
        break;
    case 'import_monitors':
        importMonitors($pdo);
        break;
    case 'delete_monitor':
        deleteMonitor($pdo);
        break;
    case 'toggle_mute':
        toggleMute($pdo);
        break;
    case 'check_monitor':
        checkMonitor($pdo);
        break;
    case 'get_logs':
        getLogs($pdo);
        break;
    case 'get_stats':
        getStats($pdo);
        break;
    default:
        echo json_encode([
            'success' => false,
            'error' => 'Ação inválida ou não especificada.'
        ]);
        break;
}

/**
 * Função auxiliar para disparar uma requisição HTTP via cURL medindo tempos com precisão.
 */
function performCheck($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_NOBODY, true); // Otimização: busca apenas o cabeçalho/status, reduzindo tráfego
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Limite máximo de requisição total de 10s
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5); // Limite máximo de estabelecimento de conexão de 5s
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Segue redirecionamentos (HTTP 3xx)
    curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MonitorDeSites/1.0');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Ignora erros de SSL autoassinado/expirado para fins de monitoramento flexível
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);

    if (curl_errno($ch)) {
        $errorCode = curl_errno($ch);
        $errorMessage = curl_error($ch);
        curl_close($ch);
        return [
            'success' => 0,
            'status_code' => 0,
            'response_time_ms' => round(($endTime - $startTime) * 1000),
            'error' => "Erro cURL ($errorCode): $errorMessage"
        ];
    }

    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $totalTimeSec = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
    $responseTimeMs = round($totalTimeSec * 1000);

    curl_close($ch);

    // Consideramos sucesso caso retorne código de status HTTP na faixa de 200 a 299
    $success = ($statusCode >= 200 && $statusCode < 300) ? 1 : 0;

    return [
        'success' => $success,
        'status_code' => $statusCode,
        'response_time_ms' => $responseTimeMs,
        'error' => null
    ];
}

function listMonitors($pdo) {
    try {
        $stmt = $pdo->query("SELECT m.*, 
            (SELECT response_time_ms FROM logs WHERE monitor_id = m.id ORDER BY created_at DESC LIMIT 1) as last_latency
            FROM monitors m 
            ORDER BY m.created_at DESC");
        $monitors = $stmt->fetchAll();
        echo json_encode([
            'success' => true,
            'data' => $monitors
        ]);
    } catch (PDOException $e) {
        echo json_encode([
            'success' => false,
            'error' => 'Erro ao listar monitores: ' . $e->getMessage()
        ]);
    }
}

function createMonitor($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'error' => 'Método inválido. Use POST para criação.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $url = trim($input['url'] ?? '');
    $check_interval = intval($input['check_interval'] ?? 60);
    $categories = trim($input['categories'] ?? '');

    if (empty($name) || empty($url)) {
        echo json_encode(['success' => false, 'error' => 'Nome e URL do site são obrigatórios.']);
        return;
    }

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        echo json_encode(['success' => false, 'error' => 'A URL fornecida é inválida. Certifique-se de incluir http:// ou https://.']);
        return;
    }

    if ($check_interval < 5) {
        echo json_encode(['success' => false, 'error' => 'O intervalo mínimo de checagem deve ser de 5 segundos.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO monitors (name, url, check_interval, categories) VALUES (:name, :url, :check_interval, :categories)");
        $stmt->execute([
            ':name' => $name,
            ':url' => $url,
            ':check_interval' => $check_interval,
            ':categories' => $categories
        ]);
        echo json_encode([
            'success' => true,
            'id' => $pdo->lastInsertId(),
            'message' => 'Monitor adicionado com sucesso!'
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Erro ao persistir monitor no banco: ' . $e->getMessage()]);
    }
}

function updateMonitor($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'error' => 'Método inválido. Use POST para atualização.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $url = trim($input['url'] ?? '');
    $check_interval = intval($input['check_interval'] ?? 60);
    $categories = trim($input['categories'] ?? '');

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID de monitor inválido.']);
        return;
    }

    if (empty($name) || empty($url)) {
        echo json_encode(['success' => false, 'error' => 'Nome e URL do site são obrigatórios.']);
        return;
    }

    if (!preg_match('/^https?:\/\//i', $url)) {
        $url = 'https://' . $url;
    }

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        echo json_encode(['success' => false, 'error' => 'A URL fornecida é inválida. Certifique-se de incluir http:// ou https://.']);
        return;
    }

    if ($check_interval < 5) {
        echo json_encode(['success' => false, 'error' => 'O intervalo mínimo de checagem deve ser de 5 segundos.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("UPDATE monitors SET name = :name, url = :url, check_interval = :check_interval, categories = :categories WHERE id = :id");
        $stmt->execute([
            ':name' => $name,
            ':url' => $url,
            ':check_interval' => $check_interval,
            ':categories' => $categories,
            ':id' => $id
        ]);
        echo json_encode([
            'success' => true,
            'message' => 'Monitor atualizado com sucesso!'
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Erro ao atualizar monitor: ' . $e->getMessage()]);
    }
}

function importMonitors($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'error' => 'Método inválido. Use POST para importação.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $monitors = $input['monitors'] ?? [];

    if (!is_array($monitors) || empty($monitors)) {
        echo json_encode(['success' => false, 'error' => 'Nenhum monitor fornecido para importação.']);
        return;
    }

    $importedCount = 0;
    $errors = [];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO monitors (name, url, check_interval, categories) VALUES (:name, :url, :check_interval, :categories)");

        foreach ($monitors as $m) {
            $name = trim($m['name'] ?? '');
            $url = trim($m['url'] ?? '');
            $check_interval = intval($m['check_interval'] ?? 60);
            $categories = trim($m['categories'] ?? '');

            if (empty($url)) {
                continue;
            }

            if (!preg_match('/^https?:\/\//i', $url)) {
                $url = 'https://' . $url;
            }

            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                $errors[] = "URL inválida: $url";
                continue;
            }

            if (empty($name)) {
                $parsedHost = parse_url($url, PHP_URL_HOST);
                $name = $parsedHost ? $parsedHost : $url;
            }

            if ($check_interval < 5) {
                $check_interval = 60;
            }

            $stmt->execute([
                ':name' => $name,
                ':url' => $url,
                ':check_interval' => $check_interval,
                ':categories' => $categories
            ]);
            $importedCount++;
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'imported_count' => $importedCount,
            'errors' => $errors,
            'message' => "$importedCount monitores importados com sucesso."
        ]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode([
            'success' => false,
            'error' => 'Erro ao importar monitores: ' . $e->getMessage()
        ]);
    }
}

function toggleMute($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'error' => 'Método inválido. Use POST.']);
        return;
    }

    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
    }

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID inválido ou ausente.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT is_muted FROM monitors WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $monitor = $stmt->fetch();

        if (!$monitor) {
            echo json_encode(['success' => false, 'error' => 'Monitor não encontrado.']);
            return;
        }

        $newMutedState = ($monitor['is_muted'] == 1) ? 0 : 1;

        $upStmt = $pdo->prepare("UPDATE monitors SET is_muted = :is_muted WHERE id = :id");
        $upStmt->execute([
            ':is_muted' => $newMutedState,
            ':id' => $id
        ]);

        echo json_encode([
            'success' => true,
            'id' => $id,
            'is_muted' => $newMutedState,
            'message' => $newMutedState ? 'Alertas silenciados para este monitor.' : 'Alertas ativados para este monitor.'
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Erro ao alterar estado de silenciamento: ' . $e->getMessage()]);
    }
}

function deleteMonitor($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
        echo json_encode(['success' => false, 'error' => 'Método inválido. Use POST ou DELETE.']);
        return;
    }

    $id = intval($_GET['id'] ?? 0);

    if ($id <= 0) {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
    }

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID inválido ou ausente para exclusão.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM monitors WHERE id = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode([
            'success' => true,
            'message' => 'Monitor excluído com sucesso!'
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Erro ao excluir monitor: ' . $e->getMessage()]);
    }
}

function checkMonitor($pdo) {
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID inválido fornecido para verificação de status.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM monitors WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $monitor = $stmt->fetch();

        if (!$monitor) {
            echo json_encode(['success' => false, 'error' => 'Monitor não localizado no banco de dados.']);
            return;
        }

        $checkResult = performCheck($monitor['url']);
        
        $newStatus = ($checkResult['success'] === 1) ? 'up' : 'down';
        $lastCheck = date('Y-m-d H:i:s');

        // Atualiza os dados principais do Monitor
        $upStmt = $pdo->prepare("UPDATE monitors SET status = :status, last_check = :last_check WHERE id = :id");
        $upStmt->execute([
            ':status' => $newStatus,
            ':last_check' => $lastCheck,
            ':id' => $id
        ]);

        // Insere o log histórico da verificação atual
        $logStmt = $pdo->prepare("INSERT INTO logs (monitor_id, status_code, response_time_ms, success) VALUES (:monitor_id, :status_code, :response_time_ms, :success)");
        $logStmt->execute([
            ':monitor_id' => $id,
            ':status_code' => $checkResult['status_code'],
            ':response_time_ms' => $checkResult['response_time_ms'],
            ':success' => $checkResult['success']
        ]);

        echo json_encode([
            'success' => true,
            'data' => [
                'id' => $id,
                'name' => $monitor['name'],
                'url' => $monitor['url'],
                'status' => $newStatus,
                'status_code' => $checkResult['status_code'],
                'response_time_ms' => $checkResult['response_time_ms'],
                'last_check' => $lastCheck,
                'error' => $checkResult['error']
            ]
        ]);

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Falha interna durante a transação de checagem: ' . $e->getMessage()]);
    }
}

function getLogs($pdo) {
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID de monitor inválido para busca de histórico.']);
        return;
    }

    try {
        // Seleciona os últimos 20 logs históricos
        $stmt = $pdo->prepare("SELECT * FROM logs WHERE monitor_id = :id ORDER BY created_at DESC LIMIT 20");
        $stmt->execute([':id' => $id]);
        $logs = $stmt->fetchAll();
        
        // Retorna na ordem cronológica de ocorrência (mais antigo para mais recente) para alimentar o Chart.js de forma correta
        echo json_encode([
            'success' => true,
            'data' => array_reverse($logs)
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Erro ao carregar os dados de histórico cURL: ' . $e->getMessage()]);
    }
}

function getStats($pdo) {
    try {
        $total = $pdo->query("SELECT COUNT(*) FROM monitors")->fetchColumn();
        $up = $pdo->query("SELECT COUNT(*) FROM monitors WHERE status = 'up'")->fetchColumn();
        $down = $pdo->query("SELECT COUNT(*) FROM monitors WHERE status = 'down'")->fetchColumn();
        
        // Média de latência das checagens bem-sucedidas realizadas nas últimas 24 horas
        $avg_latency = $pdo->query("SELECT AVG(response_time_ms) FROM logs WHERE created_at >= datetime('now', '-1 day') AND success = 1")->fetchColumn();
        
        echo json_encode([
            'success' => true,
            'data' => [
                'total' => intval($total),
                'up' => intval($up),
                'down' => intval($down),
                'avg_latency' => round($avg_latency ?? 0, 1)
            ]
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Erro ao calcular estatísticas gerais: ' . $e->getMessage()]);
    }
}
