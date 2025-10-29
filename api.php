<?php
/**
 * @file api.php
 * @brief Main backend API for the event calendar application.
 *
 * This file handles all server-side logic, including data retrieval,
 * event management, user authentication, and settings configuration.
 * It uses a set of JSON files as a database and enforces role-based access control.
 */

session_start();
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Tehran'); // Set default timezone for date functions

// --- Constants ---
define('DATA_FILE', './data/data.json');
define('USERS_FILE', './data/users.json');
define('ISSUES_FILE', './data/issues.json');
// User Roles
define('ROLE_MANAGER', 'manager');
define('ROLE_EVALUATOR', 'evaluator');
define('ROLE_PROPOSER', 'proposer');
define('ROLE_VIEWER', 'viewer');

// Event Statuses
define('STATUS_APPROVED', 'approved');
define('STATUS_PENDING', 'pending');
define('STATUS_REJECTED', 'rejected');
// --- Authentication Check ---
if (!isset($_SESSION['user_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'دسترسی غیر مجاز. لطفا وارد شوید.']);
    exit; // 
}

// --- Current User Information ---
$CURRENT_USER_ID = $_SESSION['user_id'];
$CURRENT_USER_ROLE = $_SESSION['role'] ?? ROLE_VIEWER;
$CURRENT_USER_DEPT_ID = $_SESSION['departmentId'] ?? null;
$CURRENT_USER_PERMS = $_SESSION['permissions'] ?? []; //

// --- Helper Functions ---

/**
 * Reads JSON data from a file with file locking.
 * Ensures 'events', 'departments', 'holidays' are arrays.
 * - Added error logging for JSON decode errors.
 *
 * @param string $file The path to the JSON file.
 * @return array|null The decoded data or null on failure.
 */
function readData($file) {
    if (!file_exists($file)) {
        error_log("File not found: $file");
        return null; // 
    }

    $fp = fopen($file, 'r'); // 
    if (!$fp) {
        error_log("Could not open file for reading: $file");
        return null; // 
    }

    // Acquire shared lock for reading
    if (!flock($fp, LOCK_SH)) {
        fclose($fp);
        error_log("Could not acquire shared lock for reading: $file"); // 
        return null;
    }

    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN); // Release lock
    fclose($fp);

    if ($content === false) {
        error_log("Could not read file content: $file");
        return null; // 
    }
    // Handle empty file case
    if (trim($content) === '') {
        if (basename($file) === 'data.json') return ['settings' => [], 'events' => [], 'holidays' => [], 'departments' => []]; // 
        if (basename($file) === 'users.json') return [];
        if (basename($file) === 'issues.json') return [];
        return null; // 
    }

    $data = json_decode($content, true);

    // Check for JSON decoding errors
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON Decode Error in $file: " . json_last_error_msg() . " | Content prefix: " . substr($content, 0, 100)); // 
        // Return a default structure to prevent fatal errors downstream
        if (basename($file) === 'data.json') return ['settings' => [], 'events' => [], 'holidays' => [], 'departments' => []]; // 
        if (basename($file) === 'users.json') return [];
        if (basename($file) === 'issues.json') return [];
        return null; // Or throw exception? 
    }

    // Ensure essential keys are arrays (for data.json)
    if (basename($file) === 'data.json') {
        $data['settings'] = isset($data['settings']) && is_array($data['settings']) ? $data['settings'] : []; // 
        $data['events'] = isset($data['events']) && is_array($data['events']) ? $data['events'] : [];
        $data['departments'] = isset($data['departments']) && is_array($data['departments']) ? $data['departments'] : []; // 
        $data['holidays'] = isset($data['holidays']) && is_array($data['holidays']) ? $data['holidays'] : []; // 
    }
    // Ensure root is an array for users and issues
    elseif ((basename($file) === 'users.json' || basename($file) === 'issues.json') && !is_array($data)) {
        error_log("Invalid structure in $file: expected root array, found object. Attempting to recover.");
        // Attempt to recover by filtering for numeric keys, in case of corruption like {"0": {}, "1": {}}
        $recoveredData = [];
        foreach ($data as $key => $value) {
            if (is_numeric($key) && is_array($value)) {
                $recoveredData[] = $value;
            }
        }
        $data = $recoveredData;
    }


    return $data; // 
}

/**
 * Writes JSON data to a file with file locking and sorting for events.
 * - Added Exception handling for date comparison.
 *
 * @param string $file The path to the JSON file.
 * @param mixed $data The data to encode and write.
 * @return bool True on success, false on failure.
 */
function writeData($file, $data) {
    // Ensure events array exists and sort it before writing (only for data.json)
    if (basename($file) === 'data.json') {
        if (!isset($data['events']) || !is_array($data['events'])) {
            $data['events'] = []; // 
        }
        usort($data['events'], function ($a, $b) {
            $startA = $a['startDateTime'] ?? '9999-12-31T23:59:59Z'; // Use Z for UTC comparison if no offset
            $startB = $b['startDateTime'] ?? '9999-12-31T23:59:59Z';
            try {
                // DateTime constructor correctly handles ISO strings with or without offsets
                $dtA = new DateTime($startA); // 
                $dtB = new DateTime($startB);
                return $dtA <=> $dtB; // Use spaceship operator for comparison
            } catch (Exception $e) {
                 // Log error and treat as equal to avoid breaking sort
                error_log("Date comparison error during sort: " . $e->getMessage() . " | Comparing: '$startA' <=> '$startB'"); // 
                 return 0;
            }
        }); // 
    }

    $fp = fopen($file, 'c'); // Open for writing, create if not exists, pointer at beginning
    if (!$fp) {
        error_log("Could not open file for writing: $file");
        return false; // 
    }

    // Acquire exclusive lock for writing
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        error_log("Could not acquire exclusive lock for writing: $file"); // 
        return false; // 
    }

    // Truncate the file to zero length AFTER acquiring the lock
    ftruncate($fp, 0); // 
    $writeResult = fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)); // Added UTF8 substitute
    fflush($fp); // Ensure data is written to disk
    flock($fp, LOCK_UN); // Release lock
    fclose($fp); // 
    if ($writeResult === false) {
        error_log("Failed to write data to file: $file"); // 
    }
    return $writeResult !== false;
}

// --- Input Sanitization Helpers ---

/**
 * Basic string sanitization using strip_tags.
 * Replaces the deprecated FILTER_SANITIZE_STRING.
 *
 * @param string|null $input The string to sanitize.
 * @return string The sanitized string.
 */
function sanitizeString($input) {
    if ($input === null || !is_string($input)) {
        return '';
    }
    // strip_tags removes HTML and PHP tags.
    return strip_tags($input);
}

/**
 * Sanitizes a hex color code.
 *
 * @param string|null $color The color string to sanitize.
 * @param string $default The default color to return if sanitization fails.
 * @return string The sanitized hex color.
 */
function sanitizeColor($color, $default = '#cccccc') {
    if (empty($color) || !is_string($color)) {
        return $default;
    }
    $sanitized = strip_tags($color);
    if (preg_match('/^#([a-f0-9]{6}|[a-f0-9]{3})$/i', $sanitized)) {
        return $sanitized;
    }
    return $default;
}


// --- Action Handler Functions ---

/**
 * Handles the 'getData' action.
 * Filters and returns events, settings, and user data based on the current user's permissions.
 *
 * @param array $appData The main application data.
 * @param array $usersData The user data.
 * @param array $currentUser The information about the currently logged-in user.
 * @return void
 */
function handleGetData($appData, $usersData, $currentUser) {
    // Determine the target week start date
    $weekStartDateStr = $_GET['weekStartDate'] ?? ($appData['settings']['weekStartDate'] ?? null);
    if (!$weekStartDateStr || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStartDateStr)) {
        $todayDt = new DateTime('now', new DateTimeZone('Asia/Tehran'));
        $diffToSat = ($todayDt->format('w') + 1) % 7;
        $todayDt->modify("-$diffToSat days");
        $weekStartDateStr = $todayDt->format('Y-m-d');
    }

    $weekStartDT = new DateTime($weekStartDateStr . ' 00:00:00', new DateTimeZone('Asia/Tehran'));
    $weekEndDT = clone $weekStartDT;
    $weekEndDT->modify('+7 days');

    // Filter Events by Date Range
    $dateFilteredEvents = [];
    foreach ($appData['events'] as $event) {
        if (empty($event['startDateTime']) || empty($event['endDateTime']) || !is_string($event['startDateTime']) || !is_string($event['endDateTime'])) {
            error_log("Skipping event due to missing or non-string DateTime: " . ($event['id'] ?? 'N/A'));
            continue;
        }
        try {
            $eventStartDT = new DateTime($event['startDateTime']);
            $endStr = $event['endDateTime'];
            $eventEndDT = null;

            if (str_contains($endStr, 'T24:00:00')) {
                $datePart = substr($endStr, 0, 10);
                $offsetPart = substr($endStr, 19) ?: date('P');
                $eventEndDT = new DateTime($datePart . 'T00:00:00' . $offsetPart);
                $eventEndDT->modify('+1 day');
            } else {
                $eventEndDT = new DateTime($endStr);
            }

            if ($eventStartDT < $weekEndDT && $eventEndDT > $weekStartDT) {
                $dateFilteredEvents[] = $event;
            }
        } catch (Exception $e) {
            error_log("Skipping event due to invalid DateTime format during getData filtering: ID " . ($event['id'] ?? 'N/A') . " - Error: " . $e->getMessage());
            continue;
        }
    }

    // Access Control Filtering
    $filteredEvents = [];
    if ($currentUser['role'] === ROLE_MANAGER || $currentUser['role'] === ROLE_EVALUATOR) {
        $filteredEvents = array_filter($dateFilteredEvents, function ($event) {
            $status = $event['status'] ?? STATUS_APPROVED;
            return $status === STATUS_APPROVED || $status === STATUS_PENDING;
        });
    } else { // Proposer or Viewer
        $view_all_depts = $currentUser['permissions']['view_all_depts'] ?? false;
        $view_depts = $currentUser['permissions']['view_depts'] ?? [];
        $view_all_users = $currentUser['permissions']['view_all_users'] ?? false;
        $view_users = $currentUser['permissions']['view_users'] ?? [];
        foreach ($dateFilteredEvents as $event) {
            $proposerId = $event['proposerId'] ?? null;
            $deptId = $event['departmentId'] ?? null;
            $status = $event['status'] ?? STATUS_APPROVED;

            $isOwnEvent = ($proposerId && $proposerId === $currentUser['id']);
            if ($isOwnEvent) {
                $filteredEvents[] = $event;
                continue;
            }
            if ($status !== STATUS_APPROVED) {
                continue;
            }

            $hasDeptAccess = $view_all_depts || ($deptId && is_array($view_depts) && in_array($deptId, $view_depts));
            $hasUserAccess = $view_all_users || ($proposerId && is_array($view_users) && in_array($proposerId, $view_users));
            if ($hasDeptAccess || $hasUserAccess) {
                $filteredEvents[] = $event;
            }
        }
    }

    $outputData = [
        'settings' => $appData['settings'] ?? [],
        'events' => array_values($filteredEvents),
        'holidays' => $appData['holidays'] ?? [],
        'departments' => $appData['departments'] ?? [],
        'users' => array_map(function($user) {
            unset($user['password_hash']);
            return $user;
        }, $usersData)
    ];
    echo json_encode(['success' => true, 'data' => $outputData]);
}

/**
 * Handles the 'saveSettings' action.
 *
 * @param array $appData The main application data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception If the user is not authorized.
 * @return void
 */
function handleSaveSettings($appData, $input, $currentUser) {
    if ($currentUser['role'] !== ROLE_MANAGER) throw new Exception('شما اجازه تغییر تنظیمات را ندارید.');
    
    if (isset($input['headerText'])) {
        $appData['settings']['headerText'] = sanitizeString($input['headerText']);
    }
    if (isset($input['weekStartDate']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['weekStartDate'])) {
        $appData['settings']['weekStartDate'] = $input['weekStartDate'];
    } else {
        error_log("Attempted to save settings with invalid weekStartDate format: " . ($input['weekStartDate'] ?? 'NULL'));
    }

    if (!writeData(DATA_FILE, $appData)) throw new Exception('خطا در ذخیره تنظیمات.');
    echo json_encode(['success' => true, 'message' => 'تنظیمات با موفقیت ذخیره شد.']);
}

/**
 * Handles the 'saveEvent' action.
 *
 * @param array $appData The main application data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception On validation errors or if the user is not authorized.
 * @return void
 */
function handleSaveEvent($appData, $input, $currentUser) {
    if ($currentUser['role'] === ROLE_VIEWER) throw new Exception('شما اجازه ذخیره رویداد را ندارید.');
    
    $eventData = $input['event'] ?? [];
    $isEditing = !empty($eventData['id']);

    // Validate Input
    $requiredFields = ['title', 'startDateTime', 'endDateTime'];
    foreach($requiredFields as $field) {
        if (empty($eventData[$field])) throw new Exception("فیلد ضروری '$field' وجود ندارد.");
    }
    $dateTimeRegex = '/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2}|24:00:00)([+-]\d{2}:\d{2}|Z)?$/';
    if (!preg_match($dateTimeRegex, $eventData['startDateTime']) || !preg_match($dateTimeRegex, $eventData['endDateTime'])) {
        throw new Exception("فرمت تاریخ شروع یا پایان نامعتبر است.");
    }
    try {
        $startDT = new DateTime($eventData['startDateTime']);
        $endStr = $eventData['endDateTime'];
        if (str_contains($endStr, 'T24:00:00')) {
            $datePart = substr($endStr, 0, 10);
            $offsetPart = substr($endStr, 19) ?: date('P');
            $compareEndDT = new DateTime($datePart . 'T00:00:00' . $offsetPart);
            $compareEndDT->modify('+1 day');
        } else {
            $compareEndDT = new DateTime($endStr);
        }
        if ($compareEndDT <= $startDT) throw new Exception("تاریخ پایان باید بعد از تاریخ شروع باشد.");
    } catch (Exception $e) { throw new Exception("خطا در پردازش تاریخ: " . $e->getMessage()); }

    // Sanitize Input
    $sanitizedEvent = [
        'id' => sanitizeString($eventData['id'] ?? null),
        'title' => sanitizeString($eventData['title'] ?? ''),
        'by' => sanitizeString($eventData['by'] ?? ''),
        'for' => sanitizeString($eventData['for'] ?? ''),
        'goal' => sanitizeString($eventData['goal'] ?? ''),
        'isAllDay' => filter_var($eventData['isAllDay'] ?? false, FILTER_VALIDATE_BOOLEAN),
        'startDateTime' => $eventData['startDateTime'],
        'endDateTime' => $eventData['endDateTime'],
    ];

    if ($currentUser['role'] === ROLE_MANAGER) {
        $sanitizedEvent['color'] = sanitizeColor($eventData['color'] ?? null, null);
        $sanitizedEvent['textColor'] = sanitizeColor($eventData['textColor'] ?? null, null);
        $sanitizedEvent['departmentId'] = sanitizeString($eventData['departmentId'] ?? null);
    }

    if ($isEditing) {
        // Edit existing event
        $eventIndex = array_search($sanitizedEvent['id'], array_column($appData['events'], 'id'));
        if ($eventIndex === false) throw new Exception('رویداد برای ویرایش یافت نشد.');

        $existingEvent = $appData['events'][$eventIndex];
        if (($existingEvent['isHoliday'] ?? false)) throw new Exception('تعطیلات رسمی قابل ویرایش نیستند.');

        $canEdit = ($currentUser['role'] === ROLE_MANAGER || $currentUser['role'] === ROLE_EVALUATOR ||
                   (($existingEvent['proposerId'] ?? null) === $currentUser['id'] &&
                   in_array(($existingEvent['status'] ?? STATUS_APPROVED), [STATUS_PENDING, STATUS_REJECTED])));
        if (!$canEdit) throw new Exception('شما اجازه ویرایش این رویداد را ندارید.');

        $updatedEvent = $existingEvent;
        $allowedFields = ['title', 'by', 'for', 'goal', 'isAllDay', 'startDateTime', 'endDateTime'];
        if ($currentUser['role'] === ROLE_MANAGER) $allowedFields = array_merge($allowedFields, ['color', 'textColor', 'departmentId', 'status']);
        if ($currentUser['role'] === ROLE_EVALUATOR) $allowedFields[] = 'status';

        foreach($sanitizedEvent as $key => $value) {
            if (in_array($key, $allowedFields) && isset($value)) {
                $updatedEvent[$key] = $value;
            }
        }

        $newStatusInput = $eventData['status'] ?? null;
        if (in_array('status', $allowedFields) && $newStatusInput && in_array($newStatusInput, [STATUS_APPROVED, STATUS_PENDING, STATUS_REJECTED])) {
            $updatedEvent['status'] = $newStatusInput;
        } elseif ($currentUser['role'] === ROLE_PROPOSER && $existingEvent['status'] === STATUS_REJECTED) {
            $updatedEvent['status'] = STATUS_PENDING;
        }

        $appData['events'][$eventIndex] = $updatedEvent;
        $message = 'رویداد با موفقیت ویرایش شد.';
    } else {
        // Add new event
        $newEvent = $sanitizedEvent;
        $newEvent['id'] = uniqid('evt_', true);
        $newEvent['proposerId'] = $currentUser['id'];
        if (!isset($newEvent['departmentId'])) {
            $newEvent['departmentId'] = $currentUser['departmentId'];
        }

        $deptColor = null;
        if ($newEvent['departmentId']) {
            $dept = array_values(array_filter($appData['departments'] ?? [], fn($d) => ($d['id'] ?? null) === $newEvent['departmentId']))[0] ?? null;
            if ($dept) $deptColor = $dept['color'] ?? null;
        }
        $deptTextColor = isLightColor($deptColor) ? '#333333' : '#ffffff';

        if ($currentUser['role'] === ROLE_MANAGER || $currentUser['role'] === ROLE_EVALUATOR) {
            $newEvent['status'] = STATUS_APPROVED;
            $message = 'رویداد با موفقیت افزوده و تایید شد.';
            $newEvent['color'] = $newEvent['color'] ?? $deptColor ?? '#5c6bc0';
            $newEvent['textColor'] = $newEvent['textColor'] ?? (isLightColor($newEvent['color']) ? '#333333' : '#ffffff');
        } else { // Proposer
            $newEvent['status'] = STATUS_PENDING;
            $message = 'پیشنهاد شما ثبت شد و منتظر تایید است.';
            $newEvent['color'] = $deptColor ?? '#aaaaaa';
            $newEvent['textColor'] = $deptTextColor;
        }
        $appData['events'][] = $newEvent;
    }

    if (!writeData(DATA_FILE, $appData)) throw new Exception('خطا در ذخیره رویداد.');
    echo json_encode(['success' => true, 'message' => $message]);
}

/**
 * Handles the 'updateEventStatus' action.
 *
 * @param array $appData The main application data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception On validation errors or if the user is not authorized.
 * @return void
 */
function handleUpdateEventStatus($appData, $input, $currentUser) {
    if ($currentUser['role'] !== ROLE_MANAGER && $currentUser['role'] !== ROLE_EVALUATOR) throw new Exception('شما اجازه تغییر وضعیت را ندارید.');
    
    $eventId = sanitizeString($input['id'] ?? null);
    $newStatus = sanitizeString($input['status'] ?? null);
    if (!$eventId || !$newStatus || !in_array($newStatus, [STATUS_APPROVED, STATUS_REJECTED, STATUS_PENDING])) {
        throw new Exception('شناسه رویداد یا وضعیت جدید نامعتبر است.');
    }

    $eventIndex = array_search($eventId, array_column($appData['events'], 'id'));
    if ($eventIndex === false) throw new Exception('رویداد یافت نشد.');
    if (($appData['events'][$eventIndex]['isHoliday'] ?? false)) throw new Exception('وضعیت تعطیلات رسمی قابل تغییر نیست.');

    $appData['events'][$eventIndex]['status'] = $newStatus;
    if ($newStatus === STATUS_APPROVED && empty($appData['events'][$eventIndex]['color'])) {
        $proposerDeptId = $appData['events'][$eventIndex]['departmentId'] ?? null;
        $deptColor = '#5c6bc0';
        if ($proposerDeptId && isset($appData['departments'])) {
            foreach($appData['departments'] as $dept) {
                if (($dept['id'] ?? null) === $proposerDeptId) { $deptColor = $dept['color'] ?? $deptColor; break; }
            }
        }
        $appData['events'][$eventIndex]['color'] = $deptColor;
        $appData['events'][$eventIndex]['textColor'] = isLightColor($deptColor) ? '#333333' : '#ffffff';
    }

    if (!writeData(DATA_FILE, $appData)) throw new Exception('خطا در به‌روزرسانی وضعیت رویداد.');
    echo json_encode(['success' => true, 'message' => 'وضعیت رویداد با موفقیت به‌روز شد.']);
}

/**
 * Handles the 'deleteEvent' action.
 *
 * @param array $appData The main application data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception On validation errors or if the user is not authorized.
 * @return void
 */
function handleDeleteEvent($appData, $input, $currentUser) {
    $eventId = sanitizeString($input['id'] ?? null);
    if (!$eventId) throw new Exception('شناسه رویداد نامعتبر است.');

    $eventIndex = array_search($eventId, array_column($appData['events'], 'id'));
    if ($eventIndex === false) throw new Exception('رویداد یافت نشد.');
    if (($appData['events'][$eventIndex]['isHoliday'] ?? false)) throw new Exception('تعطیلات رسمی قابل حذف نیستند.');

    $existingEvent = $appData['events'][$eventIndex];
    $canDelete = ($currentUser['role'] === ROLE_MANAGER || $currentUser['role'] === ROLE_EVALUATOR ||
                 (($existingEvent['proposerId'] ?? null) === $currentUser['id'] && ($existingEvent['status'] ?? '') !== STATUS_APPROVED));
    if (!$canDelete) throw new Exception('شما اجازه حذف این رویداد را ندارید.');

    array_splice($appData['events'], $eventIndex, 1);

    if (!writeData(DATA_FILE, $appData)) throw new Exception('خطا در حذف رویداد.');
    echo json_encode(['success' => true, 'message' => 'رویداد با موفقیت حذف شد.']);
}

/**
 * Handles the 'manageDepartments' action.
 *
 * @param array $appData The main application data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception On validation errors or if the user is not authorized.
 * @return void
 */
function handleManageDepartments($appData, $input, $currentUser) {
    if ($currentUser['role'] !== ROLE_MANAGER) throw new Exception('دسترسی مجاز نیست.');
    
    $inputDepts = $input['departments'] ?? [];
    if (!is_array($inputDepts)) throw new Exception('فرمت داده دپارتمان‌ها نامعتبر است.');

    $cleanDepartments = [];
    $existingIds = array_column($appData['departments'] ?? [], 'id');
    $usedIds = [];

    foreach ($inputDepts as $dept) {
        $id = sanitizeString($dept['id'] ?? null);
        $name = strip_tags(trim($dept['name'] ?? ''));
        $color = sanitizeColor($dept['color'] ?? '#cccccc');

        if (empty($name)) continue;

        if (empty($id) || str_starts_with($id, 'new_')) {
            do { $newId = 'd_' . time() . '_' . rand(100, 999); }
            while (in_array($newId, $existingIds) || in_array($newId, $usedIds));
            $id = $newId;
        }

        if (in_array($id, $usedIds)) {
           error_log("Duplicate department ID detected in request: " . $id);
           continue;
        }
        $usedIds[] = $id;
        $cleanDepartments[] = ['id' => $id, 'name' => $name, 'color' => $color ];
    }

    $appData['departments'] = $cleanDepartments;
    if (writeData(DATA_FILE, $appData)) {
        echo json_encode(['success' => true, 'message' => 'دپارتمان‌ها به‌روزرسانی شدند.', 'data' => $cleanDepartments]);
    } else {
        throw new Exception('خطا در ذخیره دپارتمان‌ها.');
    }
}

/**
 * Handles the 'manageUsers' action.
 *
 * @param array $usersData The user data.
 * @param array $appData The main application data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception On validation errors or if the user is not authorized.
 * @return void
 */
function handleManageUsers($usersData, $appData, $input, $currentUser) {
    if ($currentUser['role'] !== ROLE_MANAGER) throw new Exception('دسترسی مجاز نیست.');
    
    $sub_action = $input['sub_action'] ?? '';
    $clientUser = $input['user'] ?? null;
    $allDepartments = $appData['departments'] ?? [];

    switch ($sub_action) {
        case 'delete':
            $userIdToDelete = sanitizeString($clientUser['id'] ?? null);
            if (!$userIdToDelete) throw new Exception('شناسه کاربر برای حذف الزامی است.');
            if ($userIdToDelete === $currentUser['id']) throw new Exception('شما نمی‌توانید حساب کاربری خود را حذف کنید.');

            $originalCount = count($usersData);
            $usersData = array_filter($usersData, fn($u) => ($u['id'] ?? null) !== $userIdToDelete);
            if (count($usersData) === $originalCount) throw new Exception('کاربر مورد نظر یافت نشد.');

            $message = 'کاربر با موفقیت حذف شد.';
            break;
        case 'save':
            if (!$clientUser) throw new Exception('اطلاعات کاربر ارسال نشده است.');

            $cleanUser = [
                'id' => sanitizeString($clientUser['id'] ?? null),
                'username' => trim(strip_tags($clientUser['username'] ?? '')),
                'displayName' => trim(strip_tags($clientUser['displayName'] ?? '')),
                'password' => $clientUser['password'] ?? null,
                'role' => sanitizeString($clientUser['role'] ?? ROLE_VIEWER),
                'departmentId' => sanitizeString($clientUser['departmentId'] ?? null) ?: null,
            ];

            if (empty($cleanUser['username'])) throw new Exception('نام کاربری الزامی است.');
            if (empty($cleanUser['displayName'])) throw new Exception('نام نمایشی الزامی است.');
            if (!in_array($cleanUser['role'], [ROLE_MANAGER, ROLE_EVALUATOR, ROLE_PROPOSER, ROLE_VIEWER])) throw new Exception('نقش کاربر نامعتبر است.');
            if ($cleanUser['departmentId'] && !in_array($cleanUser['departmentId'], array_column($allDepartments, 'id'))) {
                throw new Exception('دپارتمان انتخاب شده نامعتبر است.');
            }

            $isEditing = !empty($cleanUser['id']);
            foreach($usersData as $existingUser) {
                if (($existingUser['id'] ?? null) !== $cleanUser['id'] && ($existingUser['username'] ?? '') === $cleanUser['username']) {
                    throw new Exception('نام کاربری تکراری است.');
                }
            }

            $permsInput = $clientUser['permissions'] ?? [];
            $cleanUser['permissions'] = [
                'view_all_depts' => filter_var($permsInput['view_all_depts'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'view_depts' => array_values(array_filter(array_map('sanitizeString', $permsInput['view_depts'] ?? []), 'strlen')),
                'view_all_users' => filter_var($permsInput['view_all_users'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'view_users' => array_values(array_filter(array_map('sanitizeString', $permsInput['view_users'] ?? []), 'strlen'))
            ];

            if ($isEditing) {
                $userIndex = array_search($cleanUser['id'], array_column($usersData, 'id'));
                if ($userIndex === false) throw new Exception('کاربر برای ویرایش یافت نشد.');

                $usersData[$userIndex]['username'] = $cleanUser['username'];
                $usersData[$userIndex]['displayName'] = $cleanUser['displayName'];
                $usersData[$userIndex]['role'] = $cleanUser['role'];
                $usersData[$userIndex]['departmentId'] = $cleanUser['departmentId'];
                $usersData[$userIndex]['permissions'] = $cleanUser['permissions'];
                if (!empty($cleanUser['password'])) {
                   if (strlen($cleanUser['password']) < 6) throw new Exception('رمز عبور باید حداقل ۶ کاراکتر باشد.');
                   $usersData[$userIndex]['password_hash'] = password_hash($cleanUser['password'], PASSWORD_DEFAULT);
                }
                $message = 'اطلاعات کاربر با موفقیت ویرایش شد.';
            } else {
                if (empty($cleanUser['password'])) throw new Exception('رمز عبور برای کاربر جدید الزامی است.');
                if (strlen($cleanUser['password']) < 6) throw new Exception('رمز عبور باید حداقل ۶ کاراکتر باشد.');
                $newUser = $cleanUser;
                do { $newUser['id'] = 'u_' . time() . '_' . rand(100, 999); }
                while (in_array($newUser['id'], array_column($usersData, 'id')));
                $newUser['password_hash'] = password_hash($newUser['password'], PASSWORD_DEFAULT);
                unset($newUser['password']);
                $usersData[] = $newUser;
                $message = 'کاربر جدید با موفقیت افزوده شد.';
            }
            break;
        default:
            throw new Exception('عملیات نامعتبر برای مدیریت کاربران.');
    }

    if (writeData(USERS_FILE, array_values($usersData))) {
        $updatedUsersList = readData(USERS_FILE) ?? [];
        $outputUsers = array_map(function($user) { unset($user['password_hash']); return $user; }, $updatedUsersList);
        echo json_encode(['success' => true, 'message' => $message, 'data' => $outputUsers]);
    } else {
        throw new Exception('خطا در ذخیره اطلاعات کاربران.');
    }
}

/**
 * Handles the 'reportIssue' action.
 *
 * @param array $issuesData The issues data.
 * @param array $input The JSON decoded input from the request.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception If the issue text is empty.
 * @return void
 */
function handleReportIssue($issuesData, $input, $currentUser) {
    $issueText = strip_tags(trim($input['text'] ?? ''));
    if (empty($issueText)) throw new Exception("متن پیام نمی‌تواند خالی باشد.");

    $newIssue = [
        'id' => time() . '_' . rand(100, 999),
        'userId' => $currentUser['id'],
        'userName' => $_SESSION['displayName'],
        'text' => $issueText,
        'timestamp' => date('c'),
        'status' => 'new'
    ];
    $issuesData[] = $newIssue;

    if (writeData(ISSUES_FILE, $issuesData)) {
        echo json_encode(['success' => true, 'message' => 'پیام شما با موفقیت ثبت شد.']);
    } else {
        throw new Exception('خطا در ثبت پیام.');
    }
}

/**
 * Handles the 'getIssues' action.
 *
 * @param array $issuesData The issues data.
 * @param array $currentUser The information about the currently logged-in user.
 * @throws Exception If the user is not authorized.
 * @return void
 */
function handleGetIssues($issuesData, $currentUser) {
    if ($currentUser['role'] !== ROLE_MANAGER) throw new Exception('دسترسی مجاز نیست.');
    
    usort($issuesData, fn($a, $b) => ($b['timestamp'] ?? '') <=> ($a['timestamp'] ?? ''));
    echo json_encode(['success' => true, 'data' => $issuesData]);
}


// --- Action Handling ---
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    // Read initial data using locked read function
    $appData = readData(DATA_FILE);
    $usersData = readData(USERS_FILE);
    $issuesData = readData(ISSUES_FILE);

    // Critical check: Ensure data files were read correctly
    if ($appData === null || $usersData === null || $issuesData === null) {
        throw new Exception('خطای بحرانی: یک یا چند فایل داده اصلی قابل خواندن نیستند.');
    }

    // Prepare current user info to pass to handlers
    $currentUser = [
        'id' => $CURRENT_USER_ID,
        'role' => $CURRENT_USER_ROLE,
        'departmentId' => $CURRENT_USER_DEPT_ID,
        'permissions' => $CURRENT_USER_PERMS
    ];

    switch ($action) {
        case 'getData':
            handleGetData($appData, $usersData, $currentUser);
            break;
        case 'saveSettings':
            handleSaveSettings($appData, $input, $currentUser);
            break;
        case 'saveEvent':
            handleSaveEvent($appData, $input, $currentUser);
            break;
        case 'updateEventStatus':
            handleUpdateEventStatus($appData, $input, $currentUser);
            break;
        case 'deleteEvent':
            handleDeleteEvent($appData, $input, $currentUser);
            break;
        case 'manageDepartments':
            handleManageDepartments($appData, $input, $currentUser);
            break;
        case 'manageUsers':
            handleManageUsers($usersData, $appData, $input, $currentUser);
            break;
        case 'reportIssue':
            handleReportIssue($issuesData, $input, $currentUser);
            break;
        case 'getIssues':
            handleGetIssues($issuesData, $currentUser);
            break;
        default:
            http_response_code(400); // Bad Request
            throw new Exception('عملیات درخواستی نامعتبر است.');
    }
} catch (Exception $e) {
    $statusCode = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 500;
    http_response_code($statusCode);
    
    error_log("API Error [" . $action . "]: " . $e->getMessage() . "\nTrace: " . $e->getTraceAsString());
    
    $errorMessage = $e->getMessage();
    if ((strpos($errorMessage, '/') !== false || strpos($errorMessage, '\\') !== false) && getenv('APP_ENV') !== 'development') {
        $errorMessage = 'یک خطای داخلی رخ داده است.';
    }
    echo json_encode(['success' => false, 'message' => $errorMessage]);
}

/**
 * Helper function to check if a hex color is light or dark.
 *
 * @param string|null $hexColor The hex color string (e.g., '#RRGGBB' or '#RGB').
 * @return boolean True if the color is light, false otherwise.
 */
function isLightColor($hexColor) {
    if (!$hexColor || !is_string($hexColor)) return false;
    $hexColor = ltrim($hexColor, '#');
    if (strlen($hexColor) == 3) {
        $r = hexdec(str_repeat(substr($hexColor, 0, 1), 2));
        $g = hexdec(str_repeat(substr($hexColor, 1, 1), 2));
        $b = hexdec(str_repeat(substr($hexColor, 2, 1), 2));
    } elseif (strlen($hexColor) == 6) {
        $r = hexdec(substr($hexColor, 0, 2));
        $g = hexdec(substr($hexColor, 2, 2));
        $b = hexdec(substr($hexColor, 4, 2));
    } else {
        return false;
    }
    // Formula to determine brightness
    $brightness = (($r * 299) + ($g * 587) + ($b * 114)) / 1000;
    return $brightness > 155; // Threshold can be adjusted
}

?>