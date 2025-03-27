from PIL import Image
import argparse


def main():
    parser = argparse.ArgumentParser(description="Reorder rows/cols in a PNG file.")
    parser.add_argument("input_file", help="Path to the input PNG file")
    parser.add_argument("order", help="Comma-separated list of row indices to reorder")
    parser.add_argument("--column", action="store_true", help="Enable column mode")

    args = parser.parse_args()

    rows = [int(r) for r in args.order.split(",")]
    if [False for a,b in zip(sorted(rows), range(len(rows))) if a != b]:
        print("Row indices out of bounds.")
        return

    img = Image.open(args.input_file)
    if img.getbands() != ('R', 'G', 'B', 'A'):
        img = img.convert("RGBA")
    width = img.width
    height = img.height

    if args.column:
        # check if the image width is divisible by the columns
        if width % len(rows) != 0:
            print("Image width is not divisible by the number of columns.")
            return

        result = Image.new("RGBA", (width, height), (0,0,0,0))

        for i, row in enumerate(rows):
            row_width = width // len(rows)
            x_start = i * row_width
            x_end = x_start + row_width
            row_img = img.crop((x_start, 0, x_end, height))
            result.paste(row_img, (row * row_width, 0))
        
        result = result.convert("P", palette=Image.ADAPTIVE)
        result.save(args.input_file, optimize=True, lossless=True)
    else:
        # check if the image height is divisible by the rows
        if height % len(rows) != 0:
            print("Image height is not divisible by the number of rows.")
            return

        result = Image.new("RGBA", (width, height), (0,0,0,0))

        for i, row in enumerate(rows):
            row_height = height // len(rows)
            y_start = i * row_height
            y_end = y_start + row_height
            row_img = img.crop((0, y_start, width, y_end))
            result.paste(row_img, (0, row * row_height))

        result = result.convert("P", palette=Image.ADAPTIVE)
        result.save(args.input_file, optimize=True, lossless=True)




if __name__ == "__main__":
    main()