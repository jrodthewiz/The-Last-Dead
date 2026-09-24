"""Compose Blender-rendered rig frames into raw atlases and labeled review sheets."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for path in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    root = Path(args.source_root)
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    families = ("ward-attendant", "choir-penitent", "lantern-husk")
    overview = []
    for slug in families:
        report_path = root / slug / "motions.json"
        if not report_path.exists():
            continue
        report = json.loads(report_path.read_text(encoding="utf8"))
        frames = [Image.open(root / slug / "frames" / item["file"]).convert("RGB")
                  for item in report["samples"]]
        if len(frames) != 10:
            raise ValueError("Expected ten distinct action samples for " + slug)
        width, height = frames[0].size
        atlas = Image.new("RGB", (width * 5, height * 2), (16, 18, 22))
        labeled = Image.new("RGB", (width * 5, (height + 54) * 2 + 62), (18, 20, 25))
        draw = ImageDraw.Draw(labeled)
        draw.text((20, 13), slug.replace("-", " ").upper(), font=font(32),
                  fill=(230, 221, 205))
        metadata = []
        for index, (frame, sample) in enumerate(zip(frames, report["samples"])):
            col, row = index % 5, index // 5
            atlas.paste(frame, (col * width, row * height))
            y = 62 + row * (height + 54)
            labeled.paste(frame, (col * width, y))
            draw.text((col * width + 12, y + height + 10),
                      "%s  /  %02d" % (sample["kind"].upper(), sample["frame"]),
                      font=font(20), fill=(218, 211, 201))
            metadata.append({"index": index, "x": col * width, "y": row * height,
                             "width": width, "height": height, **sample})
        atlas_path = output / (slug + "-motion-spritesheet.png")
        review_path = output / (slug + "-motion-review.png")
        atlas.save(atlas_path, optimize=True)
        labeled.save(review_path, optimize=True)
        (output / (slug + "-motion-spritesheet.json")).write_text(
            json.dumps({"character": slug, "image": atlas_path.name,
                        "clips": report["clips"], "frames": metadata}, indent=2) + "\n",
            encoding="utf8",
        )
        overview.append({"character": slug, "atlas": str(atlas_path),
                         "review": str(review_path), "frames": len(metadata)})
    print(json.dumps(overview, indent=2))


if __name__ == "__main__":
    main()
