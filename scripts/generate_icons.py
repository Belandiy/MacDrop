import os
import sys

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def generate():
    os.makedirs('public', exist_ok=True)
    
    logo_path = 'MacDrop_app_logo_design_20260913131606.jpeg'
    if not os.path.exists(logo_path):
        logo_path = 'public/logo.png'
    
    if os.path.exists(logo_path):
        img = Image.open(logo_path).convert('RGBA')
    else:
        # Fallback create 1024x1024
        img = Image.new('RGBA', (1024, 1024), (0, 122, 255, 255))

    # Ensure at least 1024x1024 for macOS Retina and electron-builder
    if img.size[0] < 1024 or img.size[1] < 1024:
        img = img.resize((1024, 1024), Image.Resampling.LANCZOS)

    # 1. Main 1024x1024 icon for macOS & Linux & Windows
    img.save('public/icon.png', 'PNG')

    # 2. Windows multi-size .ico
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save('public/icon.ico', format='ICO', sizes=ico_sizes)

    # 3. Tray icon 32x32
    tray = img.resize((32, 32), Image.Resampling.LANCZOS)
    tray.save('public/tray-icon.png', 'PNG')

    # 4. App UI logo 128x128
    ui_logo = img.resize((128, 128), Image.Resampling.LANCZOS)
    ui_logo.save('public/logo.png', 'PNG')

    print('Icons successfully generated: 1024x1024 icon.png, multi-size icon.ico, tray-icon.png')

if __name__ == '__main__':
    generate()
