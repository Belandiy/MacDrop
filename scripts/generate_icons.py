import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw

def generate():
    os.makedirs('public', exist_ok=True)
    os.makedirs('dist', exist_ok=True)
    
    logo_path = 'new_logo.jpeg'
    if not os.path.exists(logo_path):
        logo_path = 'public/icon.png'
    
    if os.path.exists(logo_path):
        img = Image.open(logo_path).convert('RGBA')
        if logo_path.endswith('.jpeg') or logo_path.endswith('.jpg'):
            w, h = img.size
            ImageDraw.floodfill(img, (0, 0), (0, 0, 0, 0), thresh=20)
            ImageDraw.floodfill(img, (w - 1, 0), (0, 0, 0, 0), thresh=20)
            ImageDraw.floodfill(img, (0, h - 1), (0, 0, 0, 0), thresh=20)
            ImageDraw.floodfill(img, (w - 1, h - 1), (0, 0, 0, 0), thresh=20)
    else:
        img = Image.new('RGBA', (1024, 1024), (99, 102, 241, 255))

    if img.size[0] < 1024 or img.size[1] < 1024:
        img = img.resize((1024, 1024), Image.Resampling.LANCZOS)

    # 1. Main 1024x1024 icon for macOS & Linux & Windows
    img.save('public/icon.png', 'PNG')
    img.save('dist/icon.png', 'PNG')

    # 2. Windows multi-size .ico
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save('public/icon.ico', format='ICO', sizes=ico_sizes)
    img.save('dist/icon.ico', format='ICO', sizes=ico_sizes)

    # 3. App UI logo 128x128
    ui_logo = img.resize((128, 128), Image.Resampling.LANCZOS)
    ui_logo.save('public/logo.png', 'PNG')
    os.makedirs('src/renderer/src/assets', exist_ok=True)
    ui_logo.save('src/renderer/src/assets/logo.png', 'PNG')

    # 4. Tray icon
    tray_path = 'new_tray.png'
    if not os.path.exists(tray_path):
        tray_path = 'public/tray-icon-mac.png' if os.path.exists('public/tray-icon-mac.png') else 'public/tray-icon.png'

    if os.path.exists(tray_path):
        tray_img = Image.open(tray_path).convert('RGBA')
        bbox = tray_img.getbbox()
        if bbox and (tray_path == 'new_tray.png'):
            xmin, ymin, xmax, ymax = bbox
            h_crop = ymax - ymin
            w_crop = xmax - xmin
            cx = (xmin + xmax) // 2
            cy = (ymin + ymax) // 2
            side = int(max(h_crop, w_crop) * 1.1)
            x0 = max(0, cx - side // 2)
            y0 = max(0, cy - side // 2)
            x1 = min(tray_img.width, x0 + side)
            y1 = min(tray_img.height, y0 + side)
            cropped = tray_img.crop((x0, y0, x1, y1))
            max_dim = max(cropped.width, cropped.height)
            square_tray = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
            square_tray.paste(cropped, ((max_dim - cropped.width) // 2, (max_dim - cropped.height) // 2))
        else:
            square_tray = tray_img

        tray_resized = square_tray.resize((64, 64), Image.Resampling.LANCZOS)
        tray_resized.save('public/tray-icon.png', 'PNG')
        tray_resized.save('public/tray-icon-mac.png', 'PNG')
        tray_resized.save('public/tray-icon-win.png', 'PNG')
        tray_resized.save('dist/tray-icon.png', 'PNG')
        tray_resized.save('dist/tray-icon-mac.png', 'PNG')
        tray_resized.save('dist/tray-icon-win.png', 'PNG')

    print('Icons successfully verified and generated')

if __name__ == '__main__':
    generate()


