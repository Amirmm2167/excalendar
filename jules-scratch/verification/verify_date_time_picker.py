from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto("http://127.0.0.1:8000/index.php", wait_until="networkidle")

        # Open the event modal
        page.locator(".fab-main").click()
        page.wait_for_timeout(500) # wait for fab menu to animate in
        expect(page.locator(".fab-menu")).to_be_visible()
        page.locator("#fab-add").click()

        # Click the date picker button
        page.locator("#start-day-picker-btn").click()

        # Verify the date picker is visible
        expect(page.locator(".pika-single")).to_be_visible()

        # Select a date
        page.locator(".pika-day[data-day='15']").click()

        # Verify the date was selected
        expect(page.locator("#startDate")).to_have_value(lambda value: "15" in value)

        # Select a time
        page.select_option("#startHour", "14")
        page.select_option("#startMinute", "30")

        # Verify the time was selected
        expect(page.locator("#startHour")).to_have_value("14")
        expect(page.locator("#startMinute")).to_have_value("30")

        page.screenshot(path="jules-scratch/verification/date_time_picker_test.png")
        print("Successfully verified the date and time picker.")

    except Exception as e:
        print(f"Verification script failed: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
