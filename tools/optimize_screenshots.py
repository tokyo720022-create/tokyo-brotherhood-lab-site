#!/usr/bin/env python3
"""Optimise What's Next screenshots for the website gallery.

Usage:
    python3 tools/optimize_screenshots.py [SOURCE_DIR] [--out OUT_DIR]

For every PNG/JPG/WebP in SOURCE_DIR (default: screenshots-source/) this writes
  <name>.webp        full size, at most 1080 px wide
  <name>-thumb.webp  thumbnail, 440 px wide
into OUT_DIR (default: docs/assets/images/whats-next/screenshots/) and prints a
JSON entry to paste into docs/data/screenshots.json. The script never invents
titles, alt text or captions: you must write those yourself.

Requires Pillow:  pip install pillow
"""
import argparse
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("This tool needs Pillow:  pip install pillow")

FULL_MAX_WIDTH = 1080
THUMB_WIDTH = 440
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def resized(image, width):
    if image.width <= width:
        return image.copy()
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", nargs="?", default="screenshots-source")
    parser.add_argument("--out", default="docs/assets/images/whats-next/screenshots")
    args = parser.parse_args()

    source, out = Path(args.source), Path(args.out)
    if not source.is_dir():
        sys.exit("Source folder not found: %s (create it and put your screenshots inside)" % source)
    files = sorted(p for p in source.iterdir() if p.suffix.lower() in EXTENSIONS)
    if not files:
        sys.exit("No PNG/JPG/WebP files found in %s" % source)
    out.mkdir(parents=True, exist_ok=True)

    entries = []
    for path in files:
        name = path.stem.lower()
        if not NAME_RE.match(name):
            print("Skipping %s: use lowercase letters, digits and dashes (e.g. anime-list.png)" % path.name, file=sys.stderr)
            continue
        with Image.open(path) as raw:
            image = ImageOps.exif_transpose(raw).convert("RGB")
        if image.width < 600:
            print("Warning: %s is only %d px wide; it may look blurry." % (path.name, image.width), file=sys.stderr)

        full = resized(image, FULL_MAX_WIDTH)
        thumb = resized(image, THUMB_WIDTH)
        full.save(out / (name + ".webp"), "WEBP", quality=82, method=6)
        thumb.save(out / (name + "-thumb.webp"), "WEBP", quality=78, method=6)
        print("%-24s -> %s.webp (%dx%d, %d KB), %s-thumb.webp (%d KB)" % (
            path.name, name, full.width, full.height, (out / (name + ".webp")).stat().st_size // 1024,
            name, (out / (name + "-thumb.webp")).stat().st_size // 1024), file=sys.stderr)
        entries.append({
            "file": name + ".webp",
            "thumb": name + "-thumb.webp",
            "width": full.width,
            "height": full.height,
            "title": "",
            "alt": "",
            "caption": "",
        })

    print("\nPaste into docs/data/screenshots.json (fill in title, alt and caption; entries without alt are ignored):\n", file=sys.stderr)
    print(json.dumps(entries, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
