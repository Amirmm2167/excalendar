
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto("http://127.0.0.1:8000/index.php", wait_until="domcontentloaded")

        # # Log in
        # page.get_by_label("نام کاربری:").fill("admin")
        # page.get_by_label("رمز عبور:").fill("admin")
        # page.get_by_role("button", name="ورود").click()
        # page.wait_for_url("http://127.0.0.1:8000/index.php", wait_until="domcontentloaded")
        page.wait_for_selector(".fab-main", timeout=10000)

        # Click the FAB button and verify the menu is visible
        page.locator(".fab-main").click()
        expect(page.locator(".fab-menu")).to_be_visible()

        page.screenshot(path="jules-scratch/verification/fab_button_test.png")
        print("Successfully verified the FAB button.")

    except Exception as e:
        print(f"Verification script failed: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
