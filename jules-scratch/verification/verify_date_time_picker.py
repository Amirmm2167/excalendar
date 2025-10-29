
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto("http://127.0.0.1:8000/index.php", wait_until="domcontentloaded")

        # Open the event modal
        page.locator(".fab-main").click()
        page.locator("#fab-add").click()

        # Select a date
        page.locator("#startDate").click()
        page.locator(".pika-next").click()
        page.locator(".pika-day[data-pika-day='15']").click()

        # Select a time
        page.select_option("#startHour", "14")
        page.select_option("#startMinute", "30")

        # Fill in the event title
        page.locator("#eventTitle").fill("Test Event")

        # Save the event
        page.locator("#save-event-btn").click()

        # Reopen the event and verify the values
        page.locator(".event[data-event-title='Test Event']").click()
        expect(page.locator("#startDate")).to_have_value("1404-08-15")
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
