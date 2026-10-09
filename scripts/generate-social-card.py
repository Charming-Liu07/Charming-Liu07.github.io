"""Regenerate the checked-in brand card with Pillow and Windows system fonts."""

from pathlib import Path
import os

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONTS = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
PAPER = "#fefefe"
INK = "#1e1e1e"
PINK = "#f386a1"
MUTED = "#626262"


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


image = Image.new("RGB", (1200, 630), PAPER)
draw = ImageDraw.Draw(image)
mono = font("consola.ttf", 21)
small = font("consola.ttf", 18)
wordmark = font("arialbd.ttf", 96)
chinese = font("msyh.ttc", 29)

draw.rectangle((26, 26, 1173, 603), outline=INK, width=2)
draw.line((64, 123, 1136, 123), fill=INK, width=2)
draw.rectangle((65, 65, 108, 108), fill=INK)
draw.text((71, 72), "C_", font=mono, fill=PINK)
draw.text((132, 76), "CHARMING / PERSONAL BLOG", font=mono, fill=INK)
draw.text((1040, 76), "[ 01 ]", font=mono, fill=MUTED)

draw.text((64, 200), "Charming", font=wordmark, fill=INK)
draw.rectangle((69, 322, 167, 330), fill=PINK)
draw.text((66, 356), "写下来，留给以后。", font=chinese, fill=INK)
draw.text((68, 419), "情感 · AI · 编程 · 资源", font=font("msyh.ttc", 22), fill=MUTED)

draw.rectangle((762, 171, 1138, 485), fill=INK)
draw.rectangle((750, 159, 1126, 473), fill=INK)
draw.rectangle((750, 159, 1126, 210), fill=PINK, outline=INK, width=2)
for x in (774, 796, 818):
    draw.rectangle((x, 181, x + 8, 189), fill=INK)
draw.text((971, 174), "hello.txt", font=small, fill=INK)

pixel_c = ("01111", "11000", "11000", "11000", "11000", "11000", "01111")
unit = 18
for row, cells in enumerate(pixel_c):
    for column, cell in enumerate(cells):
        if cell == "1":
            x, y = 814 + column * unit, 260 + row * unit
            draw.rectangle((x, y, x + unit - 2, y + unit - 2), fill=PINK)
draw.rectangle((937, 368, 1025, 384), fill=PINK)
draw.text((814, 424), "> keep writing_", font=small, fill=PAPER)

draw.line((64, 527, 1136, 527), fill=INK, width=2)
draw.text((66, 553), "charming-liu07.github.io", font=mono, fill=INK)
draw.text((906, 553), "ANOTHER PAGE.", font=small, fill=MUTED)

image.save(ROOT / "public/images/social-card.png", optimize=True)
