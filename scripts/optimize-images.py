"""Generate responsive WebP (+ one JPEG fallback) from the source PNGs.

Sources live in assets/gallery/source/ and are never shipped; the site only
references the derivatives written next to them in assets/gallery/.
Re-runnable: existing derivatives are overwritten.
"""
import os
import sys
from PIL import Image

GALLERY = sys.argv[1] if len(sys.argv) > 1 else "assets/gallery"
SOURCE = os.path.join(GALLERY, "source")
CANDIDATE_WIDTHS = [480, 800, 1280, 1600]
WEBP_QUALITY = 78
JPEG_QUALITY = 82

total_src = 0
total_out = 0

for name in sorted(os.listdir(SOURCE)):
    if not name.lower().endswith(".png"):
        continue

    path = os.path.join(SOURCE, name)
    stem = os.path.splitext(name)[0]
    total_src += os.path.getsize(path)

    with Image.open(path) as im:
        im = im.convert("RGB")
        src_w, src_h = im.size

        widths = [w for w in CANDIDATE_WIDTHS if w < src_w]
        widths.append(min(src_w, CANDIDATE_WIDTHS[-1]))
        widths = sorted(set(widths))

        made = []
        for w in widths:
            h = round(src_h * w / src_w)
            resized = im.resize((w, h), Image.LANCZOS)
            out = os.path.join(GALLERY, f"{stem}-{w}.webp")
            resized.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
            total_out += os.path.getsize(out)
            made.append(f"{w}w")

        fallback_w = min(1280, src_w)
        h = round(src_h * fallback_w / src_w)
        out = os.path.join(GALLERY, f"{stem}-{fallback_w}.jpg")
        im.resize((fallback_w, h), Image.LANCZOS).save(
            out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True
        )
        total_out += os.path.getsize(out)

    print(f"{stem:30s} {src_w}x{src_h} -> {', '.join(made)} + {fallback_w}w jpg")

print(f"\nsource: {total_src/1048576:.1f} MB -> derivatives: {total_out/1048576:.1f} MB")
