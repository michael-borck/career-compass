#!/usr/bin/env python3
"""Career Compass app icon: editorial paper-and-ink compass rose, ochre north.
Emits a 1024x1024 SVG (macOS squircle with transparent margin)."""
import math

CX = CY = 512
INK = "#252420"
INK_SOFT = "#3B3830"
INK_MUTED = "#5C564C"
OCHRE = "#A86B47"
OCHRE_DEEP = "#855030"

def pt(angle_deg, r):
    a = math.radians(angle_deg - 90)  # 0 = north, clockwise
    return (CX + r * math.cos(a), CY + r * math.sin(a))

def kite(angle, tip_r, waist_r, half_w, dark, light):
    """Compass point as two shaded triangles (left dark, right light)."""
    tipx, tipy = pt(angle, tip_r)
    # waist points perpendicular to the point's axis
    ax = math.radians(angle - 90)
    px, py = math.cos(ax + math.pi / 2), math.sin(ax + math.pi / 2)
    wx, wy = pt(angle, waist_r)
    lx, ly = wx - px * half_w, wy - py * half_w
    rx, ry = wx + px * half_w, wy + py * half_w
    return (
        f'<polygon points="{tipx:.1f},{tipy:.1f} {lx:.1f},{ly:.1f} {CX},{CY}" fill="{dark}"/>'
        f'<polygon points="{tipx:.1f},{tipy:.1f} {rx:.1f},{ry:.1f} {CX},{CY}" fill="{light}"/>'
    )

parts = []
parts.append('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">')
parts.append("""
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FBF8F1"/>
    <stop offset="1" stop-color="#EDE7DA"/>
  </linearGradient>
  <linearGradient id="ochre" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#B5764F"/>
    <stop offset="1" stop-color="#855030"/>
  </linearGradient>
</defs>
""")
# macOS squircle (824px, 100px transparent margin)
parts.append(f'<rect x="100" y="100" width="824" height="824" rx="186" fill="url(#paper)"/>')
# letterpress-style double border
parts.append(f'<rect x="128" y="128" width="768" height="768" rx="160" fill="none" stroke="{INK}" stroke-opacity="0.16" stroke-width="4"/>')

# outer ring
parts.append(f'<circle cx="{CX}" cy="{CY}" r="300" fill="none" stroke="{INK}" stroke-width="18"/>')
# degree ticks every 15 deg (minor), longer at 45s
for a in range(0, 360, 15):
    if a % 90 == 0:
        continue
    long = a % 45 == 0
    r1 = 258 if long else 272
    x1, y1 = pt(a, r1)
    x2, y2 = pt(a, 288)
    w = 8 if long else 5
    parts.append(
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="{INK_MUTED}" stroke-width="{w}" stroke-linecap="round"/>'
    )

# intercardinal points (NE/SE/SW/NW), quiet
for a in (45, 135, 225, 315):
    parts.append(kite(a, 190, 60, 34, INK_MUTED, "#8A8377"))
# cardinal points E/S/W in ink
for a in (90, 180, 270):
    parts.append(kite(a, 282, 74, 46, INK, INK_SOFT))
# north point in ochre, slightly longer
parts.append(kite(0, 292, 74, 48, OCHRE_DEEP, OCHRE))

# center pivot
parts.append(f'<circle cx="{CX}" cy="{CY}" r="34" fill="{INK}"/>')
parts.append(f'<circle cx="{CX}" cy="{CY}" r="15" fill="#FBF8F1"/>')

parts.append("</svg>")

with open("icon.svg", "w") as f:
    f.write("".join(parts))
print("icon.svg written")
