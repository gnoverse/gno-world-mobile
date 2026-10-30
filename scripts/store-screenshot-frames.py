"""Google Play phone screenshots: each raw emulator capture framed at 1080x1920 (9:16) under a caption.

Play refuses screenshots whose long side is more than twice the short side, and the emulator's 1080x2400 is 2.22.
Usage: python3 scripts/store-screenshot-frames.py <raw-dir> [out-dir]   (needs Pillow; macOS system fonts)
<raw-dir> holds the captures named in SHOTS (`adb exec-out screencap -p`). See docs/store/google-play-listing.md.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SHOTS = [
    ('home.png', 'phone-1-home.png', 'The GNOT price, who is here', 'and the chat, at a glance'),
    ('pools.png', 'phone-2-pools.png', 'Every live bubble', 'in your pocket'),
    ('pool.png', 'phone-3-pool.png', 'Follow each boop', 'and each clock'),
    ('chat.png', 'phone-4-chat.png', 'Chat with', 'the players'),
    ('session.png', 'phone-5-session.png', 'Your account key', 'stays on your computer'),
]
W, H = 1080, 1920
BG = (5, 7, 13)
GREEN = (61, 220, 132)
FG = (238, 238, 238)
FONT = '/System/Library/Fonts/HelveticaNeue.ttc'
TOP = 330  # caption band
RADIUS = 36

raw, out = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'docs/store/assets'
bold = ImageFont.truetype(FONT, 64, index=1)
for src, dst, line1, line2 in SHOTS:
    shot = Image.open(os.path.join(raw, src)).convert('RGB')
    h = H - TOP - 60
    w = round(shot.width * h / shot.height)
    shot = shot.resize((w, h), Image.LANCZOS)
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), RADIUS, fill=255)

    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    x = (W - w) // 2
    d.rounded_rectangle((x - 3, TOP - 3, x + w + 2, TOP + h + 2), RADIUS + 3, outline=(40, 46, 58), width=3)
    img.paste(shot, (x, TOP), mask)
    for i, (text, color) in enumerate([(line1, FG), (line2, GREEN)]):
        d.text(((W - d.textlength(text, font=bold)) / 2, 90 + i * 84), text, font=bold, fill=color)
    img.save(os.path.join(out, dst))
    print(dst, img.size, img.mode)
