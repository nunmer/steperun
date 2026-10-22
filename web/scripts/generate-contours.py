# Usage: python web/scripts/generate-contours.py web/public/textures/contours.svg
"""Seamless topographic contour tile (SVG) for the site background.

The field is a sum of cosines with integer frequencies on [0, 2π)², so it is
periodic and its contours meet across opposite edges: the tile repeats seamlessly.
Every fifth contour is an "index contour" drawn heavier, as on survey maps.
"""
import math
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

SIZE = 720          # tile size in px
N = 360             # grid resolution
rng = np.random.default_rng(7)

t = np.linspace(0, 2 * np.pi, N + 1)
X, Y = np.meshgrid(t, t)
Z = np.zeros_like(X)
# Broad rolling terrain plus a few smaller hills; amplitude falls with frequency.
for _ in range(14):
    m, n = rng.integers(-4, 5, size=2)
    if m == 0 and n == 0:
        continue
    k = math.hypot(m, n)
    Z += (1.0 / k ** 1.6) * np.cos(m * X + n * Y + rng.uniform(0, 2 * np.pi))

levels = np.linspace(Z.min(), Z.max(), 28)[1:-1]
cs = plt.contour(X, Y, Z, levels=levels)

scale = SIZE / (2 * np.pi)
paths = []
for i, segs in enumerate(cs.allsegs):
    heavy = i % 5 == 0
    for seg in segs:
        if len(seg) < 4:
            continue
        pts = np.vstack([seg[::4], seg[-1:]]) if len(seg) > 12 else seg
        d = "M" + " L".join(f"{x * scale:.0f} {y * scale:.0f}" for x, y in pts)
        paths.append((heavy, d))

light = "\n".join(f'<path d="{d}"/>' for heavy, d in paths if not heavy)
heavy = "\n".join(f'<path d="{d}"/>' for heavy, d in paths if heavy)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}" fill="none" stroke="#000" stroke-linejoin="round">
<g stroke-width="0.7">{light}</g>
<g stroke-width="1.4">{heavy}</g>
</svg>'''
open(sys.argv[1], "w", encoding="utf-8").write(svg)
print(len(paths), "paths,", len(svg) // 1024, "KB")
