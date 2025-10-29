
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto("http://127.0.0.1:8000/", wait_until="domcontentloaded")

        # Log in
        page.get_by_label("نام کاربری:").fill("admin")
        page.get_by_label("رمز عبور:").fill("admin")
        page.get_by_role("button", name="ورود").click()
        page.wait_for_url("http://127.0.0.1:8000/index.php", wait_until="domcontentloaded")
        page.wait_for_selector(".fab-main", timeout=10000)

        # Open the event modal
        page.locator(".fab-main").click()
        page.wait_for_timeout(500)
        page.locator("#fab-add").dispatch_event("click")

        # Select a date
        page.locator("input#startDate").click()
        page.locator(".pika-next").click()
        page.locator(".pika-day[data-pika-day='15']").click()

        # Select a time
        page.select_option("#startHour", "14")
        page.select_option("#startMinute", "30")

        # Fill in the event title
        page.locator("#eventTitle").fill("Test Event")

        # Save the event
        page.locator("#save-event-btn").click()

        page.screenshot(path="jules-scratch/verification/date_time_picker_test.png")
        print("Successfully verified the date and time picker.")

    except Exception as e:
        print(f"Verification script failed: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
