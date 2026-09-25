"""Build a labeled review sheet from headless Blender enemy frame renders."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', required=True)
    parser.add_argument('--frames-dir', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    report = json.loads(Path(args.report).read_text(encoding='utf8'))
    samples = report['samples']
    frames = [Image.open(Path(args.frames_dir) / row['file']).convert('RGB') for row in samples]
    width, height = frames[0].size
    cols = 4
    rows = (len(frames) + cols - 1) // cols
    label = 43
    sheet = Image.new('RGB', (cols * width, rows * (height + label)), (18, 19, 23))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 18)
    except OSError:
        font = ImageFont.load_default()
    for index, (frame, record) in enumerate(zip(frames, samples)):
        x = index % cols * width
        y = index // cols * (height + label)
        sheet.paste(frame, (x, y))
        title = (record.get('clip') or record.get('kind') or '').replace('TLD_', '')
        draw.text((x + 12, y + height + 9), '%s / %02d' % (title.upper(), record['frame']),
                  font=font, fill=(225, 220, 210))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)
    print(json.dumps({'output': str(output), 'frames': len(frames), 'size': list(sheet.size)}))


if __name__ == '__main__':
    main()
