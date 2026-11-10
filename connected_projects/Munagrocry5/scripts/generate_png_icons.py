import zlib
import struct
import math

def make_png(width, height, draw_fn):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter byte: None
        for x in range(width):
            r, g, b, a = draw_fn(x, y, width, height)
            raw_data.extend((r, g, b, a))
            
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(bytes(raw_data), 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def draw_munna_icon(x, y, w, h):
    # Normalized coordinates 0.0 to 1.0
    nx = x / float(w)
    ny = y / float(h)
    
    # Rounded corner mask
    corner_radius = 0.15
    dx = max(corner_radius - nx, 0, nx - (1 - corner_radius))
    dy = max(corner_radius - ny, 0, ny - (1 - corner_radius))
    if math.hypot(dx, dy) > corner_radius:
        return (0, 0, 0, 0) # Transparent outside squircle
        
    # Deep Navy Blue Gradient Background (#0c2340 to #1864ab)
    grad_factor = (nx + ny) / 2.0
    r = int(12 * (1 - grad_factor) + 24 * grad_factor)
    g = int(35 * (1 - grad_factor) + 100 * grad_factor)
    b = int(64 * (1 - grad_factor) + 171 * grad_factor)
    
    # Center circle badge
    cx, cy = 0.5, 0.45
    dist_center = math.hypot(nx - cx, ny - cy)
    
    # Golden Cart Handle (arc at top)
    cart_handle_dist = math.hypot(nx - 0.5, (ny - 0.38) * 1.5)
    if 0.11 < cart_handle_dist < 0.15 and ny < 0.38:
        return (255, 212, 59, 255) # Gold #ffd43b
        
    # Green Grocery Basket Body (#10b981)
    if 0.38 <= ny <= 0.62 and abs(nx - 0.5) <= (0.24 - (ny - 0.38) * 0.2):
        return (16, 185, 129, 255)
        
    # Central "M" Letter in White inside basket
    if 0.43 <= ny <= 0.57:
        if abs(nx - 0.42) < 0.025 or abs(nx - 0.58) < 0.025:
            return (255, 255, 255, 255)
        # Diagonal strokes of M
        if abs(nx - 0.46) < 0.02 and abs((ny - 0.43) - (nx - 0.42) * 2.5) < 0.04:
            return (255, 255, 255, 255)
        if abs(nx - 0.54) < 0.02 and abs((ny - 0.43) - (0.58 - nx) * 2.5) < 0.04:
            return (255, 255, 255, 255)

    # Bottom Golden Accent Bar
    if 0.78 <= ny <= 0.83 and 0.20 <= nx <= 0.80:
        return (255, 212, 59, 255)
        
    return (r, g, b, 255)

for size, filename in [(192, 'public/icon-192.png'), (512, 'public/icon-512.png'), (180, 'public/apple-touch-icon.png')]:
    png_bytes = make_png(size, size, draw_munna_icon)
    with open(filename, 'wb') as f:
        f.write(png_bytes)
    print(f"Generated {filename} ({size}x{size})")
