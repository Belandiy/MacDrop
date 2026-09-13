import struct
import zlib
import os

def make_png(width, height, get_pixel):
    raw_data = bytearray()
    for y in range(height):
      raw_data.append(0)  # filter type 0: None
      for x in range(width):
        r, g, b, a = get_pixel(x, y, width, height)
        raw_data.extend([r, g, b, a])

    compressed = zlib.compress(bytes(raw_data), 9)

    def chunk(chunk_type, data):
      length = struct.pack('>I', len(data))
      c_type = chunk_type.encode('ascii')
      crc = struct.pack('>I', zlib.crc32(c_type + data) & 0xFFFFFFFF)
      return length + c_type + data + crc

    png_header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = (
        struct.pack('>II', width, height)
        + b'\x08\x06\x00\x00\x00'  # 8-bit depth, RGBA, deflate, no filter, no interlace
    )
    ihdr = chunk('IHDR', ihdr_data)
    idat = chunk('IDAT', compressed)
    iend = chunk('IEND', b'')

    return png_header + ihdr + idat + iend

def circle_pixel(x, y, w, h):
    cx, cy = w / 2.0, h / 2.0
    r = min(w, h) / 2.0 - 1.0
    dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    if dist <= r:
        # Apple blue gradient
        factor = (y / float(h))
        red = int(0x00 * (1 - factor) + 0x00 * factor)
        green = int(0x7A * (1 - factor) + 0x55 * factor)
        blue = int(0xFF * (1 - factor) + 0xEB * factor)
        return (red, green, blue, 255)
    elif dist <= r + 1.0:
        alpha = int(255 * (r + 1.0 - dist))
        return (0, 122, 255, alpha)
    else:
        return (0, 0, 0, 0)

os.makedirs('public', exist_ok=True)

# 256x256 main icon
icon_256 = make_png(256, 256, circle_pixel)
with open('public/icon.png', 'wb') as f:
    f.write(icon_256)

# 16x16 tray icon
icon_16 = make_png(16, 16, circle_pixel)
with open('public/tray-icon.png', 'wb') as f:
    f.write(icon_16)

# Also create public/icon.ico from 256x256 PNG
ico_header = struct.pack('<HHH', 0, 1, 1) # reserved, type 1 (ico), 1 image
ico_entry = struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, len(icon_256), 6 + 16) # width 0=256, height 0=256, 256 colors=0, reserved=0, color planes=1, bpp=32, size, offset
with open('public/icon.ico', 'wb') as f:
    f.write(ico_header + ico_entry + icon_256)

print("Icons generated successfully!")
