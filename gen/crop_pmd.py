from PIL import Image
import os
import json

SPRITESHEET_SETTINGS_JS = os.path.join("data", "spritesheetmap.js")
with open(SPRITESHEET_SETTINGS_JS, "r") as ssjs:
    ssjs.readline()
    spritesheetSettings = json.load(ssjs)


toCheck = []

debug = False

gotThere = False
for dirpath, dirnames, filenames in os.walk(os.path.join("img", "pmd-overworld")):
    for file in filenames:
        imgPath = os.path.join(dirpath, file)
        if not gotThere and imgPath[imgPath.rindex("\\")+1:] != "0000.png":
            continue
        gotThere = True

        sss = spritesheetSettings["/".join(["modules", "pokemon-assets", *imgPath.split(os.path.sep)])]
        animationFrames = sss['animationframes']

        img = Image.open(imgPath)
        palleteized = img.getbands() == ('P', )
        if img.getbands() != ('R', 'G', 'B', 'A'):
            print(imgPath, img.getbands())
            img = img.convert("RGBA")
        width = img.width
        height = img.height
        frameWidth = int(width / animationFrames)
        frameHeight = int(height / 8)

        if frameWidth * animationFrames != width:
            print(f"{file}'s settings require attention! {frameWidth=} * {animationFrames=} ({frameWidth * animationFrames} != {width=})")
            exit(1)

        px = img.load()

        # check horizontal croppability
        for horizontalPadding in range(int(frameWidth / 2)):
            sweepClear = True
            for frame in range(animationFrames):
                frameLeftX = frame*frameWidth + horizontalPadding
                frameRightX = (frame + 1)*frameWidth - horizontalPadding - 1
                for verticalSweep in range(height):
                    try:
                        sweepClear = sweepClear and px[frameLeftX, verticalSweep][3] == 0 and px[frameRightX, verticalSweep][3] == 0
                    except Exception as e:
                        print(e, px, img, px[frameLeftX, verticalSweep], px[frameRightX, verticalSweep])
                        exit(1)
                    if not sweepClear:
                        break
                if not sweepClear:
                    break
            if not sweepClear:
                break

        # check top croppability
        for topPadding in range(int(frameHeight / 2)):
            sweepClear = True
            for row in range(8):
                rowTop = row * frameHeight + topPadding
                for horizontalSweep in range(width):
                    sweepClear = sweepClear and px[horizontalSweep, rowTop][3] == 0
                    if not sweepClear:
                        break
                if not sweepClear:
                    break
            if not sweepClear:
                break

        # check bottom croppability
        for bottomPadding in range(int(frameHeight / 2)):
            sweepClear = True
            for row in range(8):
                rowBottom = (row + 1) * frameHeight - bottomPadding - 1
                for horizontalSweep in range(width):
                    sweepClear = sweepClear and px[horizontalSweep, rowBottom][3] == 0
                    if not sweepClear:
                        break
                if not sweepClear:
                    break
            if not sweepClear:
                break

        # horizontalPadding = horizontalPadding - 1
        # topPadding = topPadding - 1
        # bottomPadding = bottomPadding - 1
        print(file, "horizontalPadding", horizontalPadding, "topPadding",  topPadding, "bottomPadding",  bottomPadding)

        newFrameWidth = frameWidth + 2 - (horizontalPadding * 2)
        newFrameHeight = frameHeight + 2 - (topPadding + bottomPadding)

        newImgWidth = newFrameWidth * animationFrames
        newImgHeight = newFrameHeight * 8

        if newImgWidth == width and newImgHeight == height and palleteized:
            continue

        if debug:
            print(f"{file} :: {newImgWidth=} {width=} \t {newImgHeight=} {height=} \t {palleteized=}")
            print(f"{newFrameWidth=} x {newFrameHeight=}")
            print(f"{(frameWidth - max(0, horizontalPadding) - 1) - (max(0, horizontalPadding))=}")
            # paint the failed sweeps magenta
            for frame in range(animationFrames):
                frameLeftX = frame*frameWidth + horizontalPadding
                frameRightX = (frame + 1)*frameWidth - horizontalPadding - 1
                for verticalSweep in range(height):
                    if px[frameLeftX, verticalSweep][3] != 255:
                        px[frameLeftX, verticalSweep] = (255, 0, 255, min(255, px[frameLeftX, verticalSweep][3]+80))
                    if px[frameRightX, verticalSweep][3] != 255:
                        px[frameRightX, verticalSweep] = (255, 0, 255, min(255, px[frameRightX, verticalSweep][3]+80))
            for row in range(8):
                rowTop = row * frameHeight + topPadding
                rowBottom = (row + 1) * frameHeight - bottomPadding - 1
                for horizontalSweep in range(width):
                    if px[horizontalSweep, rowTop][3] != 255:
                        px[horizontalSweep, rowTop] = (255, 0, 255, min(255, px[horizontalSweep, rowTop][3]+80))
                    if px[horizontalSweep, rowBottom][3] != 255:
                        px[horizontalSweep, rowBottom] = (255, 0, 255, min(255, px[horizontalSweep, rowBottom][3]+80))

        if horizontalPadding < 0 or topPadding < 0 or bottomPadding < 0:
            toCheck.append(file)

        result = Image.new("RGBA", (newImgWidth, newImgHeight), (0,0,0,0))
        for frame in range(animationFrames):
            for row in range(8):
                result.paste(img.crop((
                        frame * frameWidth + max(0, horizontalPadding),
                        row * frameHeight + max(0, topPadding),
                        (frame + 1) * frameWidth - max(0, horizontalPadding),
                        (row + 1) * frameHeight - max(0, bottomPadding),
                    )), (
                        frame * newFrameWidth + 1,
                        row * newFrameHeight + 1
                    ))

        result = result.convert("P")
        result.save(imgPath, optimize=True, lossless=True)


print("\n\n\nCheck All:\n")
print(toCheck)