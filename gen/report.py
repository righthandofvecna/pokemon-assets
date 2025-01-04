import os

found = set()
for dirpath, dirnames, filenames in os.walk(os.path.join("img", "pmd-overworld")):
    for filename in filenames:
        found.add(filename[:4])

print(len(found))