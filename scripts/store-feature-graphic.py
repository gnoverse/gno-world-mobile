"""Google Play feature graphic (1024x500, opaque PNG) from the official gno.world artwork.

Usage: python3 scripts/store-feature-graphic.py [out.png]   (needs Pillow; fonts are macOS system fonts)
See docs/store/google-play-listing.md.
"""
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1024, 500
BG = (5, 7, 13)  # the artwork's space
GREEN = (61, 220, 132)  # the artwork's ring
FG = (238, 238, 238)
MUTED = (150, 158, 172)
FONT = '/System/Library/Fonts/HelveticaNeue.ttc'

out = sys.argv[1] if len(sys.argv) > 1 else 'docs/store/assets/feature-graphic.png'
art = Image.open('assets/brand/gno-bubble-1280.png').convert('RGB')

img = Image.new('RGB', (W, H), BG)

# the globe, cut out of its square with a soft green glow behind it
size = 420
globe = art.resize((size, size), Image.LANCZOS)
mask = Image.new('L', (size, size), 0)
ImageDraw.Draw(mask).ellipse((size * 0.085, size * 0.085, size * 0.915, size * 0.915), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(2))
gx, gy = 70, (H - size) // 2
glow = Image.new('RGB', (W, H), BG)
ImageDraw.Draw(glow).ellipse((gx + 20, gy + 20, gx + size - 20, gy + size - 20), fill=(20, 90, 55))
img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(40)), 0.8)
img.paste(globe, (gx, gy), mask)

# a few stars on the text side, fixed so the graphic is reproducible
d = ImageDraw.Draw(img)
for x, y in [(560, 60), (700, 420), (880, 90), (980, 300), (620, 380), (940, 450), (800, 40), (530, 250)]:
    d.ellipse((x, y, x + 2, y + 2), fill=(200, 205, 215))

title = ImageFont.truetype(FONT, 84, index=1)  # bold
sub = ImageFont.truetype(FONT, 30, index=0)
x = 540
d.text((x, 158), 'gno', font=title, fill=FG)
d.text((x + d.textlength('gno', font=title), 158), '.world', font=title, fill=GREEN)
d.text((x + 4, 270), 'Bubbles, boops and chat', font=sub, fill=FG)
d.text((x + 4, 312), 'on gno.land, from your phone', font=sub, fill=MUTED)

img.save(out)
print(out, img.size, img.mode)
