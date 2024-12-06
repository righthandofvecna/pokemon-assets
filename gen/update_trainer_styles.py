
import os
import json

SPRITESHEET_SETTINGS_JS = os.path.join("data", "spritesheetmap.js")

def main():
    with open(SPRITESHEET_SETTINGS_JS, "r") as ssjs:
        ssjs.readline()
        spritesheetSettings = json.load(ssjs)
    
    for k,v in spritesheetSettings.items():
        if k.startswith("modules/pokemon-assets/img/trainers-overworld/") and "_pe_" in k:
            v["scale"] = 1.5
            v["anchor"] = 0.65
    
    with open(SPRITESHEET_SETTINGS_JS, "w") as ssJ:
        ssJ.write("export default\n")
        json.dump(spritesheetSettings, ssJ, indent=2, sort_keys=True)


if __name__ == "__main__":
    main()