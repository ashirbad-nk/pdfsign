#!/usr/bin/env python3
import os
import subprocess
import tempfile
from PIL import Image, ImageDraw

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Exact brand-mark SVG matching .brand-mark with Lucide PenLine (18px in 32px box, rx=9px in 32px)
# 9 / 32 * 512 = 144
# PenLine paths in 24x24 box:
# d="M13 21h8"
# d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
# Stroke = 2.2 * 12 = 26.4
SVG_STANDARD = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="brandGrad" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="144" fill="url(#brandGrad)"/>
  <g transform="translate(112, 112) scale(12)" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 21h8"/>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
  </g>
</svg>'''

SVG_MASKABLE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="brandGrad" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#brandGrad)"/>
  <g transform="translate(136, 136) scale(10)" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 21h8"/>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
  </g>
</svg>'''

def render_svg_to_png(svg_str, is_maskable=False):
    with tempfile.TemporaryDirectory() as tmpdir:
        html_file = os.path.join(tmpdir, "icon.html")
        png_file = os.path.join(tmpdir, "render.png")
        
        html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {{ margin: 0; padding: 0; overflow: hidden; width: 512px; height: 512px; }}
  svg {{ display: block; }}
</style>
</head>
<body>
{svg_str}
</body>
</html>'''
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(html)
            
        cmd = [
            "firefox",
            "--headless",
            "--screenshot",
            png_file,
            "--window-size=512,512",
            f"file://{html_file}"
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        img = Image.open(png_file).convert("RGBA")
        
        # If not maskable, apply smooth antialiased rounded corner mask (rx=144)
        if not is_maskable:
            scale = 4
            big_mask = Image.new("L", (512 * scale, 512 * scale), 0)
            bdraw = ImageDraw.Draw(big_mask)
            bdraw.rounded_rectangle([0, 0, 512 * scale, 512 * scale], radius=144 * scale, fill=255)
            mask = big_mask.resize((512, 512), Image.Resampling.LANCZOS)
            img.putalpha(mask)
            
        return img

# Save SVG
svg_path = os.path.join(OUTPUT_DIR, "icon.svg")
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(SVG_STANDARD)
print("Saved SVG icon to", svg_path)

# Render master images
master_standard = render_svg_to_png(SVG_STANDARD, is_maskable=False)
master_maskable = render_svg_to_png(SVG_MASKABLE, is_maskable=True)

# Save standard icons
master_standard.save(os.path.join(OUTPUT_DIR, "icon-512.png"))
master_standard.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "icon-192.png"))
master_standard.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"))
master_standard.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "favicon-64.png"))
master_standard.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "favicon-32.png"))
master_standard.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "favicon-16.png"))

# Save maskable icons
master_maskable.save(os.path.join(OUTPUT_DIR, "icon-maskable-512.png"))
master_maskable.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "icon-maskable-192.png"))

print("All icons successfully generated in", OUTPUT_DIR)
