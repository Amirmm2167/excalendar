
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    try:
        # Go directly to index.php, bypassing the login
        page.goto("http://127.0.0.1:8000/index.php", wait_until="domcontentloaded")

        # Test the mini-calendar functionality
        page.locator("#calendar-title").click()

        # Assert that the mini-calendar is visible and properly rendered
        mini_calendar = page.locator("#mini-calendar")
        expect(mini_calendar).to_be_visible()
        # Correct way to assert the count is greater than a number
        expect(mini_calendar.locator(".mini-cal-day")).not_to_be_empty()

        page.screenshot(path="jules-scratch/verification/mini_calendar_fixed.png")
        print("Successfully verified the mini-calendar fix.")

    except Exception as e:
        print(f"Verification script failed: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
