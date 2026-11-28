"""Generate public/topo.svg: faint topographic contour lines used as the page texture.

Contours are wobbly rings around a few summits, so the tile reads like a real map
rather than a pattern. Deterministic (fixed seed). Run: python scripts/gen_topo.py
"""

import math
import random
from pathlib import Path

W = H = 900
rng = random.Random(8849)
summits = [(180, 220, 11), (640, 160, 8), (470, 600, 13), (820, 720, 6), (90, 760, 7)]
paths = []
for cx, cy, rings in summits:
    phase = [rng.uniform(0, 2 * math.pi) for _ in range(4)]
    amp = [rng.uniform(0.04, 0.12) for _ in range(4)]
    for k in range(1, rings + 1):
        r = 16 * k + rng.uniform(-3, 3)
        pts = []
        for i in range(73):
            t = 2 * math.pi * i / 72
            wob = 1 + sum(a * math.sin((j + 2) * t + p + k * 0.15) for j, (a, p) in enumerate(zip(amp, phase)))
            pts.append((cx + r * wob * math.cos(t), cy + r * wob * 0.82 * math.sin(t)))
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"
        heavy = k % 5 == 0  # index contour, like on real maps
        paths.append(f'<path d="{d}" stroke-width="{1.1 if heavy else 0.6}" opacity="{0.09 if heavy else 0.055}"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
       f'fill="none" stroke="#e8eef5">' + "".join(paths) + "</svg>")
out = Path(__file__).resolve().parent.parent / "public" / "topo.svg"
out.write_text(svg)
print(out, len(svg) // 1024, "KB")
