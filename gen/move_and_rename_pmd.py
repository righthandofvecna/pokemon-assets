
import os
import shutil

FOLDER_LOCATION = "<path>"

for dirpath, dirnames, filenames in os.walk(FOLDER_LOCATION):
    splitPath = dirpath.split(os.sep)[4::]
    if (len(splitPath) != 1):
        continue

    dexNumber = splitPath[0]

    animToGet = "Walk-Anim.png"
    if animToGet not in filenames:
        print("No", animToGet, "animation:", dexNumber)
        continue

    # make the 3-deep nested structure
    d3 = dexNumber[:-2] + "XX"
    d2 = dexNumber[:-1] + "X"
    fileName = f"{dexNumber}.png"
    newDirpath = os.path.join("img", "pmd-overworld", d3, d2)
    if not os.path.exists(newDirpath):
        os.makedirs(newDirpath)

    shutil.copy(os.path.join(dirpath, animToGet), os.path.join(newDirpath, fileName))

    print("Completed", fileName)

