<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
session_start();
// اگر کاربر از قبل لاگین بود، به داشبورد برود
if (isset($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'];
    $password = $_POST['password'];

    $users = json_decode(file_get_contents('./data/users.json'), true);
    
    $found_user = null;
    foreach ($users as $user) {
        if ($user['username'] === $username) {
            $found_user = $user;
            break;
        }
    }

    if ($found_user && password_verify($password, $found_user['password_hash'])) {
        // احراز هویت موفق
        $_SESSION['user_id'] = $found_user['id'];
        $_SESSION['username'] = $found_user['username'];
        $_SESSION['displayName'] = $found_user['displayName']; // <-- فیلد جدید اضافه شد
        $_SESSION['role'] = $found_user['role'];
        $_SESSION['departmentId'] = $found_user['departmentId'];
        $_SESSION['permissions'] = $found_user['permissions'];
        
        // Debugging: Check if session is being set
        error_log("Session created for user: " . $found_user['username']);

        header('Location: index.php');
        exit;
    } else {
        // احراز هویت ناموفق
        $error = 'نام کاربری یا رمز عبور اشتباه است.';
    }
}
?>

<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>ورود به سیستم تقویم</title>
    <link rel="stylesheet" href="style.css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body class="login-page">
    <div class="login-container">
        <h1>ورود به تقویم</h1>
        <p>برای ورود از اطلاعات زیر استفاده کنید:
            <br><b>مدیر:</b> admin / password123
            <br><b>کاربر:</b> proposer / password123
        </p>
        <?php if ($error): ?>
            <div class="login-error"><?php echo $error; ?></div>
        <?php endif; ?>
        <form method="POST" action="login.php">
            <div class="form-group">
                <label for="username">نام کاربری:</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">رمز عبور:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">ورود</button>
        </form>
    </div>
</body>
</html>