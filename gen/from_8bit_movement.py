import os
import sys
from PIL import Image





def main():
    # Check if the user provided a folder path as an argument
    if len(sys.argv) < 2:
        print("Usage: python script.py <folder_path>")
        sys.exit(1)
    
    # Get the folder path from the command line arguments
    folder_path = sys.argv[1]
    
    # Validate the folder path
    if not os.path.isdir(folder_path):
        print(f"Error: '{folder_path}' is not a valid directory.")
        sys.exit(1)
    
    print(f"Successfully received folder path: {folder_path}")

    # grab all the filenames for the spritesheets
    files = set()
    for dirpath, dirnames, filenames in os.walk(folder_path):
        for filename in filenames:
            if not filename.endswith(".png"):
                continue
            files.add(os.path.join(dirpath, filename[:-6]))
    
    for imgname in files:
        try:
            imgs = {}
            size = 1
            for l in "ABDEFHIJLMNP":
                imgs[l] = Image.open(f"{imgname}_{l}.png")
                size = max(size, imgs[l].width, imgs[l].width)
            ni = Image.new(mode="RGBA", size=(size*3, size*4))
            size2 = size*2
            size3 = size*3
            ni.paste(imgs["A"], (0,     0))
            ni.paste(imgs["B"], (size,  0))
            ni.paste(imgs["D"], (size2, 0))
            ni.paste(imgs["M"], (0,     size))
            ni.paste(imgs["N"], (size,  size))
            ni.paste(imgs["P"], (size2, size))
            ni.paste(imgs["I"], (0,     size2))
            ni.paste(imgs["J"], (size,  size2))
            ni.paste(imgs["L"], (size2, size2))
            ni.paste(imgs["E"], (0,     size3))
            ni.paste(imgs["F"], (size,  size3))
            ni.paste(imgs["H"], (size2, size3))
            ni = ni.convert("P", palette=Image.ADAPTIVE)
            ni.save(imgname+"_sheet.png", optimize=True, lossless=True)
        except Exception as e:
            print("failed image", imgname, e)
    


if __name__ == "__main__":
    main()