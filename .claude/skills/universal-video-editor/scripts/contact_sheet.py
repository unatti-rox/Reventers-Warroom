#!/usr/bin/env python3
"""Tile frames into a labelled contact-sheet image.

Usage:
  contact_sheet.py f1.jpg f2.jpg ... --out option1.jpg [--cols 4] [--cell 480]
                   [--title "Option 1 - Architecture Led"] [--labels "01 0:00 Hook" "02 0:02 ..."]
                   [--conceptual 3,5]   # 1-based frame numbers to mark CONCEPTUAL VISUALISATION

Requires Pillow (pip install pillow). Frames keep their aspect ratio inside each cell.
"""
import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("error: Pillow not installed (pip install pillow)")


def font(size):
    for name in ("DejaVuSans.ttf", "Arial.ttf", "Helvetica.ttc"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--cell", type=int, default=480, help="cell width in px")
    ap.add_argument("--title", default="")
    ap.add_argument("--labels", nargs="*", default=[])
    ap.add_argument("--conceptual", default="", help="comma-separated 1-based frame numbers")
    args = ap.parse_args()

    imgs = [Image.open(p).convert("RGB") for p in args.images]
    conceptual = {int(x) for x in args.conceptual.split(",") if x.strip()}
    # Cell height follows the tallest aspect ratio so portrait and landscape both fit.
    max_ratio = max(i.height / i.width for i in imgs)
    cw, ch = args.cell, int(args.cell * max_ratio)
    pad, label_h = 16, 44
    title_h = 64 if args.title else 0
    cols = min(args.cols, len(imgs))
    rows = -(-len(imgs) // cols)
    W = cols * cw + (cols + 1) * pad
    H = title_h + rows * (ch + label_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (W, H), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    if args.title:
        d.text((pad, 18), args.title, fill=(240, 240, 240), font=font(30))
    lf, cf = font(18), font(16)

    for n, im in enumerate(imgs):
        r, c = divmod(n, cols)
        x = pad + c * (cw + pad)
        y = title_h + pad + r * (ch + label_h + pad)
        im.thumbnail((cw, ch))
        sheet.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
        if n + 1 in conceptual:
            d.rectangle([x, y, x + cw - 1, y + ch - 1], outline=(255, 180, 0), width=4)
            d.rectangle([x, y, x + 300, y + 26], fill=(255, 180, 0))
            d.text((x + 6, y + 4), "CONCEPTUAL VISUALISATION", fill=(0, 0, 0), font=cf)
        label = args.labels[n] if n < len(args.labels) else f"{n + 1:02d}  {Path(args.images[n]).name}"
        d.text((x, y + ch + 10), label, fill=(210, 210, 210), font=lf)

    sheet.save(args.out, quality=90)
    print(f"wrote {args.out} ({W}x{H}, {len(imgs)} frames)")


if __name__ == "__main__":
    main()
