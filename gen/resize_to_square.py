from PIL import Image
from math import floor
import os


for dirpath, dirnames, filenames in os.walk(os.path.join("img", "trainers-profile")):
    for file in filenames:
        imgPath = os.path.join(dirpath, file)

        img = Image.open(imgPath)
        n = max(img.width, img.height)
        if n == img.width and n == img.height:
            continue
        dx = floor((n - img.width) / 2)
        dy = floor((n - img.height) / 2)
        result = Image.new("RGBA", (n, n), (0,0,0,0))
        result.paste(img, (dx, dy))
        result.save(imgPath, optimize=True, lossless=True)
