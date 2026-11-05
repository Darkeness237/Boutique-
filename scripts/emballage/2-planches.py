"""Planches de vérification : la photo candidate de chaque produit, numérotée, 48 par planche (8 x 6)."""
import json, sys, os, io, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

src, outdir, start, end = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
os.makedirs(outdir, exist_ok=True)
allrows = [json.loads(l) for l in open(src) if l.strip()]
rows = allrows[start:end]

T, COLS, ROWS = 160, 8, 6
font = ImageFont.load_default()

def thumb(url):
    try:
        data = urllib.request.urlopen(url, timeout=30).read()
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im.thumbnail((T, T))
        return im
    except Exception:
        return Image.new("RGB", (T, T), "red")

with ThreadPoolExecutor(8) as ex:
    thumbs = list(ex.map(lambda r: thumb(r["images"][r["best"]]) if r["best"] > 0 else Image.new("RGB", (T, T), "#ddd"), rows))

per = COLS * ROWS
for s in range(0, len(rows), per):
    sheet = Image.new("RGB", (COLS * T, ROWS * T), "white")
    d = ImageDraw.Draw(sheet)
    for k, im in enumerate(thumbs[s:s + per]):
        x, y = (k % COLS) * T, (k // COLS) * T
        sheet.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2))
        d.rectangle([x, y, x + 26, y + 14], fill="black")
        d.text((x + 2, y + 1), str(start + s + k), fill="yellow", font=font)
        d.rectangle([x, y, x + T - 1, y + T - 1], outline="#ccc")
    sheet.save(os.path.join(outdir, f"p{start + s:04d}.jpg"), quality=80)
print(len(rows), "candidats,", (len(rows) + per - 1) // per, "planches")
