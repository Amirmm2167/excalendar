import os

# --- تنظیمات ---
# پوشه‌ای که می‌خواهید اسکن کنید (نقطه '.' به معنای پوشه فعلی است)
ROOT_DIRECTORY = '.' 

# نام فایل نهایی که همه‌چیز در آن ذخیره می‌شود
OUTPUT_FILE = 'text.txt'

# لیست پوشه‌هایی که باید نادیده گرفته شوند
IGNORED_DIRECTORIES = {
    '.git', 
    '.gitignore', 
    '.vscode', 
    'node_modules', 
    '__pycache__', 
    '.venv',
    'venv',
    '__pycache__',
    'dist',
    'build',
    '.next',
    '.node_modules',
    'migrations'
}

# لیست پسوند فایل‌هایی که باید نادیده گرفته شوند (فایل‌های باینری، عکس و...)
IGNORED_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
    '.zip', '.rar', '.gz', '.tar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.o',
    '.pyc',
    '.mp4', '.mkv', '.mov', '.mp3',
    '.lock',
    '.txt', '.py', '.ttf'
}
# --- پایان تنظیمات ---

def get_all_files_content():
    # مسیر کامل فایل خروجی را می‌سازیم تا بعداً بتوانیم آن را نادیده بگیریم
    try:
        abs_output_path = os.path.abspath(os.path.join(ROOT_DIRECTORY, OUTPUT_FILE))
    except Exception as e:
        print(f"Error getting absolute path for output file: {e}")
        return

    print(f"Writing project content to {OUTPUT_FILE}...")

    # فایل خروجی را در حالت 'write' با انکودینگ 'utf-8' باز می‌کنیم
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
            # os.walk به صورت بازگشتی تمام پوشه‌ها و فایل‌ها را پیدا می‌کند
            # topdown=True به ما اجازه می‌دهد لیست dirnames را ویرایش کنیم
            for dirpath, dirnames, filenames in os.walk(ROOT_DIRECTORY, topdown=True):
                
                # --- بهینه‌سازی: از ورود به پوشه‌های نادیده گرفته شده جلوگیری می‌کنیم ---
                # ما لیست dirnames را "درجا" (in-place) ویرایش می‌کنیم
                # [:]
                dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRECTORIES]

                for filename in filenames:
                    # مسیر کامل فایل فعلی
                    file_path = os.path.join(dirpath, filename)
                    
                    # مسیر کامل برای مقایسه
                    abs_file_path = os.path.abspath(file_path)

                    # --- نادیده گرفتن فایل‌ها ---
                    # 1. اگر فایل فعلی، خود فایل خروجی است، از آن بگذر
                    if abs_file_path == abs_output_path:
                        continue
                        
                    # 2. اگر پسوند فایل در لیست نادیده گرفته شده‌ها بود، از آن بگذر
                    file_ext = os.path.splitext(filename)[1].lower()
                    if file_ext in IGNORED_EXTENSIONS:
                        continue

                    # --- نوشتن در فایل خروجی ---
                    try:
                        # مسیر نسبی فایل (برای نمایش در خروجی)
                        relative_path = os.path.relpath(file_path, ROOT_DIRECTORY)
                        # اطمینان از اینکه از اسلش / استفاده می‌شود (برای سازگاری)
                        relative_path = relative_path.replace(os.path.sep, '/')

                        # 1. نوشتن مسیر فایل طبق فرمت درخواستی شما
                        outfile.write(f"{relative_path}\n\n")

                        # 2. خواندن محتوای فایل
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                        
                        # 3. نوشتن محتوای فایل
                        outfile.write(content)
                        
                        # 4. اضافه کردن دو خط جدید برای جدا کردن از فایل بعدی
                        outfile.write("\n\n")

                    except UnicodeDecodeError:
                        # این اتفاق زمانی می‌افتد که فایل متنی نیست (مثلاً باینری است)
                        outfile.write(f"[Error: Cannot read binary file or file with unsupported encoding]\n\n")
                    except Exception as e:
                        outfile.write(f"[Error reading file {file_path}: {e}]\n\n")

    except IOError as e:
        print(f"Error opening or writing to output file {OUTPUT_FILE}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    
    print(f"Done! All content written to {OUTPUT_FILE}")

# اجرای تابع اصلی
if __name__ == "__main__":
    get_all_files_content()