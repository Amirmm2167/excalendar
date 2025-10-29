<?php
session_start();
// Redirect to login if not authenticated
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit; // 
}

$user_role = $_SESSION['role'] ?? 'viewer'; // Default role

// Prepare user data for JavaScript injection (sanitize display name)
$user_data_json = json_encode([
    'id' => $_SESSION['user_id'],
    'username' => $_SESSION['username'],
    'displayName' => htmlspecialchars($_SESSION['displayName'] ?? 'کاربر', ENT_QUOTES, 'UTF-8'), // Sanitize for JS, provide default
    'role' => $user_role,
    'departmentId' => $_SESSION['departmentId'] ?? null,
    'permissions' => $_SESSION['permissions'] ?? [] // Ensure permissions is at least an empty array
]); // 
// Get current server time in Tehran timezone (ISO 8601 format)
date_default_timezone_set('Asia/Tehran');
$current_server_time = date('c'); // e.g., 2023-10-27T15:30:00+03:30
$tehran_offset = date('P'); // e.g., +03:30

?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>تقویم هفتگی</title>
    
    <link rel="stylesheet" href="style.css?v=1.5.8"> <link rel="icon" href="/favicon.ico" sizes="any"> 
    <link rel="apple-touch-icon" href="/apple-touch-icon.png"> 
</head>

<body class="display-page" data-view="grid"> 
    
    <script>
        const CURRENT_USER = <?php echo $user_data_json; ?>; // 
        const CURRENT_SERVER_TIME_ISO = "<?php echo $current_server_time; ?>";
        const TEHRAN_TIMEZONE_OFFSET = "<?php echo $tehran_offset; ?>"; // 
    </script>

    
    <div id="loader-overlay" class="hidden">
        <div class="spinner"></div>
    </div>
    
    <div id="toast-container"></div>

    
    <div class="page-container">
        
        <header class="main-header">
            <div class="header-controls left-controls">
                
                 <button id="today-btn" class="header-btn" title="رفتن به هفته جاری">امروز</button> <div id="color-legend-container">
                    <button id="color-legend-btn" class="header-btn">راهنمای رنگ</button>
                    <div id="color-legend-popup" class="popup"></div> </div>
              
                
                <?php if ($user_role === 'evaluator' || $user_role === 'manager'): ?>
                    <button id="view-toggle-btn" class="header-btn secondary">نمای لیستی</button> <?php endif; ?>
            </div>

            
            <div class="week-navigator">
                 <button id="prev-week-btn" class="week-nav-btn icon-btn" title="هفته قبل"> 
                    <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                 </button> <h1 id="calendar-title" title="انتخاب هفته"></h1>
                <button id="next-week-btn" class="week-nav-btn icon-btn" title="هفته بعد"> 
                    <svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                </button>
            </div> <div id="mini-calendar" class="popup">
                <div class="mini-calendar-header">
                    <button id="mini-calendar-prev" class="mini-cal-nav icon-btn" title="ماه قبل">«</button> 
                    <span id="mini-calendar-header"></span> <button id="mini-calendar-next" class="mini-cal-nav icon-btn" title="ماه بعد">»</button> </div>
                <div class="mini-calendar-weekdays">
                    <span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span>
                </div>
                 <div id="mini-calendar-days"></div> </div>

            <div class="header-controls right-controls">
                <span class="user-display-name">کاربر: <?php echo htmlspecialchars($_SESSION['displayName'] ?? 'کاربر'); ?></span> <a href="logout.php" class="logout-btn">خروج</a>
            </div>
        </header>

        
        <div id="calendar-grid-container">
            </div>
        <div id="calendar-list-container" style="display: none;">
            </div>
    </div>

    
    <div class="fab-container">
        <button class="fab fab-main" id="fab-main-btn" title="منوی اصلی">
            <span>+</span>
        </button>
        <div class="fab-menu" id="fab-menu"></div>
    </div>

    

    
    <div id="event-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="event-modal-title" style="display: none;">
        <div class="modal-content">
            <h3 id="event-modal-title">ثبت رویداد جدید</h3>
            <form id="event-form" novalidate>
                <input type="hidden" id="eventId">

                <div class="form-row">
                     <div class="form-group">
                        <label for="eventTitle">عنوان*</label>
                         <input type="text" id="eventTitle" required> </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                         <label for="eventBy">مجری</label>
                        <input type="text" id="eventBy"> </div>
                    <div class="form-group">
                        <label for="eventFor">مخاطب</label>
                         <input type="text" id="eventFor"> </div>
                </div>

                <div class="form-group" id="event-goal-group">
                    <label for="eventGoal">هدف</label>
                     <textarea id="eventGoal" rows="3"></textarea> </div>

    
                <div id="event-colors-manager" style="display: none;">
                     <div class="form-row">
                         <div class="form-group color-picker">
                            <label for="eventBgColor">رنگ پس‌زمینه</label> <input type="color" id="eventBgColor" value="#5c6bc0">
                        </div>
                         <div class="form-group color-picker">
                             <label for="eventTextColor">رنگ متن</label> <input type="color" id="eventTextColor" value="#ffffff">
                         </div> </div>
                </div>

    
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="isAllDay">
                     <label for="isAllDay">رویداد تمام-روز</label> </div>

    
                <div id="time-inputs" class="time-inputs-container multi-day">
    
                    <div class="form-group">
                        <label for="startDate">از تاریخ:</label> <div class="input-group">
                             <input type="date" id="startDate" required> <button type="button" id="start-day-picker-btn" class="input-group-btn icon-btn" title="انتخاب تاریخ">📅</button>
                         </div>
                    </div>
                    <div class="form-group">
                        <label for="startTime">ساعت:</label> <div class="input-group">
                             <input type="time" id="startTime" class="time-input" value="09:00" required step="1800"> </div>
                    </div>
    
                    <div class="form-group">
                        <label for="endDate">تا تاریخ:</label> <div class="input-group">
                             <input type="date" id="endDate" required> <button type="button" id="end-day-picker-btn" class="input-group-btn icon-btn" title="انتخاب تاریخ">📅</button>
                         </div>
                    </div>
                     <div class="form-group">
                        <label for="endTime">ساعت:</label> <div class="input-group">
                            <input type="time" id="endTime" class="time-input" value="10:00" required step="1800" list="endTimeSuggestions"> <datalist id="endTimeSuggestions"> <option value="24:00"></option> </datalist> </div>
                    </div>
                </div>

    
                <div class="modal-actions">
                    <div id="approval-actions" style="display: none;">
                         <button type="button" id="approve-event-btn" class="action-btn success">تایید رویداد</button> <button type="button" id="reject-event-btn" class="action-btn danger">رد رویداد</button> </div>
    
                    <div class="standard-actions">
                        <button type="button" id="delete-event-btn" class="action-btn danger icon-btn" style="display: none;" title="حذف">🗑️</button> <button type="submit" id="save-event-btn" class="action-btn primary">ذخیره</button> <button type="button" id="cancel-event-btn" class="action-btn secondary">انصراف</button> </div>
                </div>
             </form> </div>
    </div>

    
    <div id="settings-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" style="display: none;">
        <div class="modal-content">
            <h3 id="settings-modal-title">تنظیمات اصلی تقویم</h3>
            <div class="form-group">
                <label for="mainHeader">عنوان اصلی تقویم</label>
                <input type="text" id="mainHeader"> </div>
            <div class="form-group">
                <label for="weekSelector">انتخاب هفته پیش‌فرض</label>
                <select id="weekSelector"></select>
            </div>
            <div class="modal-actions single-row">
                 <button id="save-settings-btn" class="action-btn primary">ذخیره تنظیمات</button> <button type="button" id="cancel-settings-btn" class="action-btn secondary">انصراف</button>
            </div>
        </div>
    </div>

    
    <div id="depts-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="depts-modal-title" style="display: none;">
        <div class="modal-content">
            <h3 id="depts-modal-title">مدیریت دپارتمان‌ها</h3>
            <div id="depts-list-editor">
                </div> <button type="button" id="add-new-dept-btn" class="action-btn secondary add-item-btn"> + افزودن دپارتمان جدید</button>
            <div class="modal-actions single-row">
                <button id="save-depts-btn" class="action-btn primary">ذخیره دپارتمان‌ها</button>
                <button type="button" id="cancel-depts-btn" class="action-btn secondary">انصراف</button>
            </div>
         </div> </div>

    
    <div id="users-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="users-modal-title" style="display: none;">
        <div class="modal-content large">
            <h3 id="users-modal-title">مدیریت کاربران</h3>
            <div id="users-list-editor">
                </div>
             <button type="button" id="add-new-user-btn" class="action-btn secondary add-item-btn">+ افزودن کاربر جدید</button> <div class="modal-actions single-row">
                <button type="button" id="cancel-users-btn" class="action-btn secondary">بستن</button>
            </div>
        </div>
    </div>

    
    <div id="issue-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title" style="display: none;">
        <div class="modal-content">
             <h3 id="issue-modal-title">گزارش مشکل / بازخورد</h3> <form id="issue-form">
                <div class="form-group">
                    <label for="issue-text">لطفا مشکل یا بازخورد خود را بنویسید:</label>
                    <textarea id="issue-text" rows="5" required></textarea> </div>
                <div class="modal-actions single-row">
                     <button type="button" id="send-issue-btn" class="action-btn primary">ارسال پیام</button> <button type="button" id="cancel-issue-btn" class="action-btn secondary">انصراف</button>
                </div>
            </form>
        </div>
    </div>

    
    <div id="view-issues-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="view-issues-modal-title" style="display: none;">
         <div class="modal-content">
            <h3 id="view-issues-modal-title">مشاهده پیام‌های دریافتی</h3>
            <div id="issues-list-container">
                </div>
            <div class="modal-actions single-row"> <button type="button" id="close-issues-btn" class="action-btn secondary">بستن</button>
            </div>
        </div>
    </div> <script src="app.js?v=1.5.8"></script> </body>

</html>