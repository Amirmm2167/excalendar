/* app.js - V.1.5.8 FINAL (با تمام توابع) */

/**
 * Weekly Calendar Application - V.1.5.8
 * Merges strengths:
 * - UI/UX Features (Toast, FAB, Mini-Cal, Today Btn)
 * - Pinch-to-Zoom & Swipe Navigation (from V.1.5.6)
 * - Date/Time Inputs (from V.1.5.7)
 * - Robust Timezone & Server Time Handling
 * - Click-to-Create & Multi-Day Rendering
 * - Bug Fixes for UI, Gestures, and Time Indicator.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const WEEK_DAYS_PERSIAN = Object.freeze(['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']); // 
    const ROLES = Object.freeze({ MANAGER: 'manager', EVALUATOR: 'evaluator', PROPOSER: 'proposer', VIEWER: 'viewer' }); // 
    const STATUS = Object.freeze({ APPROVED: 'approved', PENDING: 'pending', REJECTED: 'rejected' }); // 
    const POLLING_INTERVAL_MS = 10000; // Poll every 10 seconds 
    const TIME_INDICATOR_INTERVAL_MS = 60000; // Update time indicator every minute 
    const MS_PER_DAY = 86400000; // 1000 * 60 * 60 * 24

    // --- Application State ---
    const appState = {
        fullData: { settings: {}, events: [], holidays: [], departments: [], users: [] }, // 
        currentView: 'grid', // 'grid' or 'list' 
        currentWeekStartDate: new Date(), // Initialized properly on load 
        initialServerTime: null, // Baseline server time from index.php 
        initialClientTime: null, // Baseline client time for estimations 
        pollingInterval: null, // 
        lastFetchedEventsString: '', // Store only events string for change detection 
        timeIndicatorInterval: null, // 
        mobileHeaderActualHeight: 105, // Default, will be calculated 
        miniCal: { // 
            currentMonthDate: new Date(), // Month currently shown in mini-calendar
            selectedDate: null, // Date selected in mini-calendar (Date object)
            targetInputId: null, // ID of the input being set ('startDate', 'endDate', or 'calendarTitle')
            visible: false
        },
        gestureState: { // For mobile pinch/swipe (from V.1.5.6) 
            active: false, type: null, startX: 0, startY: 0, lastDist: 0, isSwipe: false, swipeStartX: 0, swipeStartY: 0, swipeMinDist: 50
        },
        mobileViewConfig: { // For mobile zoom/layout (from V.1.5.6) 
            dayCount: 7, hourZoom: 2 // Defaults: 7 days, zoom level 2
        },
        toastTimeout: null // For managing toast display timeout 
    };

    // --- Element Selectors (Cached) ---
    const elements = {
        loader: document.getElementById('loader-overlay'), // 
        toastContainer: document.getElementById('toast-container'), // New
        pageContainer: document.querySelector('.page-container'), // 
        mainHeader: document.querySelector('.main-header'), // 
        calendarTitle: document.getElementById('calendar-title'), // 
        todayBtn: document.getElementById('today-btn'), // New
        prevWeekBtn: document.getElementById('prev-week-btn'), // 
        nextWeekBtn: document.getElementById('next-week-btn'), // 
        legendBtn: document.getElementById('color-legend-btn'), // 
        legendPopup: document.getElementById('color-legend-popup'), // 
        viewToggleBtn: document.getElementById('view-toggle-btn'), // 
        calendarGridContainer: document.getElementById('calendar-grid-container'), // 
        calendarListContainer: document.getElementById('calendar-list-container'), // 
        fabContainer: document.querySelector('.fab-container'), // 
        fabMainBtn: document.getElementById('fab-main-btn'), // 
        fabMenu: document.getElementById('fab-menu'), // 
        // Mini Calendar
        miniCalendarPopup: document.getElementById('mini-calendar'), // New
        miniCalPrevBtn: document.getElementById('mini-calendar-prev'), // 
        miniCalNextBtn: document.getElementById('mini-calendar-next'), // 
        miniCalMonthYear: document.getElementById('mini-cal-month-year'), // 
        miniCalDaysContainer: document.getElementById('mini-calendar-days'), // New
        // Event Modal (Using V1.5.7 date/time inputs)
        eventModal: document.getElementById('event-modal'), // 
        eventModalTitle: document.getElementById('event-modal-title'), // 
        eventForm: document.getElementById('event-form'), // 
        eventIdInput: document.getElementById('eventId'), // 
        eventTitleInput: document.getElementById('eventTitle'), // 
        eventByInput: document.getElementById('eventBy'), // 
        eventForInput: document.getElementById('eventFor'), // 
        eventGoalGroup: document.getElementById('event-goal-group'), // 
        eventGoalInput: document.getElementById('eventGoal'), // 
        isAllDayCheckbox: document.getElementById('isAllDay'), // 
        startDateInput: document.getElementById('startDate'), // Changed ID from V1.5.6
        startTimeInput: document.getElementById('startTime'), // 
        endDateInput: document.getElementById('endDate'),   // Changed ID
        endTimeInput: document.getElementById('endTime'),   //
        startDayPickerBtn: document.getElementById('start-day-picker-btn'), //
        endDayPickerBtn: document.getElementById('end-day-picker-btn'),     //
        approvalActions: document.getElementById('approval-actions'), // 
        approveEventBtn: document.getElementById('approve-event-btn'), // 
        rejectEventBtn: document.getElementById('reject-event-btn'), // 
        deleteEventBtn: document.getElementById('delete-event-btn'), // 
        saveEventBtn: document.getElementById('save-event-btn'), // 
        cancelEventBtn: document.getElementById('cancel-event-btn'), // 
        managerColorInputs: document.getElementById('event-colors-manager'), // 
        eventBgColorInput: document.getElementById('eventBgColor'), // 
        eventTextColorInput: document.getElementById('eventTextColor'), // 
        // Settings Modal
        settingsModal: document.getElementById('settings-modal'), // 
        mainHeaderInput: document.getElementById('mainHeader'), // 
        weekSelector: document.getElementById('weekSelector'), // 
        saveSettingsBtn: document.getElementById('save-settings-btn'), // 
        cancelSettingsBtn: document.getElementById('cancel-settings-btn'), // 
        // Departments Modal
        deptsModal: document.getElementById('depts-modal'), // 
        deptsListEditor: document.getElementById('depts-list-editor'), // 
        addNewDeptBtn: document.getElementById('add-new-dept-btn'), // 
        saveDeptsBtn: document.getElementById('save-depts-btn'), // 
        cancelDeptsBtn: document.getElementById('cancel-depts-btn'), // 
        // Users Modal
        usersModal: document.getElementById('users-modal'), // 
        usersListEditor: document.getElementById('users-list-editor'), // 
        addNewUserBtn: document.getElementById('add-new-user-btn'), // 
        cancelUsersBtn: document.getElementById('cancel-users-btn'), // 
        // Issue Modals
        issueModal: document.getElementById('issue-modal'), // 
        issueTextInput: document.getElementById('issue-text'), // 
        sendIssueBtn: document.getElementById('send-issue-btn'), // 
        cancelIssueBtn: document.getElementById('cancel-issue-btn'), // 
        viewIssuesModal: document.getElementById('view-issues-modal'), // 
        issuesListContainer: document.getElementById('issues-list-container'), // 
        closeIssuesBtn: document.getElementById('close-issues-btn'), // 
    };

    // --- Helper Functions ---
    const showLoader = () => elements.loader?.classList.remove('hidden'); // 
    const hideLoader = () => elements.loader?.classList.add('hidden'); // 
    const toPersianNum = (str) => String(str).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[+w]); // 
    const timeToMinutes = (timeStr) => { // 
        if (!timeStr) return 0; // 
        const parts = String(timeStr).split(':');
        const h = parseInt(parts[0] || '0', 10);
        const m = parseInt(parts[1] || '0', 10); // 
        if (h === 24 && m === 0) return 24 * 60; // Handle 24:00 
        return h * 60 + m; // 
    };
    const formatDate = (date) => { // Returns "YYYY-MM-DD" 
        if (!date || isNaN(date)) return ''; // 
        try { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; } // 
        catch (e) { console.error("FormatDate Error:", e); return ''; } // 
    };
    const formatTime = (timeStr) => { // Ensures "HH:MM" or returns "00:00" on error, keeps "24:00" 
        if (!timeStr) return "00:00"; // 
        const trimmedTime = String(timeStr).trim();
        if (trimmedTime === '24:00') return '24:00'; // 
        const parts = trimmedTime.split(':');
        const hVal = parseInt(parts[0], 10); // 
        const mVal = parseInt(parts[1], 10);
        if (isNaN(hVal) || isNaN(mVal) || hVal < 0 || hVal >= 24 || mVal < 0 || mVal >= 60) {
            console.warn("Invalid time format detected:", timeStr); // 
            return "00:00"; // 
        }
        return `${String(hVal).padStart(2, '0')}:${String(mVal).padStart(2, '0')}`; // 
    };

    /**
     * Combines a FULL DATE string (YYYY-MM-DD) and time string ("HH:MM" or "24:00")
     * into an ISO 8601 formatted string WITH the Tehran offset.
     * This ensures the time selected by the user is interpreted as Tehran time *on that specific date*.
     */
    const combineDateTime = (dateString, timeString) => {
        try {
            if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                throw new Error("Invalid date string format (YYYY-MM-DD required)"); // 
            }

            // 1. Format the time part (HH:MM or 24:00)
            const timePart = formatTime(timeString); // 
            // 2. Get the required Tehran offset
            const offset = TEHRAN_TIMEZONE_OFFSET || '+03:30'; // Use provided or default 

            // 3. Construct the final ISO string
            if (timePart === "24:00") {
                // Represent as 24:00:00 on the *given date* with Tehran offset
                return `${dateString}T24:00:00${offset}`; // 
            } else {
                // Represent as HH:MM:00 for the *given date* with Tehran offset
                return `${dateString}T${timePart}:00${offset}`; // 
            }
        } catch (e) {
            console.error("combineDateTime Error:", e, { dateString, timeString }); // 
            showToast("خطا در پردازش تاریخ و زمان ورودی.", true); // 
            return null;
        }
    };

    /**
     * Calculates the day index (0-6) relative to the current week start date
     * from a full ISO date/time string (potentially with an offset).
     * - Simplified logic using date difference.
     */
    const getDayIndexFromDateTime = (dateTimeString) => {
        try {
            const eventDate = new Date(dateTimeString); // 
            // Handle T24:00:00 - treat it as the very end of the previous day for index calculation
            if (dateTimeString.includes('T24:00:00')) {
                eventDate.setTime(eventDate.getTime() - 1); // Go back 1 millisecond
            }

            if (isNaN(eventDate)) throw new Error("Invalid date string"); // 
            // Ensure comparison dates are at the start of the day in the *local* timezone
            // This works because both eventDate and weekStart are Date objects, comparison handles TZ
            const eventStartOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()); // 
            const weekStartOfDay = new Date(appState.currentWeekStartDate.getFullYear(), appState.currentWeekStartDate.getMonth(), appState.currentWeekStartDate.getDate()); // 

            const diffTime = eventStartOfDay.getTime() - weekStartOfDay.getTime(); // 
            const diffDays = Math.round(diffTime / MS_PER_DAY); // 
            // Clamp the result between 0 and 6
            return Math.max(0, Math.min(6, diffDays)); // 
        } catch (e) {
            console.error("getDayIndexFromDateTime Error:", e, dateTimeString); // 
            return 0; // Fallback 
        }
    };

    /**
     * Gets timezone-specific parts (dayIndex, hour, minute) using Intl for Tehran.
     * - Added more robust error handling.
     */
    function getTehranParts(dateObj) {
        try {
            // First convert the input date to Tehran time
            const tehranDate = new Date(dateObj.toLocaleString('en-US', {
                timeZone: 'Asia/Tehran'
            }));
            
            // Create a formatter for detailed parts
            const formatter = new Intl.DateTimeFormat('en-CA-u-hc-h23', {
                timeZone: 'Asia/Tehran',
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', second: 'numeric',
                weekday: 'long',
                hour12: false // Ensure 24-hour format
            });
            
            const parts = formatter.formatToParts(dateObj);
            const getValue = (type) => {
                const part = parts.find(p => p.type === type);
                if (!part && type !== 'second') {
                    console.warn(`Missing ${type} in date parts`, parts);
                }
                return part?.value;
            };

            // Convert English weekday name to our 0-6 index (Saturday = 0)
            const dayName = getValue('weekday');
            const dayMap = {
                'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 
                'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 
                'Saturday': 6
            };
            
            // Validate we got a valid weekday
            if (dayName === undefined || !dayMap.hasOwnProperty(dayName)) {
                throw new Error(`Invalid weekday: ${dayName}`);
            }
            
            const appDayIndex = (dayMap[dayName] + 1) % 7;

            // Parse hour with validation
            let hour = parseInt(getValue('hour'), 10);
            if (isNaN(hour) || hour < 0 || hour > 24) {
                throw new Error(`Invalid hour: ${getValue('hour')}`);
            }
            
            // Special handling for midnight
            if (hour === 24) hour = 0;

            // Parse minute with validation
            const minute = parseInt(getValue('minute'), 10);
            if (isNaN(minute) || minute < 0 || minute > 59) {
                throw new Error(`Invalid minute: ${getValue('minute')}`);
            }

            return {
                dayIndex: appDayIndex,
                hour: hour,
                minute: minute,
                // Include full parsed data for debugging
                debug: {
                    year: getValue('year'),
                    month: getValue('month'),
                    day: getValue('day'),
                    offset: parts.find(p => p.type === 'timeZoneName')?.value
                }
            };
        } catch (e) {
            console.error("getTehranParts Error:", e, {
                input: dateObj,
                fallback: 'Using local time'
            });
            
            // More robust fallback using local time
            const d = new Date(dateObj);
            if (isNaN(d.getTime())) {
                console.error("Invalid date object in fallback");
                return {
                    dayIndex: 0,
                    hour: 0,
                    minute: 0,
                    error: true
                };
            }
            
            const localDayIndex = (d.getDay() + 1) % 7;
            return {
                dayIndex: localDayIndex >= 0 ? localDayIndex : 6,
                hour: d.getHours(),
                minute: d.getMinutes(),
                usingFallback: true
            };
        }
    }

    /**
     * Estimates current server time based on initial offset.
     * - More robust.
     */
    function estimateCurrentServerTime() {
        if (!appState.initialServerTime || !appState.initialClientTime) {
            // console.warn("Initial times not set, using client time for estimation.");
            return new Date(); // Fallback if initial times aren't ready 
        }
        try {
            const elapsed = new Date().getTime() - appState.initialClientTime.getTime(); // 
            const estimated = new Date(appState.initialServerTime.getTime() + elapsed); // 
            if (isNaN(estimated)) throw new Error("Invalid date calculation");
            return estimated; // 
        } catch(e) {
            console.error("Error estimating server time:", e); // 
            return new Date(); // Fallback to client time on error 
        }
    }

    /**
     * Determines if a background color is light or dark for text contrast.
     * 
     */
    function isColorLight(bgColor) {
        if (!bgColor) return false; // 
        let color = bgColor.startsWith('#') ? bgColor.substring(1, 7) : bgColor; // 
        if (color.length === 3) {
            color = color.split('').map(char => char + char).join(''); // 
        }
        if (color.length !== 6) return false; // Invalid hex
        const r = parseInt(color.substring(0, 2), 16); // 
        const g = parseInt(color.substring(2, 4), 16); // 
        const b = parseInt(color.substring(4, 6), 16); // 
        // HSP equation from http://alienryderflex.com/hsp.html
        const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)); // 
        // Using 127.5 as threshold
        return hsp > 127.5; // 
    }

    /**
     * Validates start and end dates/times when either is changed.
     * Ensures end date/time is not before start date/time.
     */
    function validateEventDates() {
        const startDate = elements.startDateInput.value;
        const endDate = elements.endDateInput.value;
        const startTime = elements.startTimeInput.value;
        const endTime = elements.endTimeInput.value;

        if (startDate && endDate) {
            const start = new Date(`${startDate}T${startTime || '00:00'}`);
            const end = new Date(`${endDate}T${endTime === '24:00' ? '23:59:59' : (endTime || '00:00')}`);

            if (end < start) {
                elements.endDateInput.value = startDate;
                showToast('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.', 'warning');
            }
        }
    }

    /**
     * Shows a toast notification.
     * type: 'success', 'error', 'warning', 'info'
     */
     function showToast(message, type = 'info', duration = 3000) {
        if (!elements.toastContainer) return; // 
        // Clear any existing toast timeout
        if (appState.toastTimeout) clearTimeout(appState.toastTimeout);

        const toast = document.createElement('div'); // 
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast); // 
        // Trigger reflow to enable animation
        requestAnimationFrame(() => { // Use rAF for smoother start 
            toast.classList.add('show'); // 
        });

        // Set timeout to remove the toast
        appState.toastTimeout = setTimeout(() => { // 
            toast.classList.remove('show');
            // Remove from DOM after transition ends for smooth fade out
            toast.addEventListener('transitionend', () => toast.remove(), { once: true }); // 
        }, duration); // 
    }

    // ===================================================================
    // 2. API Call Function
    // ===================================================================
    async function apiCall(action, data = null, method = 'POST') {
        const isPollingGet = action === 'getData' && appState.pollingInterval && method === 'GET'; // 
        if (!isPollingGet) showLoader(); // Show loader unless it's a background poll 

        try {
            const options = { method: method, headers: { 'Content-Type': 'application/json' }, }; // 
            let url = `api.php?action=${action}`; // 

            if (method === 'POST') {
                if (data) options.body = JSON.stringify(data); // 
            } else if (method === 'GET' && data) {
                const params = new URLSearchParams(data); // 
                url += `&${params.toString()}`; // 
            }

            const response = await fetch(url, options); // 
            const responseText = await response.text(); // 

            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}. Response Text:`, responseText); // 
                let errorMsg = `خطای HTTP ${response.status}`; // 
                try {
                    const errorJson = JSON.parse(responseText); // 
                    errorMsg = errorJson.message || errorMsg; // 
                } catch (e) { /* Ignore parsing error */ }
                throw new Error(errorMsg); // 
            }

            const result = JSON.parse(responseText); // 
            if (!result.success) {
                console.error('API Error Payload:', result); // 
                throw new Error(result.message || 'خطای ناشناخته از سرور'); // 
            }
            return result; // 
        } catch (error) {
            console.error('API Call Error:', error); // 
            // Only show error toast if it wasn't a silent background poll
            if (!isPollingGet) {
                showToast(`خطا: ${error.message}`, true); // 
            }
            return null; // Return null on error
        } finally {
             if (!isPollingGet) hideLoader(); // 
        }
    }

    // ===================================================================
    // 3. MAIN RENDER LOGIC & State Update
    // ===================================================================

    /**
     * Fetches data for the current week and updates the state + UI.
     * Can be called for initial load or navigation.
     */
    async function fetchAndRenderCurrentWeekData() {
        const currentWeekStartStr = formatDate(appState.currentWeekStartDate); // 
        const isPolling = !!appState.pollingInterval; // Check if polling is active 
        appState.pollingInterval = true; // Temporarily flag as polling to suppress loader in apiCall

        const result = await apiCall('getData', { weekStartDate: currentWeekStartStr }, 'GET'); // 
        appState.pollingInterval = isPolling; // Restore original polling status 

        if (result?.data) {
            const newEventsString = JSON.stringify(result.data.events || []); // 
            // Check if events actually changed before full re-render
            if (newEventsString !== appState.lastFetchedEventsString) {
                console.log("Data changed, rendering..."); // 
                appState.lastFetchedEventsString = newEventsString; // 
                appState.fullData = result.data; // Update entire state data 
                updateUI(); // Perform full UI update
            } else {
                // If only settings/users/etc changed, update those parts
                appState.fullData.settings = result.data.settings || {}; // 
                appState.fullData.users = result.data.users || []; // 
                appState.fullData.departments = result.data.departments || []; // 
                appState.fullData.holidays = result.data.holidays || []; // 
                // Only re-render necessary parts
                updateCalendarTitle(); // 
                renderColorLegend(); // 
                console.log("No event changes detected."); // 
            }
            // Always ensure time indicator is correct after fetch
            startTimeIndicator(); // 
        } else {
            console.error("واکشی داده‌های هفته ناموفق بود."); // 
            showToast("خطا در واکشی داده‌های تقویم.", true); // 
        }
    }

    /**
     * Initial load function.
     * 
     */
    async function loadAndRender() {
        stopPolling(); // Ensure no polling during initial load

        // Calculate mobile header height after CSS is loaded
        calculateMobileHeaderHeight(); // 
        const result = await apiCall('getData', null, 'GET'); // Get data for default week 

        if (result?.data) {
            appState.lastFetchedEventsString = JSON.stringify(result.data.events || []); // 
            appState.fullData = result.data; // 
            appState.currentWeekStartDate = getStartDate(appState.fullData.settings?.weekStartDate); // Set week based on settings or server time 

            // Set baseline times for server time estimation
            try {
                appState.initialServerTime = new Date(CURRENT_SERVER_TIME_ISO); // 
                appState.initialClientTime = new Date(); // 
                if (isNaN(appState.initialServerTime)) throw new Error(); // 
            } catch(e) {
                console.error("Invalid server time provided, time indicator may be inaccurate.", CURRENT_SERVER_TIME_ISO); // 
                appState.initialServerTime = new Date(); // Fallback to client time 
                appState.initialClientTime = new Date(); // 
            }

            // Set document title
            document.title = appState.fullData.settings?.headerText || "تقویم هفتگی"; // 

            // Initial full UI render
            updateUI(); // 
        } else {
            console.error("لود اولیه داده‌ها ناموفق بود."); // 
            showToast("خطا در بارگذاری اولیه تقویم.", true); // 
            // Optionally, display an error message in the main container
            if(elements.calendarGridContainer) elements.calendarGridContainer.innerHTML = "<p style='text-align: center; padding: 2rem;'>خطا در بارگذاری اطلاعات.</p>"; // 
        }

        startPolling(); // Start polling after successful initial load 
    }

    /**
     * Central function to update all major UI components based on appState.
     * 
     */
    function updateUI() {
        updateCalendarTitle(); // 
        renderCurrentView(); // Renders Grid or List
        renderColorLegend(); // 
        setupFabMenu(); // Re-setup FAB in case permissions changed (unlikely but safe)
        // Time indicator is started/updated within renderCurrentView -> renderGridView
    }

    // --- Polling Logic ---
    function startPolling() {
        stopPolling(); // Clear existing interval if any
        console.log("Polling started..."); // 
        appState.pollingInterval = setInterval(fetchAndRenderCurrentWeekData, POLLING_INTERVAL_MS); // 
    }
    function stopPolling() {
        if (appState.pollingInterval) {
            clearInterval(appState.pollingInterval); // 
            appState.pollingInterval = null; // 
            console.log("Polling stopped."); // 
        }
    }

    // --- View Rendering ---
    function renderCurrentView() {
        const isGrid = appState.currentView === 'grid'; // 
        if (elements.calendarGridContainer) elements.calendarGridContainer.style.display = isGrid ? 'flex' : 'none'; // Use flex for grid container 
        if (elements.calendarListContainer) elements.calendarListContainer.style.display = isGrid ? 'none' : 'block'; // 
        document.body.dataset.view = appState.currentView; // Update body attribute 

        if (isGrid) {
            renderGridView(); // 
        } else {
            renderListView(); // 
        }
        updateTimeIndicator(); // Always update indicator after view render 
    }

    /**
     * Updates the main calendar title (e.g., "(۱۷ آبان - ۲۳ آبان ۱۴۰۴)")
     */
    function updateCalendarTitle() {
        if (!elements.calendarTitle) return; // 
        try {
            const start = new Date(appState.currentWeekStartDate); // 
            const end = new Date(start); // 
            end.setDate(start.getDate() + 6);

            // Use fa-IR locale for Jalali display and Persian numerals
            const formatterYear = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }); // 
            const formatterMonth = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }); // 

            let startStr, endStr; // 
            if (start.getFullYear() === end.getFullYear()) {
                startStr = formatterMonth.format(start); // 
                endStr = formatterYear.format(end); // Show year only at the end 
            } else {
                startStr = formatterYear.format(start); // 
                endStr = formatterYear.format(end); // 
            }
            elements.calendarTitle.textContent = `(${startStr} - ${endStr})`; // 
        } catch (e) {
            console.error("Error formatting calendar title:", e); // 
            elements.calendarTitle.textContent = "تقویم هفتگی"; // Fallback 
        }
    }

    /**
     * Renders the main grid view (Desktop or Mobile)
     */
    function renderGridView() {
        if (!elements.calendarGridContainer) return; // 
        elements.calendarGridContainer.innerHTML = ''; // Clear previous grid 

        const holidays = Array.isArray(appState.fullData.holidays) ? appState.fullData.holidays : []; // 
        const isMobile = window.matchMedia("(max-width: 768px)").matches; // 

        if (isMobile) {
            document.body.classList.add('mobile-view'); // 
            createMobileGrid(holidays); // 
            updateMobileViewCSS(); // Apply zoom/layout CSS 
        } else {
            document.body.classList.remove('mobile-view'); // 
            createDesktopGrid(holidays); // 
        }

        // Combine events and holidays
        const holidayEvents = holidays.map(h => {
             const dayOffset = parseInt(h.day, 10);
             if (isNaN(dayOffset) || dayOffset < 0 || dayOffset > 6) return null; // 
             const holidayDate = new Date(appState.currentWeekStartDate);
             holidayDate.setDate(holidayDate.getDate() + dayOffset); // 
             const dateStr = formatDate(holidayDate); // 
             return {
                id: `h-${h.day}`, title: h.occasion, isAllDay: true,
                startDateTime: `${dateStr}T00:00:00${TEHRAN_TIMEZONE_OFFSET}`,
                endDateTime: `${dateStr}T24:00:00${TEHRAN_TIMEZONE_OFFSET}`, // Use Tehran offset consistently
                color: '#e57373', textColor: 'white', status: STATUS.APPROVED, isHoliday: true // 
             };
        }).filter(Boolean); // 
        const validEvents = Array.isArray(appState.fullData.events) ? appState.fullData.events : []; // 
        const allEvents = [...validEvents, ...holidayEvents]; // Use spread syntax

        renderAllEvents(allEvents); // Render events onto the grid structure
        // applySmartContent is called within renderAllEvents now
        createOrUpdateTimeIndicator(); // Ensure indicator is present
    }

    /**
     * Creates the HTML structure for the Desktop grid view.
     * 
     */
    function createDesktopGrid(holidays) {
        let gridHTML = `<div class="calendar-grid">
            <div class="grid-header">
                <div class="header-corner"></div>
                <div class="header-allday">تمام روز</div>
                <div class="header-timeline">`; // 
        // Timeline Header Labels (00:00, 01:00, ...)
        for (let i = 0; i < 48; i++) {
            gridHTML += `<div class="time-label">${i % 2 === 0 ? toPersianNum(Math.floor(i / 2)) + ':۰۰' : ''}</div>`; // 
        }
        gridHTML += `</div></div><div class="grid-body">`; // 
        // Day Rows
        const startDate = appState.currentWeekStartDate; // 
        const dateFormatter = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }); // 
        for (let j = 0; j < 7; j++) {
            const currentDate = new Date(startDate); // 
            currentDate.setDate(startDate.getDate() + j); // 
            const dateString = dateFormatter.format(currentDate); // 
            const isHoliday = holidays.some(h => parseInt(h.day, 10) === j); // 
            gridHTML += `<div class="day-row ${isHoliday ? 'is-holiday' : ''}" data-day-index="${j}">
                <div class="day-label"><span>${WEEK_DAYS_PERSIAN[j]}</span><span class="date">${toPersianNum(dateString)}</span></div>
                <div class="all-day-cell" data-day-index="${j}"></div>
                <div class="timeline-cell" data-day-index="${j}"></div>
            </div>`; // 
        }
        gridHTML += `</div></div>`;
        elements.calendarGridContainer.innerHTML = gridHTML; // 
    }

    /**
     * Creates the HTML structure for the Mobile grid view.
     * 
     */
    function createMobileGrid(holidays) {
        let gridHTML = `<div class="mobile-grid">
            <div class="mobile-time-axis">
                <div class="time-axis-corner"></div>
                <div class="time-label-mobile all-day-header">تمام روز</div>`; // 
        // Time Axis Labels (created once, visibility toggled by CSS)
        for (let i = 0; i < 24; i++) {
            gridHTML += `<div class="time-label-mobile" data-hour="${i}">${toPersianNum(i)}:۰۰</div>`; // 
        }
        gridHTML += `</div><div class="mobile-days-container-outer">
                        <div class="mobile-days-container-inner">`; // 
        // Day Columns
        const startDate = appState.currentWeekStartDate; // 
        const dateFormatter = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }); // 
        for (let j = 0; j < 7; j++) {
            const currentDate = new Date(startDate); // 
            currentDate.setDate(startDate.getDate() + j); // 
            const dateString = dateFormatter.format(currentDate); // 
            const isHoliday = holidays.some(h => parseInt(h.day, 10) === j); // 
            gridHTML += `<div class="day-column ${isHoliday ? 'is-holiday' : ''}" data-day-index="${j}">
                <div class="day-label"><span>${WEEK_DAYS_PERSIAN[j]}</span><span class="date">${toPersianNum(dateString)}</span></div>
                <div class="all-day-cell" data-day-index="${j}"></div>
                <div class="timeline-cell" data-day-index="${j}"></div>
            </div>`; // 
        }
        gridHTML += `</div></div></div>`;
        elements.calendarGridContainer.innerHTML = gridHTML; // 
    }

    /**
     * Updates CSS variables for mobile layout based on zoom/day count.
     * 
     */
    function updateMobileViewCSS() {
        const grid = elements.calendarGridContainer?.querySelector('.mobile-grid'); // 
        if (!grid) return;

        grid.style.setProperty('--mobile-day-count', appState.mobileViewConfig.dayCount); // 
        grid.style.setProperty('--mobile-hour-zoom', appState.mobileViewConfig.hourZoom); // 

        // Toggle time label visibility based on zoom
        const labels = grid.querySelectorAll('.time-label-mobile[data-hour]'); // 
        labels.forEach(label => {
            const hour = parseInt(label.dataset.hour, 10); // 
            let show = false;
            switch (appState.mobileViewConfig.hourZoom) {
                case 1: show = (hour % 3 === 0); break; // 8 slots 
                case 2: show = (hour % 2 === 0); break; // 12 slots 
                default: show = true; break; // 24 slots (levels 3 & 4) 
            }
            label.style.display = show ? 'flex' : 'none'; // 
        });
        // Re-calculate content positioning after style change
        applySmartContent(); // 
    }

    /**
     * Renders all events (timed and all-day) onto the grid.
     * - Simplified date logic, integrated smart content.
     */
    function renderAllEvents(events) {
        const isMobile = document.body.classList.contains('mobile-view'); // 
        const weekStart = new Date(appState.currentWeekStartDate);
        weekStart.setHours(0, 0, 0, 0); // Start of the week day
        const weekStartMS = weekStart.getTime(); // 
        const weekEndMS = weekStartMS + 7 * MS_PER_DAY; // End of the week 

        // --- Prepare Data Structures ---
        // Use maps for easier lookup: dayIndex -> { allDay: [], timed: [] }
        const eventsByDay = new Map(); // 
        for (let i = 0; i < 7; i++) {
            eventsByDay.set(i, { allDay: [], timed: [] }); // 
        }

        // --- Process Each Event ---
        for (const event of events) {
            try {
                // Ensure valid start/end times
                if (!event.startDateTime || !event.endDateTime) continue; // 
                const eventStartDT = new Date(event.startDateTime); // 
                let eventEndDT = new Date(event.endDateTime); // Handles offset automatically
                let isEndTime24 = false; // 
                // Handle T24:00:00 specifically
                if (event.endDateTime.includes('T24:00:00')) {
                    isEndTime24 = true; // 
                    // For calculation, treat it as the very start of the *next* day
                    eventEndDT.setTime(eventEndDT.getTime()); // Date object is already correct if parsed from ISO string
                }

                if (isNaN(eventStartDT) || isNaN(eventEndDT)) continue; // Skip invalid dates

                // Clamp event times to the current week view
                const effectiveStartMS = Math.max(weekStartMS, eventStartDT.getTime()); // 
                let effectiveEndMS = Math.min(weekEndMS, eventEndDT.getTime()); // 

                // Calculate start and end day indices relative to the week start
                let startDayIndex = Math.floor((effectiveStartMS - weekStartMS) / MS_PER_DAY); // 
                // For end day, subtract 1ms to handle midnight correctly
                let endDayIndex = Math.floor((effectiveEndMS - weekStartMS - 1) / MS_PER_DAY); // 
                // Clamp indices to the week boundaries (0-6)
                startDayIndex = Math.max(0, Math.min(6, startDayIndex)); // 
                endDayIndex = Math.max(0, Math.min(6, endDayIndex)); // 

                // If event ends before it starts (after clamping), skip
                if (endDayIndex < startDayIndex) continue; // 
                // --- Create Chunks for Each Day the Event Spans ---
                for (let dayIndex = startDayIndex; dayIndex <= endDayIndex; dayIndex++) {
                    const chunk = { ...event, day: dayIndex }; // 
                    const dayData = eventsByDay.get(dayIndex); // 
                    if (!dayData) continue; // Should not happen

                    const dayStartMS = weekStartMS + dayIndex * MS_PER_DAY; // 
                    const dayEndMS = dayStartMS + MS_PER_DAY; // 

                    // Determine if it's part of a multi-day event
                    const eventStartDateOnly = new Date(eventStartDT.getFullYear(), eventStartDT.getMonth(), eventStartDT.getDate()).getTime(); // 
                    let eventEndDateOnly = new Date(eventEndDT.getFullYear(), eventEndDT.getMonth(), eventEndDT.getDate()).getTime(); // 
                    if (isEndTime24) { // If original end was T24, the date belongs to the previous day
                        eventEndDateOnly -= MS_PER_DAY; // 
                    }
                    chunk.isMultiDayPart = eventStartDateOnly !== eventEndDateOnly; // 
                    chunk.isStart = dayIndex === startDayIndex; // 
                    chunk.isEnd = dayIndex === endDayIndex; // 
                    // Calculate 'from' and 'to' times for the chunk within the current day
                    if (chunk.isStart && eventStartDT.getTime() > dayStartMS) {
                        chunk.from = `${String(eventStartDT.getHours()).padStart(2, '0')}:${String(eventStartDT.getMinutes()).padStart(2, '0')}`; // 
                    } else {
                        chunk.from = "00:00"; // 
                    }

                    if (chunk.isEnd && eventEndDT.getTime() < dayEndMS) {
                         if (isEndTime24) {
                             chunk.to = "24:00"; // 
                         } else {
                            chunk.to = `${String(eventEndDT.getHours()).padStart(2, '0')}:${String(eventEndDT.getMinutes()).padStart(2, '0')}`; // 
                         }
                    } else {
                        chunk.to = "24:00"; // Spans till the end of the day or beyond
                    }

                    // Assign to allDay or timed array
                    if (event.isAllDay) {
                         chunk.from = "00:00"; // 
                        chunk.to = "24:00"; // 
                        dayData.allDay.push(chunk); // 
                    } else {
                        dayData.timed.push(chunk); // 
                    }
                }
            } catch (e) {
                console.error("Error processing event for rendering:", event, e); // 
            }
        }

        // --- Render Chunks onto the DOM ---
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const dayContainer = elements.calendarGridContainer.querySelector(`[data-day-index="${dayIndex}"]`); // 
            if (!dayContainer) continue;

            const { allDay, timed } = eventsByDay.get(dayIndex); // 
            const allDayCell = dayContainer.querySelector('.all-day-cell'); // 
            const timelineCell = dayContainer.querySelector('.timeline-cell'); // 
            // Render All-Day Events
            if (allDayCell) {
                allDayCell.innerHTML = ''; // Clear previous
                if (allDay.length > 0) {
                    allDayCell.style.setProperty('--event-count', allDay.length); // For potential grid layout inside
                    allDay.forEach(eventChunk => createEventDiv(eventChunk, allDayCell, true)); // 
                }
            }

            // Render Timed Events
            if (timelineCell) {
                timelineCell.innerHTML = ''; // Clear previous
                if (timed.length > 0) {
                    timed.sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from)); // Sort by start time
                    processAndRenderTimedEvents(timed, timelineCell, isMobile); // 
                }
            }
        }

        // Apply smart content adjustments after rendering
        applySmartContent(); // 
    }

    /**
     * Creates and appends a single event div (chunk) to its container.
     * 
     */
    function createEventDiv(event, container, isAllDay = false) {
        const eventDiv = document.createElement('div'); // 
        eventDiv.className = isAllDay ? 'event-allday' : 'event'; // 
        eventDiv.classList.add(`status-${event.status || STATUS.APPROVED}`); // 
        eventDiv.dataset.eventId = event.id; // Store ID for potential clicks

        const bgColor = event.status === STATUS.APPROVED ? (event.color || '#c8c8c8') : ''; // 
        if (bgColor) {
            eventDiv.style.backgroundColor = bgColor; // 
            // Set text color based on background lightness
            if (isColorLight(bgColor)) {
                eventDiv.style.color = 'var(--color-text-on-light)'; // 
                eventDiv.dataset.lightBg = 'true'; // Flag for potential CSS targeting 
            } else {
                eventDiv.style.color = 'var(--color-text-on-dark)'; // 
            }
        }

        // Add multi-day flags for CSS styling
        if (event.isMultiDayPart) {
            eventDiv.dataset.ismultiday = true; // 
            if (event.isStart) eventDiv.dataset.isstart = true; // 
            if (event.isEnd) eventDiv.dataset.isend = true; // 
        }

        // Determine if the event should be locked for the current user
        let isLocked = false; // 
        if (CURRENT_USER.role !== ROLES.MANAGER && CURRENT_USER.role !== ROLES.EVALUATOR) {
            if ((event.status === STATUS.APPROVED) || (event.proposerId !== CURRENT_USER.id) || CURRENT_USER.role === ROLES.VIEWER) {
                isLocked = true; // 
            }
        }
        if (event.isHoliday) isLocked = true; // Holidays are always locked

        if (isLocked) eventDiv.classList.add('event-locked'); // 
        eventDiv.dataset.event = JSON.stringify(event); // Store full event data
        eventDiv.dataset.locked = isLocked; // 
        // Content added by applySmartContent
        container.appendChild(eventDiv); // 
        return eventDiv; // 
    }

    /**
     * Handles overlapping timed events and positions them within lanes.
     * 
     */
    function processAndRenderTimedEvents(dayEvents, timelineCell, isMobile) {
        // Prepare event data structure with efficient time calculations
        dayEvents.forEach(event => {
            event.startMinutes = timeToMinutes(event.from);
            event.endMinutes = timeToMinutes(event.to);
            // Ensure minimum duration and handle midnight correctly
            if (event.to === '24:00') {
                event.endMinutes = 24 * 60;
            } else if (event.endMinutes <= event.startMinutes) {
                event.endMinutes = event.startMinutes + 1;
            }
        });

        // Sort events first by start time, then by duration (longer events first)
        dayEvents.sort((a, b) => {
            const startDiff = a.startMinutes - b.startMinutes;
            if (startDiff === 0) {
                return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes);
            }
            return startDiff;
        });

        // Enhanced overlap detection using timeline scanning
        const groups = [];
        let currentGroup = [];
        let lastEndTime = 0;

        dayEvents.forEach(event => {
            // Check if this event overlaps with the current group
            const overlapsWithCurrent = currentGroup.some(existingEvent => 
                event.startMinutes < existingEvent.endMinutes &&
                event.endMinutes > existingEvent.startMinutes
            );

            if (!overlapsWithCurrent && event.startMinutes >= lastEndTime) {
                // Start new group if no overlap
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = [event];
                lastEndTime = event.endMinutes;
            } else {
                // Add to current group and update max end time
                currentGroup.push(event);
                lastEndTime = Math.max(lastEndTime, event.endMinutes);
            }
        });
        
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        // --- Position Events in Lanes within Each Group ---
        groups.forEach(group => {
            const lanes = []; // lanes[0] = [event1, event3], lanes[1] = [event2] 
            group.sort((a, b) => a.startMinutes - b.startMinutes); // Sort group by start time 

            group.forEach(event => {
                let placed = false; // 
                // Try to place in an existing lane
                for (const lane of lanes) {
                    if (event.startMinutes >= lane[lane.length - 1].endMinutes) {
                        lane.push(event); // 
                        placed = true; // 
                        break;
                    }
                }
                // If not placed, create a new lane 
                if (!placed) lanes.push([event]); // 
            });

            const totalLanes = lanes.length; // 

            // --- Render Events from Lanes ---
            lanes.forEach((lane, laneIndex) => {
                lane.forEach(event => {
                     const eventWrapper = document.createElement('div'); // 
                     eventWrapper.className = 'event-wrapper'; // 

                    const totalMinutesInView = 24 * 60; // 
                    const startOffsetMinutes = event.startMinutes; // 
                    const durationMinutes = event.endMinutes - event.startMinutes; // 
                    // Calculate position and size based on view (Mobile vs Desktop)
                    if (isMobile) {
                        eventWrapper.style.top = `${(startOffsetMinutes / totalMinutesInView) * 100}%`; // 
                        eventWrapper.style.height = `${(durationMinutes / totalMinutesInView) * 100}%`; // 
                        eventWrapper.style.left = `${(laneIndex / totalLanes) * 100}%`; // 
                        eventWrapper.style.width = `${100 / totalLanes}%`; // 
                    } else { // Desktop
                        eventWrapper.style.right = `${(startOffsetMinutes / totalMinutesInView) * 100}%`; // RTL positioning
                        eventWrapper.style.width = `${(durationMinutes / totalMinutesInView) * 100}%`; // 
                        eventWrapper.style.top = `${(laneIndex / totalLanes) * 100}%`; // 
                        eventWrapper.style.height = `${100 / totalLanes}%`; // 
                    }
                    // Create the actual event div inside the wrapper
                    createEventDiv(event, eventWrapper, false); // 
                    timelineCell.appendChild(eventWrapper); // Append wrapper to the cell 
                }); // 
            });
        });
    }

    /**
     * Adjusts the content (title, meta, dept) inside event divs based on available space.
     * - Simplified logic, relies more on CSS for overflow.
     * 
     */
    function applySmartContent() {
        document.querySelectorAll('.event-allday, .event').forEach(eventDiv => {
             const event = JSON.parse(eventDiv.dataset.event); // 
            const isHoliday = event.isHoliday || String(event.id).startsWith('h-'); // 

            // Build content HTML conditionally
            let contentHTML = `<div class="event-title">${event.title || ''}</div>`; // 
            if (event.isStart && !isHoliday) { // Show meta only on start day, not for holidays 
                if (event.by) contentHTML += `<div class="event-meta">${event.by}</div>`; // 
                if (event.for) contentHTML += `<div class="event-meta">${event.for}</div>`; // 
            }

            const deptLabelHTML = getDepartmentLabel(event); // Get vertical label HTML 

            // Set inner HTML (label first, then content wrapper) 
            eventDiv.innerHTML = deptLabelHTML + `<div class="event-content">${contentHTML}</div>`; // 

            // Add/remove condensed class based on simple height check (CSS handles text overflow)
            if (eventDiv.clientHeight < 35 && !eventDiv.classList.contains('event-allday')) {
                eventDiv.classList.add('event-ultra-condensed'); // 
            } else {
                eventDiv.classList.remove('event-ultra-condensed'); // 
            }
        });
    }


    /**
     * Gets the HTML for the vertical department label if applicable.
     * 
     */
    function getDepartmentLabel(event) {
        if (!event.departmentId || !event.isStart || event.isHoliday) return ''; // Only on start day, not holidays

        const dept = (appState.fullData.departments || []).find(d => d.id === event.departmentId); // 
        if (dept?.name) {
            return `<div class="event-dept vertical">${dept.name}</div>`; // 
        }
        return ''; // 
    }

    /**
     * Gets the start date (Saturday) of the week containing the given Gregorian date string or the server's current date.
     * - Simplified to use local date calculations, assuming server provides reliable start.
     * 
     */
    function getStartDate(gregorianDateStr = null) {
        let referenceDate; // 
        if (gregorianDateStr && /^\d{4}-\d{2}-\d{2}$/.test(gregorianDateStr)) {
            // Use provided date string directly
            const [year, month, day] = gregorianDateStr.split('-').map(Number); // 
            // Construct as local time to avoid UTC shifts
            referenceDate = new Date(year, month - 1, day, 12, 0, 0); // Midday to avoid DST issues
        } else {
            // Use estimated current server time as reference
            referenceDate = estimateCurrentServerTime(); // 
        }

        if (isNaN(referenceDate)) {
            console.error("Invalid reference date, falling back to client's current date."); // 
            referenceDate = new Date(); // 
        }

        // Find the preceding Saturday (adjusting for local getDay() where Sunday=0, Saturday=6)
        const currentDay = referenceDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const diffToSat = (currentDay + 1) % 7; // Days to subtract to reach Saturday

        const startDate = new Date(referenceDate); // 
        startDate.setDate(startDate.getDate() - diffToSat); // 
        startDate.setHours(0, 0, 0, 0); // Set to start of the day (local time) 

        return startDate; // 
    }


    /**
     * Renders the color legend based on visible departments.
     * 
     */
    function renderColorLegend() {
        if (!elements.legendPopup) return; // 
        let html = '<h4>راهنمای رنگ دپارتمان‌ها</h4><ul>'; // 
        const allDepts = Array.isArray(appState.fullData.departments) ? appState.fullData.departments : []; // 
        let visibleDepts = []; // 
        // Determine visible departments based on role/permissions
        if (CURRENT_USER.role === ROLES.MANAGER || CURRENT_USER.role === ROLES.EVALUATOR || CURRENT_USER.permissions?.view_all_depts) {
            visibleDepts = allDepts; // 
        } else {
            const visibleIds = new Set(CURRENT_USER.permissions?.view_depts || []); // 
            if (CURRENT_USER.departmentId) {
                visibleIds.add(CURRENT_USER.departmentId); // 
            }
            visibleDepts = allDepts.filter(dept => dept.id && visibleIds.has(dept.id)); // 
        }

        if (visibleDepts.length > 0) {
            visibleDepts.forEach(dept => {
                html += `<li><span class="legend-swatch" style="background-color: ${dept.color || '#ccc'}"></span>${dept.name || 'ناشناخته'}</li>`; // 
            });
        } else {
            html += '<li>دپارتمانی برای نمایش وجود ندارد.</li>'; // 
        }
        html += '</ul>'; // 
        elements.legendPopup.innerHTML = html; // 
    }

    /**
     * Renders the list view of events.
     * - Added data-event attribute and Persian formatting.
     */
    function renderListView() {
        if (!elements.calendarListContainer) return; // 
        elements.calendarListContainer.innerHTML = ''; // Clear previous 

        const events = (Array.isArray(appState.fullData.events) ? appState.fullData.events : [])
            .filter(e => e.status === STATUS.APPROVED || e.status === STATUS.PENDING)
            .sort((a, b) => {
                // Handle both normal dates and T24:00:00 format
                const getCompareTime = (dateStr) => {
                    if (dateStr.includes('T24:00:00')) {
                        const baseDate = new Date(dateStr.replace('T24:00:00', 'T00:00:00'));
                        baseDate.setDate(baseDate.getDate() + 1);
                        return baseDate.getTime();
                    }
                    return new Date(dateStr).getTime();
                };
                return getCompareTime(a.startDateTime) - getCompareTime(b.startDateTime);
            }); // Sort by date with 24:00 handling

        if (events.length === 0) {
            elements.calendarListContainer.innerHTML = '<h2>نمای لیستی</h2><p>هیچ رویدادی برای نمایش در این هفته یافت نشد.</p>'; // 
            return;
        }

        let currentDay = -1; // 
        let listHTML = ''; // 
        const dayFormatter = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }); // 
        const timeFormatter = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }); // 
        events.forEach(event => {
            try {
                const startDT = new Date(event.startDateTime); // 
                let endDT = new Date(event.endDateTime); // 
                let isEndTime24 = event.endDateTime.includes('T24:00'); // 
                if (isEndTime24) {
                    endDT.setTime(endDT.getTime() - 1); // Adjust for display day 
                }

                if (isNaN(startDT) || isNaN(endDT)) return; // Skip invalid dates 

                const dayIndex = getDayIndexFromDateTime(event.startDateTime); // 

                if (dayIndex !== currentDay) {
                     currentDay = dayIndex; // 
                    listHTML += `<h2>${dayFormatter.format(startDT)}</h2>`; // Full date header 
                }

                // Format time string
                let timeString; // 
                if (event.isAllDay) {
                    timeString = `(تمام روز)`; // 
                } else {
                    const startTimeStr = timeFormatter.format(startDT); // 
                    const endTimeStr = isEndTime24 ? "۰۰:۰۰" : timeFormatter.format(endDT); // Show midnight as 00:00 
                    const endDateStr = dayFormatter.format(endDT); // Use adjusted end date for day display
                    const startDateStr = dayFormatter.format(startDT); // 
                    if (startDateStr === endDateStr) {
                         timeString = `${startTimeStr} الی ${endTimeStr}`; // 
                    } else {
                        // Show days if different
                         timeString = `${startTimeStr} (${startDateStr}) الی ${endTimeStr} (${endDateStr})`; // 
                    }
                }

                const dept = (appState.fullData.departments || []).find(d => d.id === event.departmentId); // 
                const statusClass = `status-${event.status}`; // 
                let colorStyle = ''; // 
                if (event.status === STATUS.APPROVED && event.color) {
                    colorStyle = `style="border-right-color: ${event.color};"`; // 
                }

                 // Determine lock status
                 let isLocked = false; // 
                 if (CURRENT_USER.role !== ROLES.MANAGER && CURRENT_USER.role !== ROLES.EVALUATOR) {
                     if ((event.status === STATUS.APPROVED) || (event.proposerId !== CURRENT_USER.id) || CURRENT_USER.role === ROLES.VIEWER) {
                         isLocked = true; // 
                     }
                 }
                const lockedClass = isLocked ? 'event-locked' : ''; // 

                listHTML += `
                    <div class="list-view-item ${statusClass} ${lockedClass}" ${colorStyle} data-event='${JSON.stringify(event)}' data-locked="${isLocked}">
                        <div class="list-view-time">
                             ${toPersianNum(timeString)}
                             <div class="list-day">${dept ? dept.name : 'عمومی'}</div> </div>
                        <div class="list-view-details">
                            <h4>${event.title || ''} ${event.status === STATUS.PENDING ? '(در انتظار)' : ''}</h4> <span>مجری: ${event.by || '-'}</span> <span>مخاطب: ${event.for || '-'}</span> </div>
                        <div class="list-view-goal">
                            <h5>هدف:</h5> <p>${event.goal || '(ثبت نشده)'}</p> </div>
                    </div>`; // 
            } catch (e) { console.error("Error rendering list view item:", event, e); } // 
        });

        elements.calendarListContainer.innerHTML = listHTML; // 
    }

    // ===================================================================
    // 4. EVENT MODAL LOGIC (Using <input type="date">)
    // ===================================================================

    /**
     * Opens the event modal for adding or editing.
     * - Reads/Writes from/to <input type="date">.
     */
    function openEventModal(event = null, prefillDateInfo = null) {
        if (!elements.eventModal) return; // 
        elements.eventForm.reset(); // 
        // Reset UI states
        elements.approvalActions.style.display = 'none'; // 
        elements.deleteEventBtn.style.display = 'none'; // 
        elements.saveEventBtn.textContent = 'ذخیره'; // 
        elements.saveEventBtn.disabled = false; // 
        elements.saveEventBtn.style.display = 'inline-flex'; // 
        elements.managerColorInputs.style.display = 'none'; // 
        elements.eventGoalGroup.style.display = 'block'; // 

        // Add date validation listeners
        elements.startDateInput.addEventListener('change', validateEventDates);
        elements.endDateInput.addEventListener('change', validateEventDates);
        elements.eventForm.querySelectorAll('input, select, textarea, button').forEach(el => el.disabled = false); // 
        elements.cancelEventBtn.textContent = 'انصراف'; // Reset cancel button text

        if (event) { // --- Edit/View Mode ---
            elements.eventIdInput.value = event.id; // 
            elements.eventTitleInput.value = event.title || ''; // 
            elements.eventByInput.value = event.by || ''; // 
            elements.eventForInput.value = event.for || ''; // 
            elements.eventGoalInput.value = event.goal || ''; // 
            elements.isAllDayCheckbox.checked = event.isAllDay || false; // 

            try {
                // Populate Date and Time Inputs
                const startDT = new Date(event.startDateTime); //
                let endDT = new Date(event.endDateTime); //
                let isEndTime24 = event.endDateTime.includes('T24:00'); //
                if (isEndTime24) endDT.setTime(endDT.getTime() - 1); // Adjust for date input value

                if (!isNaN(startDT)) {
                    elements.startDateInput.value = formatDate(startDT); // YYYY-MM-DD
                    document.getElementById('startHour').value = startDT.getHours().toString().padStart(2, '0');
                    document.getElementById('startMinute').value = startDT.getMinutes().toString().padStart(2, '0');
                } else throw new Error("Invalid start date"); //

                if (!isNaN(endDT)) {
                    elements.endDateInput.value = formatDate(endDT); // YYYY-MM-DD (adjusted if 24:00)
                    if (isEndTime24) {
                        document.getElementById('endHour').value = '24';
                        document.getElementById('endMinute').value = '00';
                    } else {
                        document.getElementById('endHour').value = endDT.getHours().toString().padStart(2, '0');
                        document.getElementById('endMinute').value = endDT.getMinutes().toString().padStart(2, '0');
                    }
                } else throw new Error("Invalid end date"); //
                // Colors for manager
                if (CURRENT_USER.role === ROLES.MANAGER) {
                     elements.managerColorInputs.style.display = 'block'; // 
                     elements.eventBgColorInput.value = event.color || '#5c6bc0'; // 
                     elements.eventTextColorInput.value = event.textColor || '#ffffff'; // 
                }

            } catch (e) {
                console.error("Error parsing event dates for modal:", event, e); // 
                showToast("خطا در بارگذاری تاریخ/زمان رویداد.", true); // 
                const today = estimateCurrentServerTime();
                elements.startDateInput.value = formatDate(today); elements.startTimeInput.value = "09:00"; // 
                elements.endDateInput.value = formatDate(today); elements.endTimeInput.value = "10:00"; // 
            }

            // --- Permissions & UI State ---
            const canApprove = CURRENT_USER.role === ROLES.MANAGER || CURRENT_USER.role === ROLES.EVALUATOR; // 
            const isOwner = event.proposerId === CURRENT_USER.id; // 
            const isApproved = event.status === STATUS.APPROVED; // 
            let isLocked = event.isHoliday || false; // 
            if (canApprove) {
                 elements.eventModalTitle.textContent = 'ویرایش / تایید رویداد'; // 
                 if (event.status === STATUS.PENDING) elements.approvalActions.style.display = 'flex'; // 
                 if (!event.isHoliday) elements.deleteEventBtn.style.display = 'inline-flex'; // 
            } else if (isOwner && !isApproved && event.status !== STATUS.REJECTED) {
                 elements.eventModalTitle.textContent = 'ویرایش پیشنهاد'; // 
                 if (!event.isHoliday) elements.deleteEventBtn.style.display = 'inline-flex'; // 
            } else if (isOwner && event.status === STATUS.REJECTED) {
                 elements.eventModalTitle.textContent = 'ویرایش پیشنهاد رد شده'; // 
                 if (!event.isHoliday) elements.deleteEventBtn.style.display = 'inline-flex'; // 
            } else {
                 elements.eventModalTitle.textContent = 'مشاهده رویداد'; // 
                 isLocked = true; // 
            }
            if (isLocked) {
                 elements.eventForm.querySelectorAll('input:not([type=hidden]), select, textarea, button:not(#cancel-event-btn)').forEach(el => el.disabled = true); // 
                 elements.saveEventBtn.style.display = 'none'; // 
                 elements.deleteEventBtn.style.display = 'none'; // 
                 elements.approvalActions.style.display = 'none'; // 
                 elements.cancelEventBtn.textContent = 'بستن';
            }
            if (CURRENT_USER.role === ROLES.PROPOSER || CURRENT_USER.role === ROLES.VIEWER) {
                 elements.eventGoalGroup.style.display = 'none'; // 
            }
        } else { // --- Add New Mode ---
            elements.eventIdInput.value = ''; // 
            elements.eventGoalInput.value = ''; // 
            let prefillStartDate = estimateCurrentServerTime();
            if (prefillDateInfo?.dayIndex !== undefined) {
                 // Calculate date based on week start and day index
                 prefillStartDate = new Date(appState.currentWeekStartDate); // 
                 prefillStartDate.setDate(prefillStartDate.getDate() + prefillDateInfo.dayIndex); // 
            }
            elements.startDateInput.value = formatDate(prefillStartDate); // 
            const prefillTime = prefillDateInfo?.time || '09:00';
            const [prefillHour, prefillMinute] = prefillTime.split(':');
            document.getElementById('startHour').value = prefillHour;
            document.getElementById('startMinute').value = prefillMinute;

            // Default end time (e.g., 1 hour later)
            let endHour = parseInt(prefillHour) + 1; //
            elements.endDateInput.value = formatDate(prefillStartDate); // Default end date same as start 
            document.getElementById('endHour').value = endHour.toString().padStart(2, '0');
            document.getElementById('endMinute').value = prefillMinute;

            // Role specific UI
            if (CURRENT_USER.role === ROLES.MANAGER) {
                 elements.eventModalTitle.textContent = 'افزودن رویداد'; // 
                 elements.managerColorInputs.style.display = 'block'; // 
                 elements.eventGoalGroup.style.display = 'block'; // 
                 elements.eventBgColorInput.value = '#5c6bc0'; // 
                 elements.eventTextColorInput.value = '#ffffff'; // 
            }
            else if (CURRENT_USER.role === ROLES.EVALUATOR) {
                 elements.eventModalTitle.textContent = 'افزودن رویداد'; // 
                 elements.eventGoalGroup.style.display = 'block'; // 
            }
            else {
                 elements.eventModalTitle.textContent = 'پیشنهاد رویداد'; // 
                 elements.eventGoalGroup.style.display = 'none'; // 
            }
        }

        elements.isAllDayCheckbox.dispatchEvent(new Event('change')); // 
        elements.eventModal.classList.add('active'); // 
    }

    function closeEventModal() {
        if (elements.eventModal) elements.eventModal.classList.remove('active'); // 
    }

    /**
     * Handles event form submission (Save).
     * - Reads from date/time inputs, uses combineDateTime.
     */
    async function handleEventFormSubmit(e) {
        e.preventDefault(); // 
        if (elements.saveEventBtn.disabled) return; // Prevent double submit

        elements.saveEventBtn.disabled = true; // 
        elements.saveEventBtn.innerHTML = '<span class="button-spinner"></span> ذخیره...'; // Show spinner

        // --- Read values ---
        const startDateValue = elements.startDateInput.value; // YYYY-MM-DD
        const startHour = document.getElementById('startHour').value;
        const startMinute = document.getElementById('startMinute').value;
        const startTimeValue = `${startHour}:${startMinute}`;
        const endDateValue = elements.endDateInput.value;   // YYYY-MM-DD
        const endHour = document.getElementById('endHour').value;
        const endMinute = document.getElementById('endMinute').value;
        const endTimeValue = `${endHour}:${endMinute}`;

        // --- Basic Frontend Validation ---
        if (!elements.eventTitleInput.value.trim()) {
            showToast('عنوان الزامی است.', true); // 
            elements.eventTitleInput.focus(); elements.saveEventBtn.disabled = false; elements.saveEventBtn.textContent = 'ذخیره'; return; // 
        }
        if (!startDateValue || !endDateValue) {
            showToast('تاریخ شروع و پایان الزامی است.', true); // 
            elements.saveEventBtn.disabled = false; elements.saveEventBtn.textContent = 'ذخیره'; return; // 
        }

        // --- Combine Date/Time using correct helper ---
        const startDateTime = combineDateTime(startDateValue, elements.isAllDayCheckbox.checked ? "00:00" : startTimeValue); // 
        const endDateTime = combineDateTime(endDateValue, elements.isAllDayCheckbox.checked ? "24:00" : endTimeValue); // 

        if (!startDateTime || !endDateTime) {
             elements.saveEventBtn.disabled = false; elements.saveEventBtn.textContent = 'ذخیره'; return; // Error shown by combineDateTime
        }

        // --- Logical Order Check (using Date objects for comparison) ---
         try {
            const startTestDT = new Date(startDateTime); // 
            let endTestDT = new Date(endDateTime); // 
            if (endDateTime.includes('T24:00:00')) endTestDT.setTime(endTestDT.getTime()); // Date handles T24:00 as next day 00:00 
            if (isNaN(startTestDT) || isNaN(endTestDT) || endTestDT <= startTestDT) {
                 showToast("تاریخ/زمان پایان باید بعد از شروع باشد.", true); // 
                 elements.saveEventBtn.disabled = false; elements.saveEventBtn.textContent = 'ذخیره'; return; // 
            }
         } catch(err) {
             showToast("خطا در مقایسه تاریخ/زمان.", true); // 
             elements.saveEventBtn.disabled = false; elements.saveEventBtn.textContent = 'ذخیره'; return; // 
         }


        // --- Prepare Event Data ---
        const eventData = {
            id: elements.eventIdInput.value || null, // 
            title: elements.eventTitleInput.value.trim(), // 
            by: elements.eventByInput.value.trim(), // 
            for: elements.eventForInput.value.trim(), // 
            goal: elements.eventGoalInput.value.trim(), // 
            isAllDay: elements.isAllDayCheckbox.checked, // 
            startDateTime: startDateTime, // Send combined ISO string 
            endDateTime: endDateTime,     // Send combined ISO string 
        };
        if (CURRENT_USER.role === ROLES.MANAGER) {
             eventData.color = elements.eventBgColorInput.value; // 
             eventData.textColor = elements.eventTextColorInput.value; // 
        }

        // --- API Call ---
        const result = await apiCall('saveEvent', { event: eventData }); // 
        elements.saveEventBtn.disabled = false; // 
        elements.saveEventBtn.textContent = 'ذخیره'; // 
        if (result) {
            showToast(result.message || 'ذخیره شد.'); // 
            closeEventModal(); // 
            await fetchAndRenderCurrentWeekData(); // 
        }
        // else: Error toast already shown by apiCall
    }

    async function handleEventStatusUpdate(status) {
        const eventId = elements.eventIdInput.value; // 
        if (!eventId || !status) return; // 
        elements.approveEventBtn.disabled = true; // 
        elements.rejectEventBtn.disabled = true; // 
        const result = await apiCall('updateEventStatus', { id: eventId, status: status }); // 
        if (result) {
            showToast(result.message || `وضعیت تغییر یافت.`); // 
            closeEventModal(); // 
            await fetchAndRenderCurrentWeekData(); // 
        } else {
            elements.approveEventBtn.disabled = false; // 
            elements.rejectEventBtn.disabled = false; // 
        }
    }
    async function handleEventDelete() {
        const eventId = elements.eventIdInput.value; // 
        if (!eventId) return; // 
        if (!confirm('آیا از حذف این رویداد مطمئن هستید؟')) return; // 
        elements.deleteEventBtn.disabled = true; // 
        const result = await apiCall('deleteEvent', { id: eventId }); // 
        if (result) {
            showToast(result.message || 'حذف شد.'); // 
            closeEventModal(); // 
            await fetchAndRenderCurrentWeekData(); // 
        } else {
            elements.deleteEventBtn.disabled = false; // 
        }
    }

    // ===================================================================
    // 5. SETTINGS MODAL & MINI CALENDAR
    // ===================================================================
    function openSettingsModal() {
        if (!elements.settingsModal) return; // 
        elements.mainHeaderInput.value = appState.fullData.settings?.headerText || ''; // 
        generateWeekOptions(elements.weekSelector, appState.currentWeekStartDate); // Generate and select current 
        elements.settingsModal.classList.add('active'); // 
    }

    function closeSettingsModal() {
        if (elements.settingsModal) elements.settingsModal.classList.remove('active'); // 
    }

    async function handleSettingsSave() {
      const newHeaderText = elements.mainHeaderInput.value; // 
      const newWeekStartDate = elements.weekSelector.value; // 

      // Basic validation
      if (!newWeekStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(newWeekStartDate)) {
          showToast('لطفاً یک هفته معتبر انتخاب کنید.', true); // 
          return;
      }

      const result = await apiCall('saveSettings', { headerText: newHeaderText, weekStartDate: newWeekStartDate }); // 
      if (result) {
          showToast(result.message || 'تنظیمات ذخیره شد.'); // 
          closeSettingsModal(); // 
          // Apply changes immediately
          document.title = newHeaderText || 'تقویم هفتگی'; // 
          appState.fullData.settings.headerText = newHeaderText; // Update local state 
          // Navigate only if the selected week is different from the current one
          if (newWeekStartDate !== formatDate(appState.currentWeekStartDate)) {
              stopPolling(); // 
              appState.currentWeekStartDate = getStartDate(newWeekStartDate); // Update current week 
              await fetchAndRenderCurrentWeekData(); // Fetch and render new week
              startPolling(); // 
          } else {
              updateCalendarTitle(); // Update title if only text changed
          }
      }
    }

    // --- Mini Calendar Logic ---
    function openMiniCalendar(targetInputId = null) {
        if (!elements.miniCalendarPopup) return; // 
        // Set calendar to month of currently selected date, or week start
        const inputDate = (targetInputId && elements[targetInputId]) ? elements[targetInputId].value : null;
        if(inputDate && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
             appState.miniCal.selectedDate = new Date(inputDate + 'T12:00:00'); // Use noon to avoid TZ issues
        } else {
             appState.miniCal.selectedDate = appState.currentWeekStartDate; // Default selection
        }
        appState.miniCal.currentMonthDate = new Date(appState.miniCal.selectedDate); // Start with selected month
        appState.miniCal.targetInputId = targetInputId || null; // 
        renderMiniCalendar(); // 
        elements.miniCalendarPopup.classList.add('active'); // 
        appState.miniCal.visible = true;
    }

    function closeMiniCalendar() {
        if (elements.miniCalendarPopup) elements.miniCalendarPopup.classList.remove('active'); // 
        appState.miniCal.visible = false;
        appState.miniCal.targetInputId = null; // Clear target
    }

    function renderMiniCalendar() {
        if (!elements.miniCalDaysContainer || !elements.miniCalMonthYear) return; // 
        const date = appState.miniCal.currentMonthDate; // 
        const month = date.getMonth();
        const year = date.getFullYear();
        // Header (Persian Month/Year)
        const monthYearFormatter = new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }); // 
        elements.miniCalMonthYear.textContent = monthYearFormatter.format(date); // 

        // Days Grid
        elements.miniCalDaysContainer.innerHTML = ''; // 
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate(); // 
        // Adjust week start to Saturday (getDay() gives 0=Sun, 6=Sat -> We want Sat=0)
        let startingDay = (firstDayOfMonth.getDay() + 1) % 7; // 0=Sat, 1=Sun, ..., 6=Fri

        // Add empty cells for days before the 1st
        for (let i = 0; i < startingDay; i++) {
            elements.miniCalDaysContainer.innerHTML += `<button class="mini-cal-day other-month" disabled></button>`; // 
        }

        // Add actual days
        const today = estimateCurrentServerTime(); // Use estimated server time for 'today' marker
        const todayDateStr = formatDate(today); // 
        const selectedDateStr = appState.miniCalendar.selectedDate ? formatDate(appState.miniCalendar.selectedDate) : ''; //

        // Highlight current week
        const weekStartMS = appState.currentWeekStartDate.getTime();
        const weekEndMS = weekStartMS + 7 * MS_PER_DAY;


        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day); // 
            const currentDateStr = formatDate(currentDate); // 
            const dateMS = currentDate.getTime() + (12 * 60 * 60 * 1000); // Use noon for comparison
            let classes = 'mini-cal-day';
            if (currentDateStr === todayDateStr) classes += ' today'; // 
            if (currentDateStr === selectedDateStr) classes += ' selected'; // 
            // Highlight current week
            if (dateMS >= weekStartMS && dateMS < weekEndMS) {
                classes += ' selected-week';
            }


            const dayButton = document.createElement('button'); // 
            dayButton.className = classes;
            dayButton.textContent = toPersianNum(day); // 
            dayButton.dataset.date = currentDateStr; // Store YYYY-MM-DD 
            dayButton.onclick = () => handleMiniCalendarDayClick(currentDate); // 
            elements.miniCalDaysContainer.appendChild(dayButton); // 
        }
    }

    function changeMiniCalendarMonth(delta) {
        appState.miniCalendar.currentMonthDate.setMonth(appState.miniCalendar.currentMonthDate.getMonth() + delta); //
        renderMiniCalendar(); // 
    }

    function handleMiniCalendarDayClick(selectedFullDate) {
        appState.miniCalendar.selectedDate = selectedFullDate; // Store the selected Date object
        closeMiniCalendar(); // 
        // Logic based on which input opened the calendar (if any)
        const targetInputId = appState.miniCalendar.targetInputId; //
        const selectedDateStr = formatDate(selectedFullDate); // 

        if (targetInputId === 'startDate' || targetInputId === 'endDate') {
             const targetInput = document.getElementById(targetInputId); // 
             if (targetInput) targetInput.value = selectedDateStr; // Update the date input
        }
        // else: If opened from title, navigate to the week containing the selected date
        else if (targetInputId === 'calendarTitle') {
             const newWeekStart = getStartDate(formatDate(selectedFullDate)); // 
             if (formatDate(newWeekStart) !== formatDate(appState.currentWeekStartDate)) {
                  stopPolling(); // 
                  appState.currentWeekStartDate = newWeekStart; // 
                  fetchAndRenderCurrentWeekData().then(startPolling); // 
             }
        }
        // renderMiniCalendar(); // Re-render to show selection (optional) 
    }

    // ===================================================================
    // 6. DEPARTMENTS MODAL
    // ===================================================================
    function openDeptsModal() {
        if (!elements.deptsModal) return; // 
        renderDeptsEditor(); // 
        elements.deptsModal.classList.add('active'); // 
    }
    function closeDeptsModal() { if (elements.deptsModal) elements.deptsModal.classList.remove('active'); }
    function renderDeptsEditor() {
        if (!elements.deptsListEditor) return; // 
        elements.deptsListEditor.innerHTML = ''; // 
        (appState.fullData.departments || []).forEach(dept => {
            elements.deptsListEditor.appendChild(createDeptEditorRow(dept)); // 
        });
    }
    function createDeptEditorRow(dept = null) {
        const row = document.createElement('div'); // 
        row.className = 'dept-item'; // 
        const id = dept?.id || ('new_' + Date.now()); // 
        row.dataset.id = id; // 
        row.innerHTML = `
            <input type="text" class="dept-name" placeholder="نام دپارتمان" value="${dept?.name || ''}">
            <input type="color" class="dept-color" value="${dept?.color || '#cccccc'}">
            <button type="button" class="dept-remove action-btn danger icon-btn small" title="حذف">🗑️</button>
        `; // 
        row.querySelector('.dept-remove').addEventListener('click', () => {
             if (confirm(`آیا از حذف دپارتمان "${dept?.name || 'جدید'}" مطمئن هستید؟`)) { // 
                 row.remove(); // 
             }
        });
        return row; // 
    }
    function addNewDeptEditorRow() { if (elements.deptsListEditor) elements.deptsListEditor.appendChild(createDeptEditorRow()); }
    async function handleDeptsSave() {
        const rows = elements.deptsListEditor.querySelectorAll('.dept-item'); // 
        const departments = []; // 
        let valid = true; // 
        rows.forEach(row => {
            const name = row.querySelector('.dept-name').value.trim(); // 
            const color = row.querySelector('.dept-color').value; // 
            if (name && color) {
                departments.push({
                    id: row.dataset.id.startsWith('new_') ? null : row.dataset.id, // Let backend assign new IDs
                    name: name, // 
                    color: color // 
                });
            } else if (name || color) { // Only invalid if partially filled 
                 valid = false; // 
            }
        });
        if (!valid) {
            showToast('لطفاً نام و رنگ را برای همه دپارتمان‌ها مشخص کنید.', true); // 
            return;
        }

        const result = await apiCall('manageDepartments', { departments: departments }); // 
        if (result) {
            showToast(result.message || 'دپارتمان‌ها ذخیره شدند.'); // 
            closeDeptsModal(); // 
            await fetchAndRenderCurrentWeekData(); // Refresh all data 
        }
    }

    // ===================================================================
    // 7. USERS MODAL
    // ===================================================================
    function openUsersModal() {
        if (!elements.usersModal) return; // 
        renderUsersEditor(); // 
        elements.usersModal.classList.add('active'); // 
    }
    function closeUsersModal() { if (elements.usersModal) elements.usersModal.classList.remove('active'); }
    function renderUsersEditor() {
        if (!elements.usersListEditor) return; // 
        elements.usersListEditor.innerHTML = ''; // Clear previous 
        // Ensure users array exists and sort (optional, maybe by displayName?)
        const users = (appState.fullData.users || []).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fa')); // 
        users.forEach(user => {
            elements.usersListEditor.appendChild(createUserEditorRow(user)); // 
        });
    }
    function createUserEditorRow(user = null) {
        const isNew = user === null; // 
        // Default structure for a new user
        const u = user || { id: null, username: '', displayName: '', role: ROLES.VIEWER, departmentId: null, permissions: { view_all_depts: false, view_depts: [], view_all_users: false, view_users: [] } }; // 
        const row = document.createElement('div'); // 
        row.className = 'user-item'; // 
        row.dataset.id = u.id || 'new_' + Date.now(); // 
        // Department options
        let deptOptions = '<option value="">(هیچکدام)</option>'; // 
        (appState.fullData.departments || []).forEach(d => {
            deptOptions += `<option value="${d.id}" ${u.departmentId === d.id ? 'selected' : ''}>${d.name}</option>`; // 
        });
        // Role options using constants
        let roleOptions = ''; // 
        Object.values(ROLES).forEach(r => {
            // Simple Persian translation map (could be more sophisticated)
            const rolePersian = { manager: 'مدیر', evaluator: 'ارزیاب', proposer: 'پیشنهاددهنده', viewer: 'بیننده' }[r] || r; // 
            roleOptions += `<option value="${r}" ${u.role === r ? 'selected' : ''}>${rolePersian}</option>`; // 
        });
        // Department permission checkboxes
        let deptPerms = ''; // 
        (appState.fullData.departments || []).forEach(d => {
            deptPerms += `<label><input type="checkbox" class="perm-view-dept" value="${d.id}" ${(u.permissions.view_depts || []).includes(d.id) ? 'checked' : ''}> ${d.name}</label>`; // 
        });
        // User permission checkboxes
        let userPerms = ''; // 
        (appState.fullData.users || []).filter(usr => usr.id !== u.id).forEach(usr => { // Exclude self
             userPerms += `<label><input type="checkbox" class="perm-view-user" value="${usr.id}" ${(u.permissions.view_users || []).includes(usr.id) ? 'checked' : ''}> ${usr.displayName || usr.username}</label>`; // 
        });
        row.innerHTML = `
            <div class="form-group"> <label>نام کاربری (لاگین)</label> <input type="text" class="user-username" value="${u.username || ''}"> </div>
            <div class="form-group"> <label>نام نمایشی</label> <input type="text" class="user-displayName" value="${u.displayName || ''}"> </div>
            <div class="form-group"> <label>رمز عبور</label> <input type="password" class="user-password" placeholder="${isNew ? 'الزامی' : '(خالی=بدون تغییر)'}"> </div>
            <div class="form-group"> <label>نقش</label> <select class="user-role">${roleOptions}</select> </div>
            <div class="form-group"> <label>دپارتمان اصلی</label> <select class="user-departmentId">${deptOptions}</select> </div>

            <div class="user-item-permissions">
                 <div class="permission-group">
                    <h5>دسترسی مشاهده دپارتمان‌ها</h5>
                    <label><input type="checkbox" class="perm-view-all-depts" ${u.permissions.view_all_depts ? 'checked' : ''}> <b>مشاهده همه دپارتمان‌ها</b></label> <div class="permission-group-items">${deptPerms || '(دپارتمانی یافت نشد)'}</div> </div>
                 <div class="permission-group">
                    <h5>دسترسی مشاهده کاربران (رویدادهای تایید شده)</h5>
                    <label><input type="checkbox" class="perm-view-all-users" ${u.permissions.view_all_users ? 'checked' : ''}> <b>مشاهده همه کاربران</b></label> <div class="permission-group-items">${userPerms || '(کاربر دیگری یافت نشد)'}</div> </div>
            </div>

            <div class="user-item-actions">
                <button type="button" class="user-save action-btn primary small">ذخیره</button>
                ${!isNew ? `<button type="button" class="user-delete action-btn danger icon-btn small" title="حذف">🗑️</button>` : ''} </div>
        `; // 
        // Event Listeners for Save/Delete buttons within this row
        row.querySelector('.user-save').addEventListener('click', () => handleUserSave(row)); // 
        if (!isNew) {
            row.querySelector('.user-delete').addEventListener('click', () => handleUserDelete(u.id, u.displayName)); // 
        }

        return row; // 
    }
    function addNewUserEditorRow() { if (elements.usersListEditor) elements.usersListEditor.prepend(createUserEditorRow(null)); } // Add to top
    async function handleUserSave(rowEl) {
         const id = rowEl.dataset.id.startsWith('new_') ? null : rowEl.dataset.id; // 
         const viewDepts = Array.from(rowEl.querySelectorAll('.perm-view-dept:checked')).map(el => el.value); // 
         const viewUsers = Array.from(rowEl.querySelectorAll('.perm-view-user:checked')).map(el => el.value); // 
         const user = {
            id: id,
            username: rowEl.querySelector('.user-username').value.trim(),
            displayName: rowEl.querySelector('.user-displayName').value.trim(),
            password: rowEl.querySelector('.user-password').value, // Send empty string if unchanged, backend handles it 
            role: rowEl.querySelector('.user-role').value,
            departmentId: rowEl.querySelector('.user-departmentId').value || null, // 
            permissions: {
                view_all_depts: rowEl.querySelector('.perm-view-all-depts').checked, // 
                view_depts: viewDepts, // 
                view_all_users: rowEl.querySelector('.perm-view-all-users').checked, // 
                view_users: viewUsers // 
            }
         };

        if (!user.username || !user.displayName) {
             showToast('نام کاربری و نام نمایشی الزامی است.', true); // 
             return;
        }
        if (!id && !user.password) { // Password required only for new users
            showToast('رمز عبور برای کاربر جدید الزامی است.', true); // 
            return;
        }
        if (!id && user.password.length < 6) { // Password length check for new users
            showToast('رمز عبور باید حداقل ۶ کاراکتر باشد.', true); // 
            return;
        }
         if (id && user.password && user.password.length < 6) { // Password length check for existing users if changed
            showToast('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.', true); // 
            return;
        }


        const result = await apiCall('manageUsers', { sub_action: 'save', user: user }); // 
        if (result) {
            showToast(result.message || 'کاربر ذخیره شد.'); // 
            // Update local user data immediately for smoother UX
            appState.fullData.users = result.data || []; // 
            renderUsersEditor(); // Redraw the user list 
            renderColorLegend(); // Permissions might affect legend
            // Reload page if current user was modified
            if (user.id === CURRENT_USER.id) {
                showToast('اطلاعات شما تغییر کرد، صفحه مجدداً بارگذاری می‌شود.'); // 
                setTimeout(() => window.location.reload(), 1500); // 
            }
        }
    }
    async function handleUserDelete(userId, userName) {
        if (userId === CURRENT_USER.id) {
            showToast('شما نمی‌توانید حساب کاربری خود را حذف کنید.', true); // 
            return;
        }
        if (!confirm(`آیا از حذف کاربر "${userName || userId}" مطمئن هستید؟`)) return; // 
        const result = await apiCall('manageUsers', { sub_action: 'delete', user: { id: userId } }); // 
        if (result) {
            showToast(result.message || 'کاربر حذف شد.'); // 
            // Update local data and redraw
            appState.fullData.users = result.data || []; // 
            renderUsersEditor(); // 
            renderColorLegend(); // Update in case permissions changed legend visibility 
        }
    }

    // ===================================================================
    // 8. ISSUE REPORTING MODALS
    // ===================================================================
    function openIssueModal() { if (elements.issueModal) elements.issueModal.classList.add('active'); }
    function closeIssueModal() { if (elements.issueModal) elements.issueModal.classList.remove('active'); }
    async function handleIssueSend() {
        const text = elements.issueTextInput.value.trim(); // 
        if (!text) {
            showToast('لطفاً متن پیام را وارد کنید.', true); // 
            elements.issueTextInput.focus();
            return;
        }
        elements.sendIssueBtn.disabled = true; // Prevent double send
        elements.sendIssueBtn.innerHTML = '<span class="button-spinner"></span> ارسال...';

        const result = await apiCall('reportIssue', { text: text }); // 
        if (result) {
            showToast(result.message || 'پیام شما ارسال شد.'); // 
            elements.issueTextInput.value = ''; // Clear text 
            closeIssueModal(); // 
        }
        elements.sendIssueBtn.disabled = false; // Re-enable button
        elements.sendIssueBtn.textContent = 'ارسال پیام';
    }

    async function openViewIssuesModal() {
        if (!elements.viewIssuesModal || !elements.issuesListContainer) return; // 
        // Immediately show modal with a loading indicator inside
        elements.issuesListContainer.innerHTML = '<div class="spinner-small" style="margin: 2rem auto;"></div> <p style="text-align: center;">در حال بارگذاری پیام‌ها...</p>'; // 
        elements.viewIssuesModal.classList.add('active'); // 

        // Fetch issues
        try {
            const result = await apiCall('getIssues', null, 'GET'); // Call API
            if (result?.data) {
                renderIssuesList(result.data); // 
            } else {
                 // apiCall should have shown a toast, but update UI too
                elements.issuesListContainer.innerHTML = '<p style="text-align: center; color: var(--color-danger);">خطا در بارگذاری پیام‌ها.</p>'; // 
                 if(result?.message) {
                     elements.issuesListContainer.innerHTML += `<p style="text-align: center; font-size: 0.8rem; color: var(--color-text-muted);">${result.message}</p>`; // 
                 }
            }
        } catch (error) {
            // Catch errors not handled by apiCall itself
            console.error("Critical error in openViewIssuesModal:", error); // 
            elements.issuesListContainer.innerHTML = '<p style="text-align: center; color: var(--color-danger);">خطای ناشناخته در بارگذاری پیام‌ها.</p>'; // 
            showToast("خطای جدی هنگام دریافت پیام‌ها رخ داد.", true); // 
        }
    }

    function renderIssuesList(issues) {
        if (!elements.issuesListContainer) return; // 
        elements.issuesListContainer.innerHTML = ''; // Clear loading/previous
        if (!issues || issues.length === 0) {
            elements.issuesListContainer.innerHTML = '<p style="text-align: center;">هیچ پیامی ثبت نشده است.</p>'; // 
            return;
        }

        const dateFormatter = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }); // 
        issues.forEach(issue => {
             const issueDiv = document.createElement('div'); // 
             issueDiv.className = 'issue-item'; // 
             let timestamp = 'نامشخص'; // 
             try {
                 timestamp = dateFormatter.format(new Date(issue.timestamp)); // 
             } catch (e) { /* Ignore invalid date */ }

             // Basic sanitization for display (replace newlines)
             const safeText = (issue.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>'); // 

             issueDiv.innerHTML = `
                <p>${safeText}</p>
                <div class="issue-meta">
                     <span>توسط: ${issue.userName || 'ناشناس'}</span> <span>${toPersianNum(timestamp)}</span> </div>
             `; // 
             elements.issuesListContainer.appendChild(issueDiv); // 
        });
    }

    function closeViewIssuesModal() { if (elements.viewIssuesModal) elements.viewIssuesModal.classList.remove('active'); }

    // ===================================================================
    // 9. FAB Menu Logic
    // ===================================================================
     function cleanupEventListeners() {
        // Cleanup document event listeners
        document.removeEventListener('click', handleDocumentClick);
        
        // Cleanup mobile gesture handlers
        if (elements.calendarGridContainer) {
            elements.calendarGridContainer.removeEventListener('touchstart', handleGestureStart);
            elements.calendarGridContainer.removeEventListener('touchmove', handleGestureMove);
            elements.calendarGridContainer.removeEventListener('touchend', handleGestureEnd);
            elements.calendarGridContainer.removeEventListener('touchcancel', handleGestureEnd);
        }
        
        // Clear intervals
        if (appState.pollingInterval) clearInterval(appState.pollingInterval);
        if (appState.timeIndicatorInterval) clearInterval(appState.timeIndicatorInterval);
        if (appState.toastTimeout) clearTimeout(appState.toastTimeout);
    }

    function setupFabMenu() {
        if (!elements.fabMenu || !elements.fabMainBtn) return;
        elements.fabMenu.innerHTML = ''; // Clear previous

        // Add document click handler for closing FAB menu
        document.addEventListener('click', (e) => {
            if (!elements.fabContainer.contains(e.target) && elements.fabMainBtn.classList.contains('active')) {
                elements.fabMainBtn.classList.remove('active');
                elements.fabMenu.classList.remove('active');
            }
        });

        const role = CURRENT_USER.role;
        let actions = [];

        // Define available actions based on modal elements existing
        const addAction = elements.eventModal ? { id: 'fab-add', class: 'action-add', title: 'افزودن/پیشنهاد رویداد', icon: '+', fn: () => openEventModal(null) } : null;
        const deptsAction = elements.deptsModal && role === ROLES.MANAGER ? { id: 'fab-depts', class: 'action-admin', title: 'مدیریت دپارتمان‌ها', icon: '🏛️', fn: openDeptsModal } : null;
        const usersAction = elements.usersModal && role === ROLES.MANAGER ? { id: 'fab-users', class: 'action-admin', title: 'مدیریت کاربران', icon: '👥', fn: openUsersModal } : null;
        const viewIssuesAction = elements.viewIssuesModal && role === ROLES.MANAGER ? { id: 'fab-view-issues', class: 'action-view-issue', title: 'مشاهده پیام‌ها', icon: '✉️', fn: openViewIssuesModal } : null;
        const reportIssueAction = elements.issueModal ? { id: 'fab-report-issue', class: 'action-issue', title: 'گزارش مشکل', icon: '⚠️', fn: openIssueModal } : null;
        const settingsAction = elements.settingsModal && role === ROLES.MANAGER ? { id: 'fab-settings', class: 'action-admin', title: 'تنظیمات اصلی', icon: '⚙️', fn: openSettingsModal } : null;
        
        // Add actions based on role, filtering out nulls
        if (role === ROLES.MANAGER) {
            actions = [addAction, settingsAction, deptsAction, usersAction, viewIssuesAction, reportIssueAction].filter(Boolean);
        } else if (role === ROLES.EVALUATOR || role === ROLES.PROPOSER) {
            actions = [addAction, reportIssueAction].filter(Boolean);
        } else { // viewer
            actions = [reportIssueAction].filter(Boolean);
        }

        // Setup main FAB button click handler
        elements.fabMainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            elements.fabMainBtn.classList.toggle('active');
            elements.fabMenu.classList.toggle('active');
        });

        // Create buttons
        actions.forEach((action, index) => {
            const btn = document.createElement('button');
            btn.id = action.id;
            btn.className = `fab fab-action ${action.class}`;
            btn.title = action.title;
            btn.innerHTML = `<span>${action.icon}</span>`;
            btn.style.setProperty('--fab-delay', index + 1); // Set sequential delay

            // Prevent click event from reaching document
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Execute action and close menu
                action.fn();
                elements.fabMainBtn.classList.remove('active');
                elements.fabMenu.classList.remove('active');
            });

            // Add tap and hover feedback
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.1)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
            });

            elements.fabMenu.appendChild(btn);
        });
     }

    // ===================================================================
    // 10. CURRENT TIME INDICATOR
    // ===================================================================
    function createOrUpdateTimeIndicator() {
        // Remove previous indicators first
        document.querySelectorAll('.time-indicator').forEach(el => el.remove()); // 
        const now = estimateCurrentServerTime(); // Use estimated server time 
        const tehranParts = getTehranParts(now); // Get parts based on Tehran time
        const todayIndex = tehranParts.dayIndex; // 
        // Check if 'now' is within the currently displayed week
        const weekStartMS = appState.currentWeekStartDate.getTime(); // 
        const weekEndMS = weekStartMS + 7 * MS_PER_DAY; // 
        if (now.getTime() >= weekStartMS && now.getTime() < weekEndMS) {
            const minutesIntoDay = tehranParts.hour * 60 + tehranParts.minute; // 
            const percentageOfDay = (minutesIntoDay / 1440) * 100; // 

            const isMobile = document.body.classList.contains('mobile-view'); // 
            const indicator = document.createElement('div'); // 
            indicator.className = 'time-indicator'; // 

            if (isMobile) {
                // Find the *outer* scrolling container
                const daysContainer = elements.calendarGridContainer?.querySelector('.mobile-days-container-outer');
                if (daysContainer) {
                     indicator.classList.add('mobile'); // 
                     indicator.style.top = `${percentageOfDay}%`; // 
                     daysContainer.appendChild(indicator); // Append to outer container
                     updateMobileIndicatorPosition(indicator, now, todayIndex); // 
                }
            } else {
                // Append inside the specific day's timeline cell (Desktop)
                const todayRowCell = elements.calendarGridContainer?.querySelector(`.day-row[data-day-index="${todayIndex}"] .timeline-cell`); // 
                if (todayRowCell) {
                    indicator.classList.add('desktop'); // 
                    indicator.style.right = `${percentageOfDay}%`; // RTL positioning
                    todayRowCell.appendChild(indicator); // 
                }
            }
        }
    }

    /**
     * Updates the horizontal position of the mobile time indicator based on scroll.
     */
     function updateMobileIndicatorPosition(indicator, now, todayIndex) {
         if (!indicator) return; // 
         const daysContainerOuter = elements.calendarGridContainer?.querySelector('.mobile-days-container-outer');
         const daysContainerInner = daysContainerOuter?.querySelector('.mobile-days-container-inner');
         if (daysContainerOuter && daysContainerInner) {
             const dayWidth = daysContainerInner.querySelector('.day-column')?.offsetWidth || 0; // 
             const scrollLeft = daysContainerOuter.scrollLeft; // Read scroll from outer container
             if(dayWidth > 0) {
                indicator.style.left = `${(todayIndex * dayWidth) - scrollLeft}px`; // 
                indicator.style.width = `${dayWidth}px`; // 
                indicator.style.display = 'block'; // Ensure visible 
             } else {
                 indicator.style.display = 'none'; // 
             }
         } else {
             indicator.style.display = 'none'; // 
         }
     }


    /**
     * Updates the position of the time indicator periodically.
     * 
     */
    function updateTimeIndicator() {
        const now = estimateCurrentServerTime(); // 
        const tehranParts = getTehranParts(now); // 
        const minutesIntoDay = tehranParts.hour * 60 + tehranParts.minute; // 
        const percentageOfDay = (minutesIntoDay / 1440) * 100; // 
        const todayIndex = tehranParts.dayIndex; // 

        const isMobile = document.body.classList.contains('mobile-view'); // 
        // Check if indicator exists and if day has changed
        let currentIndicator = document.querySelector('.time-indicator'); // 
        let indicatorDayIndex = -1; // 
        if(currentIndicator) {
            if(isMobile) {
                // Find the day index based on the 'left' style and scroll position
                const daysContainerOuter = elements.calendarGridContainer?.querySelector('.mobile-days-container-outer');
                if(daysContainerOuter) {
                    const dayWidth = daysContainerOuter.querySelector('.day-column')?.offsetWidth || 1;
                    const scrollLeft = daysContainerOuter.scrollLeft;
                    const currentLeft = parseFloat(currentIndicator.style.left) || 0;
                    indicatorDayIndex = Math.round((currentLeft + scrollLeft) / dayWidth);
                }
            } else {
                const parentCell = currentIndicator.closest('[data-day-index]'); // 
                indicatorDayIndex = parentCell ? parseInt(parentCell.dataset.dayIndex, 10) : -1; // 
            }
        }

        // If day changed or indicator doesn't exist, recreate it
        if (!currentIndicator || indicatorDayIndex !== todayIndex) {
            createOrUpdateTimeIndicator(); // 
        } else {
            // Otherwise, just update position
            if (isMobile) {
                currentIndicator.style.top = `${percentageOfDay}%`; // 
                updateMobileIndicatorPosition(currentIndicator, now, todayIndex); // Update horizontal position 
            } else {
                currentIndicator.style.right = `${percentageOfDay}%`; // 
            }
        }
    }

    function startTimeIndicator() {
        if (appState.timeIndicatorInterval) clearInterval(appState.timeIndicatorInterval); // 
        createOrUpdateTimeIndicator(); // Create/update immediately 
        appState.timeIndicatorInterval = setInterval(updateTimeIndicator, TIME_INDICATOR_INTERVAL_MS); // 
    }

    // ===================================================================
    // 11. Mobile Gesture Handlers (from V.1.5.6)
    // ===================================================================
    function handleGestureStart(e) {
        const isMobile = document.body.classList.contains('mobile-view'); // 
        if (!isMobile) return; // 
        // Ignore gestures on interactive elements
        if (e.target.closest('.event, .event-allday, button, a, select, input')) { return; // 
        }

        const touches = e.touches; // 
        if (touches.length === 2) { // Pinch Start
            appState.gestureState.active = true; // 
            appState.gestureState.isSwipe = false; // 
            const dx = touches[0].clientX - touches[1].clientX; // 
            const dy = touches[0].clientY - touches[1].clientY;
            // Determine dominant axis for pinch zoom
            if (Math.abs(dx) > Math.abs(dy) * 1.5) {
                appState.gestureState.type = 'horizontal'; // 
                appState.gestureState.lastDist = Math.abs(dx); // 
            } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
                appState.gestureState.type = 'vertical'; // 
                appState.gestureState.lastDist = Math.abs(dy); // 
            } else { appState.gestureState.type = null; } // 
        } else if (touches.length === 1) { // Swipe Start
            appState.gestureState.isSwipe = true; // 
            appState.gestureState.swipeStartX = touches[0].clientX; // 
            appState.gestureState.swipeStartY = touches[0].clientY; // 
        }
    }
    function handleGestureMove(e) {
        // If swipe is active, check if vertical scroll should be prevented
        if(appState.gestureState.isSwipe && e.touches.length === 1) {
            const dx = Math.abs(e.touches[0].clientX - appState.gestureState.swipeStartX); // 
            const dy = Math.abs(e.touches[0].clientY - appState.gestureState.swipeStartY); // 
            // If horizontal movement is dominant, prevent vertical scroll
            if (dx > dy && dx > 10) { // Threshold of 10px
                 e.preventDefault(); // 
            }
            return; // Don't process pinch
        }

        if (!appState.gestureState.active || appState.gestureState.type === null || e.touches.length !== 2) {
            return; // Only process active pinch zooms with 2 touches
        }
        e.preventDefault(); // Prevent scroll/zoom ONLY during active pinch

        const touches = e.touches; // 
        const config = appState.mobileViewConfig; // 

        if (appState.gestureState.type === 'horizontal') {
            const dist = Math.abs(touches[0].clientX - touches[1].clientX); // 
            const delta = dist - appState.gestureState.lastDist; // 
            if (Math.abs(delta) > 20) { // Threshold
                if (delta > 0) { // Zoom In (less days)
                    if (config.dayCount === 7) config.dayCount = 4; // 
                    else if (config.dayCount === 4) config.dayCount = 3; // 
                    else if (config.dayCount === 3) config.dayCount = 1; // 
                } else { // Zoom Out (more days)
                    if (config.dayCount === 1) config.dayCount = 3; // 
                    else if (config.dayCount === 3) config.dayCount = 4; // 
                    else if (config.dayCount === 4) config.dayCount = 7; // 
                }
                appState.gestureState.lastDist = dist; // 
                updateMobileViewCSS(); // 
            }
        } else if (appState.gestureState.type === 'vertical') {
            const dist = Math.abs(touches[0].clientY - touches[1].clientY); // 
            const delta = dist - appState.gestureState.lastDist; // 
            if (Math.abs(delta) > 20) { // Threshold
                if (delta > 0) { // Zoom In (bigger hours)
                    if (config.hourZoom < 4) config.hourZoom++; // 
                } else { // Zoom Out (smaller hours)
                    if (config.hourZoom > 1) config.hourZoom--; // 
                }
                appState.gestureState.lastDist = dist; // 
                updateMobileViewCSS(); // 
            }
        }
    }
    function handleGestureEnd(e) {
         if (appState.gestureState.active) {
            appState.gestureState.active = false; // 
            appState.gestureState.type = null; // 
            appState.gestureState.lastDist = 0; // 
         }

         // Swipe Navigation Check
        if (appState.gestureState.isSwipe && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0]; // 
            const dx = touch.clientX - appState.gestureState.swipeStartX; // 
            const dy = touch.clientY - appState.gestureState.swipeStartY; // 
            // Check for significant horizontal swipe, minimal vertical movement
            if (Math.abs(dx) > appState.gestureState.swipeMinDist && Math.abs(dy) < (appState.gestureState.swipeMinDist / 1.5)) {
                handleMobileSwipe(dx > 0 ? 'right' : 'left'); // Pass direction
            }
        }
        appState.gestureState.isSwipe = false; // Reset swipe flag
    }
    function handleMobileSwipe(direction) {
        const container = elements.calendarGridContainer?.querySelector('.mobile-days-container-outer'); // Swipe on outer container 
        if (!container) return; // 

        const scrollLeft = container.scrollLeft; // 
        const scrollWidth = container.scrollWidth; // 
        const clientWidth = container.clientWidth; // 
        const threshold = 15; // 

        if (direction === 'right' && scrollLeft <= threshold) {
            console.log("Swipe Right -> Prev Week"); // 
            navigateWeek(-7); // 
        } else if (direction === 'left' && (scrollLeft + clientWidth) >= (scrollWidth - threshold)) {
            console.log("Swipe Left -> Next Week"); // 
            navigateWeek(7); // 
        }
    }

    // ===================================================================
    // 12. UTILITY & Setup
    // ===================================================================

    /**
     * Calculates actual mobile header height and updates CSS variable if needed.
     * 
     */
    function calculateMobileHeaderHeight() {
        if (window.matchMedia("(max-width: 768px)").matches && elements.mainHeader) {
            appState.mobileHeaderActualHeight = elements.mainHeader.offsetHeight; // 
            document.documentElement.style.setProperty('--mobile-header-height', `${appState.mobileHeaderActualHeight}px`); // 
        }
    }

    /**
     * Generates week options for a select element around a given center date.
     * 
     */
     function generateWeekOptions(selectElement, centerDate) {
        if (!selectElement) return; // 
        selectElement.innerHTML = ''; // Clear existing options 

        const weeksToShow = 12; // e.g., 4 before, 1 current, 7 after
        const startOffset = -4 * 7; // Start 4 weeks before center

        const currentWeekStartDateStr = formatDate(getStartDate(formatDate(centerDate))); // Ensure we get the Sat of center week

        const formatter = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }); // 
        for (let i = 0; i < weeksToShow; i++) {
            const weekStart = new Date(centerDate); // 
            weekStart.setDate(weekStart.getDate() + startOffset + (i * 7)); // 
            // Ensure we get the Saturday of that week
            const satOfWeek = getStartDate(formatDate(weekStart)); // 
            const satStr = formatDate(satOfWeek); // 

            const endOfWeek = new Date(satOfWeek); // 
            endOfWeek.setDate(satOfWeek.getDate() + 6); // 

            const option = document.createElement('option'); // 
            option.value = satStr; // 
            option.textContent = `( ${formatter.format(satOfWeek)} - ${formatter.format(endOfWeek)} )`; // 

            if (satStr === currentWeekStartDateStr) {
                option.selected = true; // Select the current week
            }
            selectElement.appendChild(option); // 
        }
    }

    /**
     * Navigates the calendar to the week containing today's date.
     * 
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Skip if inside an input/textarea
            if (e.target.matches('input, textarea, select')) {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        navigateWeek(7); // Next week (RTL)
                    }
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        navigateWeek(-7); // Previous week (RTL)
                    }
                    break;
                case 't':
                case 'T':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        navigateToToday();
                    }
                    break;
                case 'g':
                case 'G':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (appState.currentView !== 'grid') {
                            appState.currentView = 'grid';
                            elements.viewToggleBtn.textContent = 'نمای لیستی';
                            renderCurrentView();
                        }
                    }
                    break;
                case 'l':
                case 'L':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (appState.currentView !== 'list') {
                            appState.currentView = 'list';
                            elements.viewToggleBtn.textContent = 'نمای جدولی';
                            renderCurrentView();
                        }
                    }
                    break;
                case 'n':
                case 'N':
                    if ((e.ctrlKey || e.metaKey) && CURRENT_USER.role !== 'viewer') {
                        e.preventDefault();
                        openEventModal();
                    }
                    break;
            }
        });
    }

    function setupEventListeners() {
        setupKeyboardNavigation();

        // --- Header Buttons ---
        elements.todayBtn?.addEventListener('click', navigateToToday); // 

        // Only navigate if not already viewing the current week
        if (formatDate(thisWeekStart) !== formatDate(appState.currentWeekStartDate)) {
            console.log("Navigating to Today's Week"); // 
            stopPolling(); // 
            appState.currentWeekStartDate = thisWeekStart; // 
            fetchAndRenderCurrentWeekData().then(startPolling); // 
        } else {
            console.log("Already viewing Today's Week"); // 
            // Optionally, scroll the current day into view if needed (mobile)
            if(document.body.classList.contains('mobile-view')) {
                 const todayIndex = getTehranParts(today).dayIndex; // 
                 const dayCol = elements.calendarGridContainer?.querySelector(`.day-column[data-day-index='${todayIndex}']`); // 
                 dayCol?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); // 
            }
        }
    }

    /**
     * Navigates forward or backward by a number of days (usually 7).
     */
    async function navigateWeek(days) {
        stopPolling(); // 
        appState.currentWeekStartDate.setDate(appState.currentWeekStartDate.getDate() + days); // 
        await fetchAndRenderCurrentWeekData(); // 
        startPolling(); // 
    }

    /**
     * Navigates to the week containing today's date.
     */
    async function navigateToToday() {
        const today = estimateCurrentServerTime();
        const thisWeekStart = getStartDate(formatDate(today));

        // Only navigate if not already viewing the current week
        if (formatDate(thisWeekStart) !== formatDate(appState.currentWeekStartDate)) {
            console.log("Navigating to Today's Week");
            stopPolling();
            appState.currentWeekStartDate = thisWeekStart;
            await fetchAndRenderCurrentWeekData();
            startPolling();
        } else {
            console.log("Already viewing Today's Week");
            // Optionally, scroll the current day into view if needed (mobile)
            if (document.body.classList.contains('mobile-view')) {
                const todayIndex = getTehranParts(today).dayIndex;
                const dayCol = elements.calendarGridContainer?.querySelector(`.day-column[data-day-index='${todayIndex}']`);
                dayCol?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }

    // ===================================================================
    // 13. EVENT LISTENERS SETUP
    // ===================================================================
    function setupEventListeners() {
        // --- FAB Button ---
        elements.fabMainBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.fabMainBtn.classList.toggle('active');
            elements.fabMenu?.classList.toggle('active');
        });

        // --- Header Buttons ---
        elements.todayBtn?.addEventListener('click', navigateToToday); // 
        elements.prevWeekBtn?.addEventListener('click', () => navigateWeek(-7)); // 
        elements.nextWeekBtn?.addEventListener('click', () => navigateWeek(7)); // 
        elements.legendBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // 
            elements.legendPopup?.classList.toggle('active'); // 
        });
        elements.viewToggleBtn?.addEventListener('click', () => {
            appState.currentView = (appState.currentView === 'grid' ? 'list' : 'grid'); // 
            elements.viewToggleBtn.textContent = (appState.currentView === 'grid' ? 'نمای لیستی' : 'نمای جدولی'); // 
            renderCurrentView(); // 
        });
        elements.calendarTitle?.addEventListener('click', () => openMiniCalendar('calendarTitle')); // Open mini cal from title 

        // --- Mini Calendar ---
        elements.miniCalPrevBtn?.addEventListener('click', () => changeMiniCalendarMonth(-1)); // 
        elements.miniCalNextBtn?.addEventListener('click', () => changeMiniCalendarMonth(1)); // 
        // Close popups on outside click
        document.addEventListener('click', (e) => {
             if (elements.legendPopup?.classList.contains('active') && !elements.legendPopup?.contains(e.target) && e.target !== elements.legendBtn) {
                 elements.legendPopup.classList.remove('active'); // 
             }
             // Close mini calendar if visible and click is outside
             if (appState.miniCal?.visible && elements.miniCalendarPopup && !elements.miniCalendarPopup.contains(e.target) && e.target !== elements.calendarTitle && !e.target.closest('#start-day-picker-btn') && !e.target.closest('#end-day-picker-btn')) {
                 closeMiniCalendar(); // 
             }
             // Close FAB on outside click (added robustness)
            if (elements.fabContainer && elements.fabMainBtn && !elements.fabContainer.contains(e.target) && elements.fabMainBtn.classList.contains('active')) {
                elements.fabMainBtn.classList.remove('active'); // 
                elements.fabMenu?.classList.remove('active'); // 
            }
        });
        // --- Event Creation/Editing (Click on Grid/List) ---
        elements.calendarGridContainer?.addEventListener('click', (e) => {
            const eventDiv = e.target.closest('.event, .event-allday'); // 
            const timelineCell = e.target.closest('.timeline-cell'); // 
            const allDayCell = e.target.closest('.all-day-cell');

            if (eventDiv) { // Clicked on an existing event
                const isLocked = eventDiv.dataset.locked === 'true'; // 
                if (isLocked) return; // Don't open modal for locked events 
                const event = JSON.parse(eventDiv.dataset.event); // 
                if (String(event.id).startsWith('h-')) return; // Ignore holiday placeholders 
                openEventModal(event); // 
            } else if (timelineCell && appState.currentView === 'grid') { // Clicked on empty timeline slot
                 if (CURRENT_USER.role === ROLES.VIEWER) return; // Viewers can't create 

                 // Calculate time from click position (approximate)
                 const rect = timelineCell.getBoundingClientRect(); // 
                 const isMobile = document.body.classList.contains('mobile-view'); // 
                 let percentage = 0; // 
                 if (isMobile) {
                     // Vertical position relative to cell top
                     percentage = ((e.clientY - rect.top) / rect.height) * 100; // 
                 } else {
                     // Horizontal position relative to cell right (RTL)
                     percentage = ((rect.right - e.clientX) / rect.width) * 100; // 
                 }
                 const totalMinutes = 1440; // 
                 const clickedMinute = Math.floor((percentage / 100) * totalMinutes); // 
                 // Round to nearest 15 minutes (or desired interval)
                 const roundedMinute = Math.round(clickedMinute / 15) * 15; // 
                 const hour = Math.floor(roundedMinute / 60); // 
                 const minute = roundedMinute % 60; // 
                 const prefillTime = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`; // 
                 const dayIndex = parseInt(timelineCell.dataset.dayIndex, 10); // 

                 openEventModal(null, { dayIndex: dayIndex, time: prefillTime }); // Open modal with prefill
            } else if (allDayCell && appState.currentView === 'grid') { // Click on all-day cell
                 if (CURRENT_USER.role === ROLES.VIEWER) return;
                 const dayIndex = parseInt(allDayCell.dataset.dayIndex, 10);
                 openEventModal(null, { dayIndex: dayIndex });
                 // Manually check all-day after modal opens
                 setTimeout(() => {
                    if (elements.isAllDayCheckbox) {
                        elements.isAllDayCheckbox.checked = true;
                        elements.isAllDayCheckbox.dispatchEvent(new Event('change'));
                    }
                 }, 50);
            }
        });
        elements.calendarListContainer?.addEventListener('click', (e) => {
             const listItem = e.target.closest('.list-view-item'); // 
             if (listItem) {
                 const isLocked = listItem.dataset.locked === 'true'; // 
                 if (isLocked) return; // 
                 try {
                     const event = JSON.parse(listItem.dataset.event); // 
                     if (event && !String(event.id).startsWith('h-')) {
                         openEventModal(event); // 
                     }
                 } catch (err) { console.error("Error parsing event data from list item", err); } // 
             }
         });
        // --- FAB Menu ---
        if (elements.fabMainBtn) {
            elements.fabMainBtn.addEventListener('click', (e) => {
                 e.stopPropagation(); //
                 elements.fabMainBtn.classList.toggle('active'); //
                 elements.fabMenu?.classList.toggle('active'); //
            });
            // Close FAB on outside click (added robustness)
            document.addEventListener('click', (e) => {
                if (elements.fabContainer && !elements.fabContainer.contains(e.target) && elements.fabMainBtn.classList.contains('active')) {
                    elements.fabMainBtn.classList.remove('active'); //
                    elements.fabMenu?.classList.remove('active'); //
                }
            });
        }

        // --- Event Modal ---
        if (elements.eventModal) {
            elements.isAllDayCheckbox?.addEventListener('change', (e) => {
                const isChecked = e.target.checked; // 
                document.getElementById('startHour').disabled = isChecked;
                document.getElementById('startMinute').disabled = isChecked;
                document.getElementById('endHour').disabled = isChecked;
                document.getElementById('endMinute').disabled = isChecked;
                // Keep date inputs enabled
                if(isChecked) {
                    // Set default all-day times
                    document.getElementById('startHour').value = "00";
                    document.getElementById('startMinute').value = "00";
                    document.getElementById('endHour').value = "24";
                    document.getElementById('endMinute').value = "00";
                    // If start/end days were different, reset end day to start day
                    elements.endDateInput.value = elements.startDateInput.value; // 
                } else {
                    // Restore default times
                    document.getElementById('startHour').value = "09";
                    document.getElementById('startMinute').value = "00";
                    document.getElementById('endHour').value = "10";
                    document.getElementById('endMinute').value = "00";
                }
            });
            elements.cancelEventBtn?.addEventListener('click', closeEventModal); // 
            elements.eventForm?.addEventListener('submit', handleEventFormSubmit); // 
            elements.approveEventBtn?.addEventListener('click', () => handleEventStatusUpdate(STATUS.APPROVED)); // 
            elements.rejectEventBtn?.addEventListener('click', () => handleEventStatusUpdate(STATUS.REJECTED)); // 
            elements.deleteEventBtn?.addEventListener('click', handleEventDelete); // 
            // Date/Time Picker Buttons
             elements.startDayPickerBtn?.addEventListener('click', () => openMiniCalendar('startDate')); // 
             elements.endDayPickerBtn?.addEventListener('click', () => openMiniCalendar('endDate')); // 
             // Click on time inputs will trigger native picker
        }

        // --- Settings Modal ---
        elements.saveSettingsBtn?.addEventListener('click', handleSettingsSave); // 
        elements.cancelSettingsBtn?.addEventListener('click', closeSettingsModal); // 

        // --- Departments Modal ---
        elements.saveDeptsBtn?.addEventListener('click', handleDeptsSave); // 
        elements.addNewDeptBtn?.addEventListener('click', addNewDeptEditorRow); // 
        elements.cancelDeptsBtn?.addEventListener('click', closeDeptsModal); // 
        // --- Users Modal ---
        elements.addNewUserBtn?.addEventListener('click', addNewUserEditorRow); // 
        elements.cancelUsersBtn?.addEventListener('click', closeUsersModal); // 
        // Save/Delete listeners are added dynamically in createUserEditorRow

        // --- Issue Modals ---
        elements.sendIssueBtn?.addEventListener('click', handleIssueSend); // 
        elements.cancelIssueBtn?.addEventListener('click', closeIssueModal); // 
        elements.closeIssuesBtn?.addEventListener('click', closeViewIssuesModal); // 

        // --- Mobile Gestures & Resize ---
        let resizeTimer; // 
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer); // 
            resizeTimer = setTimeout(() => {
                calculateMobileHeaderHeight(); // Recalculate header height 
                renderGridView(); // Re-render grid which handles mobile/desktop switch 
                startTimeIndicator(); // Restart indicator positioning 
             }, 150); // Debounce resize events 
        });
        if (elements.calendarGridContainer) {
             // Mobile Gestures - Use passive: false ONLY for touchmove if preventing default
             elements.calendarGridContainer.addEventListener('touchstart', handleGestureStart, { passive: true }); // Can be passive initially
             elements.calendarGridContainer.addEventListener('touchmove', handleGestureMove, { passive: false }); // Needs false to prevent scroll during pinch
             elements.calendarGridContainer.addEventListener('touchend', handleGestureEnd); // 
             elements.calendarGridContainer.addEventListener('touchcancel', handleGestureEnd); // 
             
             // Mobile Time Indicator Scroll Update
            const mobileDaysContainer = elements.calendarGridContainer.querySelector('.mobile-days-container-outer');
            if (mobileDaysContainer) {
                mobileDaysContainer.addEventListener('scroll', () => {
                    const mobileIndicator = document.querySelector('.time-indicator.mobile');
                    if (mobileIndicator) {
                        const now = estimateCurrentServerTime();
                        const tehranParts = getTehranParts(now);
                        updateMobileIndicatorPosition(mobileIndicator, now, tehranParts.dayIndex);
                    }
                }, { passive: true });
            }
        }
    }

    function populateTimePickers() {
        const startHour = document.getElementById('startHour');
        const startMinute = document.getElementById('startMinute');
        const endHour = document.getElementById('endHour');
        const endMinute = document.getElementById('endMinute');

        if (!startHour) return; // Guard clause

        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0');
            startHour.innerHTML += `<option value="${hour}">${hour}</option>`;
            endHour.innerHTML += `<option value="${hour}">${hour}</option>`;
        }
        endHour.innerHTML += `<option value="24">24</option>`;


        for (let i = 0; i < 60; i += 15) {
            const minute = i.toString().padStart(2, '0');
            startMinute.innerHTML += `<option value="${minute}">${minute}</option>`;
            endMinute.innerHTML += `<option value="${minute}">${minute}</option>`;
        }
    }


    function setupDatePickers() {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (!startDateInput) return; // Guard clause

        const startDatePicker = new Pikaday({
            field: startDateInput,
            trigger: document.getElementById('start-day-picker-btn'),
            i18n: {
                previousMonth: 'ماه قبل',
                nextMonth: 'ماه بعد',
                months: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
                weekdays: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
                weekdaysShort: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
            },
            isRTL: true,
            firstDay: 6, // Saturday
            format: 'YYYY-MM-DD',
            onSelect: () => {
                endDateInput.value = startDateInput.value;
            }
        });

        const endDatePicker = new Pikaday({
            field: endDateInput,
            trigger: document.getElementById('end-day-picker-btn'),
            i18n: {
                previousMonth: 'ماه قبل',
                nextMonth: 'ماه بعد',
                months: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
                weekdays: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'],
                weekdaysShort: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
            },
            isRTL: true,
            firstDay: 6, // Saturday
            format: 'YYYY-MM-DD'
        });
    }

    // ===================================================================
    // 14. Initial Load
    // ===================================================================
    function initializeApp() {
        console.log("Initializing Calendar App V.1.5.8"); // 
        populateTimePickers();
        setupDatePickers();
        setupEventListeners(); // 
        setupFabMenu(); // 
        loadAndRender(); // Start the app 
    }

    initializeApp();

}); // End DOMContentLoaded