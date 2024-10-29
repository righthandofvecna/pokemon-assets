
import json
import os

SPRITESHEET_SETTINGS_JS = os.path.join("data", "spritesheetmap.js")



with open(SPRITESHEET_SETTINGS_JS, "r") as ssjs:
    ssjs.readline()
    spritesheetSettings = json.load(ssjs)

for dirpath, dirnames, filenames in os.walk(os.path.join("img", "trainers-overworld")):
    foundryPath = "/".join(("modules", "pokemon-assets", *dirpath.split(os.path.sep), ))
    for file in filenames:
        if f"{foundryPath}/{file}" in spritesheetSettings:
            continue
        spritesheetSettings[f"{foundryPath}/{file}"] = {
            "sheetstyle": "trainer",
            "animationframes": 4,
        }

with open(SPRITESHEET_SETTINGS_JS, "w") as ssJ:
    ssJ.write("export default\n")
    json.dump(spritesheetSettings, ssJ, indent=2, sort_keys=True)