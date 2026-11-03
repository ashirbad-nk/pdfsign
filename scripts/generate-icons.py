#!/usr/bin/env python3
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SVG_CONTENT = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
    <linearGradient id="pen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1e1b4b" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="96" y="80" width="320" height="352" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.18" stroke-width="6"/>
  <line x1="144" y1="140" x2="260" y2="140" stroke="#ffffff" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round"/>
  <line x1="144" y1="180" x2="368" y2="180" stroke="#ffffff" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round"/>
  <line x1="144" y1="220" x2="320" y2="220" stroke="#ffffff" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round"/>
  <path d="M128 350 C 180 330, 220 280, 260 220 C 290 170, 320 190, 310 260 C 300 330, 250 370, 200 370 C 160 370, 220 340, 290 320 C 340 305, 380 325, 400 340" 
        fill="none" stroke="url(#pen)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)"/>
  <circle cx="410" cy="340" r="10" fill="#38bdf8"/>
</svg>'''

def draw_icon(size=512, is_maskable=False):
    # Oversample 2x for antialiasing
    scale = 2
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Gradient background
    c_top = (99, 102, 241)     # #6366f1
    c_bot = (55, 48, 163)      # #3730a3
    
    # In maskable icons, the background covers the entire canvas (square),
    # while in standard icons, it has rounded corners.
    radius = 0 if is_maskable else int(canvas_size * 0.22)
    
    # Create background mask with rounded rectangle
    bg_mask = Image.new("L", (canvas_size, canvas_size), 0)
    bg_mask_draw = ImageDraw.Draw(bg_mask)
    if is_maskable:
        bg_mask_draw.rectangle([0, 0, canvas_size, canvas_size], fill=255)
    else:
        bg_mask_draw.rounded_rectangle([0, 0, canvas_size, canvas_size], radius=radius, fill=255)

    # Draw vertical linear gradient
    bg_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_img)
    for y in range(canvas_size):
        factor = y / float(canvas_size)
        r = int(c_top[0] + factor * (c_bot[0] - c_top[0]))
        g = int(c_top[1] + factor * (c_bot[1] - c_top[1]))
        b = int(c_top[2] + factor * (c_bot[2] - c_top[2]))
        bg_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))

    img.paste(bg_img, (0, 0), bg_mask)
    draw = ImageDraw.Draw(img)

    # Scale factor for content
    # For maskable icons, keep content inside 75% safe area
    content_scale = 0.72 if is_maskable else 0.90
    offset_x = (canvas_size * (1 - content_scale)) / 2
    offset_y = (canvas_size * (1 - content_scale)) / 2

    def tx(x):
        return offset_x + (x / 512.0) * (canvas_size * content_scale)
    def ty(y):
        return offset_y + (y / 512.0) * (canvas_size * content_scale)

    # Document outline
    doc_x0, doc_y0 = tx(96), ty(80)
    doc_x1, doc_y1 = tx(416), ty(432)
    doc_r = int(24 * (canvas_size / 512.0) * content_scale)
    draw.rounded_rectangle([doc_x0, doc_y0, doc_x1, doc_y1], radius=doc_r, fill=(255, 255, 255, 20), outline=(255, 255, 255, 45), width=max(2, int(6 * scale * content_scale)))

    # Document text lines
    line_w = max(2, int(10 * scale * content_scale))
    draw.line([(tx(144), ty(140)), (tx(260), ty(140))], fill=(255, 255, 255, 90), width=line_w)
    draw.line([(tx(144), ty(180)), (tx(368), ty(180))], fill=(255, 255, 255, 90), width=line_w)
    draw.line([(tx(144), ty(220)), (tx(320), ty(220))], fill=(255, 255, 255, 90), width=line_w)

    # Signature flourish path (Bézier sampling)
    def cubic_bezier(p0, p1, p2, p3, t):
        u = 1 - t
        return (
            u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        )

    curve_segments = [
        ((128, 350), (180, 330), (220, 280), (260, 220)),
        ((260, 220), (290, 170), (320, 190), (310, 260)),
        ((310, 260), (300, 330), (250, 370), (200, 370)),
        ((200, 370), (160, 370), (220, 340), (290, 320)),
        ((290, 320), (340, 305), (380, 325), (400, 340))
    ]

    sig_pts = []
    for seg in curve_segments:
        for step in range(25):
            t = step / 25.0
            pt = cubic_bezier(seg[0], seg[1], seg[2], seg[3], t)
            sig_pts.append((tx(pt[0]), ty(pt[1])))
    last_pt = curve_segments[-1][3]
    sig_pts.append((tx(last_pt[0]), ty(last_pt[1])))

    sig_w = max(3, int(18 * scale * content_scale))
    
    # Shadow for signature
    shadow_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_img)
    shadow_offset = int(8 * scale * content_scale)
    shadow_pts = [(p[0], p[1] + shadow_offset) for p in sig_pts]
    for i in range(len(shadow_pts) - 1):
        shadow_draw.line([shadow_pts[i], shadow_pts[i+1]], fill=(15, 23, 42, 100), width=sig_w + 4)
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=8))
    img.paste(shadow_img, (0, 0), shadow_img)

    # Draw vibrant signature with gradient tone
    for i in range(len(sig_pts) - 1):
        frac = i / float(len(sig_pts))
        r = int(56 + frac * (255 - 56))
        g = int(189 + frac * (255 - 189))
        b = int(248 + frac * (255 - 248))
        draw.line([sig_pts[i], sig_pts[i+1]], fill=(r, g, b, 255), width=sig_w)
        # Smooth joints
        draw.ellipse([sig_pts[i][0] - sig_w//2, sig_pts[i][1] - sig_w//2, sig_pts[i][0] + sig_w//2, sig_pts[i][1] + sig_w//2], fill=(r, g, b, 255))

    # Dot at end
    dot_x, dot_y = tx(410), ty(340)
    dot_r = max(2, int(10 * scale * content_scale))
    draw.ellipse([dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r], fill=(56, 189, 248, 255))

    # Downsample with Lanczos filter for ultra-crisp output
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

# Write SVG
svg_path = os.path.join(OUTPUT_DIR, "icon.svg")
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(SVG_CONTENT)
print("Saved SVG icon to", svg_path)

# Generate PNGs
draw_icon(512, is_maskable=False).save(os.path.join(OUTPUT_DIR, "icon-512.png"))
draw_icon(192, is_maskable=False).save(os.path.join(OUTPUT_DIR, "icon-192.png"))
draw_icon(512, is_maskable=True).save(os.path.join(OUTPUT_DIR, "icon-maskable-512.png"))
draw_icon(192, is_maskable=True).save(os.path.join(OUTPUT_DIR, "icon-maskable-192.png"))
draw_icon(180, is_maskable=False).save(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"))
draw_icon(64, is_maskable=False).save(os.path.join(OUTPUT_DIR, "favicon-64.png"))
draw_icon(32, is_maskable=False).save(os.path.join(OUTPUT_DIR, "favicon-32.png"))
print("All icons successfully generated in", OUTPUT_DIR)
