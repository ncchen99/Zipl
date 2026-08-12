#!/usr/bin/env python3
"""
zipl PWA & Cross-Platform Icon Generator
Generates:
  - Maskable Icons (Android Material Design standard, 80% Safe Zone, 512x512, 192x192)
  - Standard Any Icons (512x512, 192x192)
  - Apple Touch Icon (iOS 180x180)
  - Desktop Favicons (96x96, 48x48, 32x32, 16x16, ICO)
"""
import os
import subprocess
import shutil
import tempfile
import struct

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "public", "assets", "icons")
FAVICON_DIR = os.path.join(BASE_DIR, "public")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Brand Color Tokens
BG_COLOR = "#0f766e" # Brand Teal
ICON_COLOR = "#ffffff" # White

# SVG Templates

# 1. Maskable Icon (Full square background fill, logo inside 60%-70% safe zone circle)
SVG_MASKABLE = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="{BG_COLOR}"/>
  <g transform="translate(112, 112) scale(9)" fill="none" stroke="{ICON_COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.5 19.5 19.5 12.5"/>
    <path d="M14.6 9.2 16.4 7.4a5 5 0 0 1 7.2 7.2l-1.8 1.8"/>
    <path d="M17.4 22.8 15.6 24.6a5 5 0 0 1-7.2-7.2l1.8-1.8"/>
  </g>
</svg>
"""

# 2. Standard Any Icon (Full background fill with rounded corners for PWA launcher/switchers)
SVG_ANY = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="102" fill="{BG_COLOR}"/>
  <g transform="translate(96, 96) scale(10)" fill="none" stroke="{ICON_COLOR}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.5 19.5 19.5 12.5"/>
    <path d="M14.6 9.2 16.4 7.4a5 5 0 0 1 7.2 7.2l-1.8 1.8"/>
    <path d="M17.4 22.8 15.6 24.6a5 5 0 0 1-7.2-7.2l1.8-1.8"/>
  </g>
</svg>
"""

# 3. Apple Touch Icon (Solid square fill, 180x180 canvas ratio)
SVG_APPLE = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <rect width="180" height="180" fill="{BG_COLOR}"/>
  <g transform="translate(34, 34) scale(3.5)" fill="none" stroke="{ICON_COLOR}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.5 19.5 19.5 12.5"/>
    <path d="M14.6 9.2 16.4 7.4a5 5 0 0 1 7.2 7.2l-1.8 1.8"/>
    <path d="M17.4 22.8 15.6 24.6a5 5 0 0 1-7.2-7.2l1.8-1.8"/>
  </g>
</svg>
"""

# 4. Favicon PNG (Square rounded icon, clean tab display)
SVG_FAVICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="{BG_COLOR}"/>
  <g transform="translate(80, 80) scale(11)" fill="none" stroke="{ICON_COLOR}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.5 19.5 19.5 12.5"/>
    <path d="M14.6 9.2 16.4 7.4a5 5 0 0 1 7.2 7.2l-1.8 1.8"/>
    <path d="M17.4 22.8 15.6 24.6a5 5 0 0 1-7.2-7.2l1.8-1.8"/>
  </g>
</svg>
"""

def render_svg_to_png(svg_content, out_png_path, size):
    """Renders SVG to crisp PNG at specified pixel size using qlmanage and sips."""
    with tempfile.TemporaryDirectory() as tmpdir:
        svg_file = os.path.join(tmpdir, "icon.svg")
        with open(svg_file, "w", encoding="utf-8") as f:
            f.write(svg_content)
        
        # QuickLook thumbnail generation
        subprocess.run(["qlmanage", "-t", "-s", str(max(size, 512)), "-o", tmpdir, svg_file],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        rendered_png = os.path.join(tmpdir, "icon.svg.png")
        if not os.path.exists(rendered_png):
            raise RuntimeError("qlmanage failed to generate PNG")
        
        # Resize cleanly using sips
        subprocess.run(["sips", "-z", str(size), str(size), rendered_png, "--out", out_png_path],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

def make_ico(png_32_path, out_ico_path):
    """Creates a basic valid ICO file wrapping a PNG icon."""
    with open(png_32_path, "rb") as f:
        png_data = f.read()
    
    header = struct.pack("<HHH", 0, 1, 1) # Reserved, Type (1=ICO), Count (1)
    # Width, Height, Colors, Reserved, Planes, BPP, Size, Offset
    entry = struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png_data), 6 + 16)
    
    with open(out_ico_path, "wb") as f:
        f.write(header)
        f.write(entry)
        f.write(png_data)

def main():
    print("🎨 Generating zipl PWA & platform icons...")
    
    # 1. Android Material Design Maskable Icons
    print("  -> icon-maskable-512.png")
    render_svg_to_png(SVG_MASKABLE, os.path.join(OUTPUT_DIR, "icon-maskable-512.png"), 512)
    print("  -> icon-maskable-192.png")
    render_svg_to_png(SVG_MASKABLE, os.path.join(OUTPUT_DIR, "icon-maskable-192.png"), 192)
    
    # 2. Standard Any Icons
    print("  -> icon-512.png")
    render_svg_to_png(SVG_ANY, os.path.join(OUTPUT_DIR, "icon-512.png"), 512)
    print("  -> icon-192.png")
    render_svg_to_png(SVG_ANY, os.path.join(OUTPUT_DIR, "icon-192.png"), 192)
    
    # 3. Apple Touch Icon
    print("  -> apple-touch-icon.png")
    render_svg_to_png(SVG_APPLE, os.path.join(OUTPUT_DIR, "apple-touch-icon.png"), 180)
    # Also copy apple-touch-icon.png to public/assets/
    shutil.copy2(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"), os.path.join(BASE_DIR, "public", "assets", "apple-touch-icon.png"))
    
    # 4. Favicons
    print("  -> favicon-96x96.png")
    render_svg_to_png(SVG_FAVICON, os.path.join(OUTPUT_DIR, "favicon-96x96.png"), 96)
    print("  -> favicon-32x32.png")
    render_svg_to_png(SVG_FAVICON, os.path.join(OUTPUT_DIR, "favicon-32x32.png"), 32)
    print("  -> favicon-16x16.png")
    render_svg_to_png(SVG_FAVICON, os.path.join(OUTPUT_DIR, "favicon-16x16.png"), 16)
    
    # Copy favicon-96x96.png to public/assets/
    shutil.copy2(os.path.join(OUTPUT_DIR, "favicon-96x96.png"), os.path.join(BASE_DIR, "public", "assets", "favicon-96x96.png"))
    
    # 5. Create favicon.ico
    ico_path = os.path.join(FAVICON_DIR, "favicon.ico")
    make_ico(os.path.join(OUTPUT_DIR, "favicon-32x32.png"), ico_path)
    print("  -> favicon.ico")
    
    print("✨ All icons successfully generated!")

if __name__ == "__main__":
    main()
