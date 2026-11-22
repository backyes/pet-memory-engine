#!/usr/bin/env python3
"""Generate app icons: a quiet pulse-loop mark on paper."""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "icons")
os.makedirs(OUT, exist_ok=True)

PAPER = (243, 239, 230)
INK = (27, 29, 24)
GREEN = (47, 93, 70)
WARM = (182, 90, 60)

def mark(size, bg=PAPER, transparent=False):
    scale = 4
    W = size * scale
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0) if transparent else bg + (255,))
    d = ImageDraw.Draw(img)
    c = W / 2
    # outer ring
    r1 = W * 0.33
    d.ellipse([c-r1, c-r1, c+r1, c+r1], outline=GREEN, width=max(2, int(W*0.016)))
    # inner ring
    r2 = W * 0.175
    d.ellipse([c-r2, c-r2, c+r2, c+r2], outline=INK, width=max(2, int(W*0.014)))
    # pulse spokes
    for dx, dy in [(0,-1),(0,1),(-1,0),(1,0)]:
        x1, y1 = c + dx*r1*1.06, c + dy*r1*1.06
        x2, y2 = c + dx*r1*1.30, c + dy*r1*1.30
        d.line([x1,y1,x2,y2], fill=GREEN, width=max(2, int(W*0.014)))
    # center dot
    r3 = W * 0.045
    d.ellipse([c-r3, c-r3, c+r3, c+r3], fill=WARM)
    return img.resize((size, size), Image.LANCZOS)

for sz in (512, 192, 180):
    img = mark(sz)
    name = "app-icon-512.png" if sz == 512 else "app-icon-192.png" if sz == 192 else "apple-touch-icon.png"
    img.save(os.path.join(OUT, name))
# transparent favicon source
mark(512, transparent=True).save(os.path.join(OUT, "favicon.png"))

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#f3efe6"/>
  <circle cx="32" cy="32" r="16" fill="none" stroke="#2f5d46" stroke-width="1.6" opacity=".8"/>
  <circle cx="32" cy="32" r="8.5" fill="none" stroke="#1b1d18" stroke-width="1.6"/>
  <path d="M32 10v5M32 49v5M10 32h5M49 32h5" stroke="#2f5d46" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="2.6" fill="#b65a3c"/>
</svg>'''
open(os.path.join(OUT, "favicon.svg"), "w").write(svg)
print("icons written")
