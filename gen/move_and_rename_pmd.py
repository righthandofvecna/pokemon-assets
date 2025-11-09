
import json
import os
import shutil
import xml.etree.ElementTree as ET

# get local settings
with open("local.json", "r") as local:
    data = json.load(local)
    SPRITECOLLAB = data["SPRITECOLLAB"]
    UNFINISHED = data["UNFINISHED"]
    CREDITS_LOCATION = os.path.join(SPRITECOLLAB, "credit_names.txt")
    INFO_JSON_LOCATION = os.path.join(SPRITECOLLAB, "tracker.json")
    SC_FOLDER_LOCATION = os.path.join(SPRITECOLLAB, "sprite")
    UF_FOLDER_LOCATION = os.path.join(UNFINISHED)
SPRITESHEET_SETTINGS_JS = os.path.join("data", "spritesheetmap.js")



def safeGet(d, *k, default=None):
    cd = d
    for key in k:
        if key in cd:
            cd = cd[key]
        else:
            return default
    return cd

def getAnimFileFromFilesystem(*nests):
    # test for files
    for anim in ("Walk-Anim.png", "Charge-Anim.png", "Idle-Anim.png", ):
        path = os.path.join(SC_FOLDER_LOCATION, *nests, anim)
        if os.path.exists(path):
            return path
        # test for the "unfinished" versions
        path = os.path.join(UF_FOLDER_LOCATION, "sprite-" + "-".join(nests), anim)
        if os.path.exists(path):
            return path
    return None

registeredVariants = {}
def registerGlobalVariant(dexnumber, v):
    if v in registeredVariants:
        registeredVariants[v].append(dexnumber)
        return
    registeredVariants[v] = [dexnumber]

def unregisterGlobalVariant(dexnumber, v):
    if v not in registeredVariants or dexnumber not in registeredVariants[v]:
        print(f"can't remove {dexnumber=} from {v=}")
    else:
        registeredVariants[v].remove(dexnumber)


toSkip = set((
    "0000", # skip missingno, manually intervened
    "0050", # skip diglett, manually intervened
    "0051", # skip dugtrio, manually intervened
    "0705", # skip sliggoo, manually intervened
    "0960", # skip wiglett, manually intervened
    "0961", # skip wugtrio, manually intervened
))

def main():
    with open(INFO_JSON_LOCATION, "r") as iJ:
        data = json.load(iJ)

    with open(SPRITESHEET_SETTINGS_JS, "r") as ssjs:
        ssjs.readline()
        spritesheetSettings = json.load(ssjs)

    for dexnumber in data.keys():
        mainSprite = getAnimFileFromFilesystem(dexnumber)
        if dexnumber in toSkip:
            continue
        name = safeGet(data, dexnumber, "name", default="variant")   
        variants = {}
        def registerVariant(sprite, key):
            if sprite:
                variants[key] = sprite
                registerGlobalVariant(dexnumber, key)
        registerVariant(mainSprite, "")
        
        sgs1 = safeGet(data, dexnumber, "subgroups", default={})
        for sg1 in sgs1.keys():
            varSprite = getAnimFileFromFilesystem(dexnumber, sg1)
            name1 = safeGet(data, dexnumber, "subgroups", sg1, "name", default="")
            registerVariant(varSprite, name1)

            sgs2 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", default={})
            for sg2 in sgs2.keys():
                name2 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", sg2, "name", default="") 
                varSprite2 = getAnimFileFromFilesystem(dexnumber, sg1, sg2)
                registerVariant(varSprite2, name1 + ":" + name2)
                 
                sgs3 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", sg2, "subgroups", default={})
                for sg3 in sgs3.keys():
                    name3 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", sg2, "subgroups", sg3, "name", default="") 
                    varSprite3 = getAnimFileFromFilesystem(dexnumber, sg1, sg2, sg3)
                    registerVariant(varSprite3, name1 + ":" + name2 + ":" + name3)
        
        # make the 3-deep nested structure
        d3 = dexnumber[:-2] + "XX"
        d2 = dexnumber[:-1] + "X"
        newDirpath = os.path.join("img", "pmd-overworld", d3, d2)
        if not os.path.exists(newDirpath):
            os.makedirs(newDirpath)

        toCopy = {}
        def _processSingleVariant(key, suffix):
            if key in variants:
                unregisterGlobalVariant(dexnumber, key)
                if variants[key]:
                    fileName = f"{dexnumber}{suffix}.png"
                    toCopy[fileName] = variants[key]
                    # load the sheet anim data
                    foundryPathA = "modules/pokemon-assets/img/pmd-overworld/"
                    foundryPathB = "/".join((d3, d2, fileName, ))

                    folder, file = os.path.split(variants[key])
                    metadataPath = os.path.join(folder, "AnimData.xml")
                    frames = 4
                    with open(metadataPath, "r") as mdF:
                        metadata = ET.parse(mdF)
                        root = metadata.getroot()
                        for anim in root.find("Anims"):
                            if anim.find("Name").text == file.replace("-Anim.png", ""):
                                frames = len(anim.find("Durations"))
                    pmdImages = spritesheetSettings[foundryPathA]["images"]
                    if foundryPathB not in pmdImages: # or pmdImages[foundryPathB]["animationframes"] != frames:
                        newPath = os.path.join(newDirpath, fileName)
                        if os.path.exists(newPath):
                            os.remove(newPath)
                        pmdImages[foundryPathB] = {
                            "animationframes": frames,
                        }
        def processVariant(key, suffix):
            _processSingleVariant(key, suffix)
            _processSingleVariant(f"{key}::Male", f"m{suffix}")
            _processSingleVariant(f"{key}::Female", f"f{suffix}")
            _processSingleVariant(f"{key}:Shiny", f"s{suffix}")
            _processSingleVariant(f"{key}:Shiny:Male", f"ms{suffix}")
            _processSingleVariant(f"{key}:Shiny:Female", f"fs{suffix}")

        processVariant("", "")
        # regional variants
        processVariant("Alola", "_alolan")
        processVariant("Galar", "_galarian")
        processVariant("Hisui", "_hisuian")
        processVariant("Paldea", "_paldean")

        # special regional variants
        processVariant("Paldea_Aqua", "_paldean_aqua")

        # megas
        processVariant("Mega", "_MEGA")
        processVariant("Mega_X", "_MEGA_X")
        processVariant("Mega_Y", "_MEGA_Y")

        processVariant("Gigantamax", "_Gigantamax")

        # type formes
        for t in ("Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Poison", "Psychic", "Rock", "Steel", "Water"):
            processVariant(t, f"_{t}")
        processVariant("Question_Mark", "_Untyped")

        # special formes
        for t in (
            "Sky",
            "Origin",
            "Primal",
            "Speed",
            "Defense",
            "Attack",
            "Therian",
            "Aria",
            "Pirouette",
            "Unbound",
            "Eternal",
            "Ultra",
            "Hangry",
            "Hero",
            "Zen",
            "Crowned",
            "Crowned_Sword",
            "Neutral",
            "Original",
            "Noice",
            "Droopy",
            "Ultimate",
            "Lowkey",
            "Substitute",
            "Egg"
            ):
            processVariant(t, f"_{t}")
        
        # low-power as normal forme
        processVariant("Low_Power", "")

        # special formes (all caps)
        for t in ("Shadow", ):
            processVariant(t, f"_{t.upper()}")

        # rotom formes
        for t in ("Fan", "Frost", "Heat", "Mow", "Wash", "Drone"):
            processVariant(t, f"_{t}")

        # weather formes
        for t in ("Sunny", "Rainy", "Snowy", "Sunshine"):
            processVariant(t, f"_{t}")

        # seasonal formes
        for s in ("Summer", "Autumn", "Winter"):
            processVariant(s, f"_{s}")

        # daytime formes
        for s in ("Midnight", "Dusk", ):
            processVariant(s, f"_{s}")

        # color formes
        for t in ("Blue", "Red", "White", "Yellow", "Orange", "Green", "Indigo", "Violet", "Purple", "Brass", "Black" ):
            processVariant(t, f"_{t}")
        
        # spiky pichu
        processVariant("Spiky", f"_spiky")

        # unown formes
        for c in (*"ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Exclamation", "Question"):
            processVariant(c, f"_{c}")

        # wormadam formes
        for t in ("Trash", "Sand", ):
            processVariant(t, f"_{t}")
        
        # directional shellos formes
        processVariant("East", f"_East")
        processVariant("West", f"_West")

        # applin formes
        processVariant("No_Apple", "_NoApple")

        # genesect formes
        for t in ("Douse", "Shock", "Burn", "Chill", ):
            processVariant(t, f"_{t}")

        # vivillion formes
        for t in (
            "Icy_Snow",
            "Polar",
            "Tundra",
            "Continental",
            "Garden",
            "Elegant",
            "Archipelago",
            "High_Plains",
            "Modern",
            "Marine",
            "Sandstorm",
            "River",
            "Monsoon",
            "Savannah",
            "Sun",
            "Ocean",
            "Jungle",
            "Fancy",
            "Pokeball",
            ):
            # there are so many more than are implemented......
            # and there are already a lot
            processVariant(t, f"_{t.replace('_','')}")

        # froufrou haircut/outfit formes
        for t in ("Kabuki",):
            processVariant(t, f"_{t}")

        # aegislash formes
        processVariant("Blade", f"_Blade")

        # size formes
        for t in (
            "Small",
            "Large",
            "Super",
            ):
            processVariant(t, f"_{t}")

        # zygarde formes
        processVariant("Cell", "_Cell")
        processVariant("10", "_10%")
        processVariant("50", "_50%")
        processVariant("Complete", "_Complete")
        
        # wishiwashi formes
        processVariant("School", "_Schooling")

        # mimiku formes
        processVariant("Busted", "_Busted")


        processVariant("Pom_Pom", "_PomPom")
        processVariant("Trooper", "_Trooper")

        # alcremie formes
        for t in (
            "Berry_Sweet",
            "Love_Sweet",
            "Star_Sweet",
            "Clover_Sweet",
            "Flower_Sweet",
            "Ribbon_Sweet",
            "Ruby_Cream_Strawberry_Sweet",
            "Ruby_Cream_Berry_Sweet",
            "Ruby_Cream_Love_Sweet",
            "Ruby_Cream_Star_Sweet",
            "Ruby_Cream_Clover_Sweet",
            "Ruby_Cream_Flower_Sweet",
            "Ruby_Cream_Ribbon_Sweet",
            "Matcha_Cream_Strawberry_Sweet",
            "Matcha_Cream_Berry_Sweet",
            "Matcha_Cream_Love_Sweet",
            "Matcha_Cream_Star_Sweet",
            "Matcha_Cream_Clover_Sweet",
            "Matcha_Cream_Flower_Sweet",
            "Matcha_Cream_Ribbon_Sweet",
            "Mint_Cream_Strawberry_Sweet",
            "Mint_Cream_Berry_Sweet",
            "Mint_Cream_Love_Sweet",
            "Mint_Cream_Star_Sweet",
            "Mint_Cream_Clover_Sweet",
            "Mint_Cream_Flower_Sweet",
            "Mint_Cream_Ribbon_Sweet",
            "Lemon_Cream_Strawberry_Sweet",
            "Lemon_Cream_Berry_Sweet",
            "Lemon_Cream_Love_Sweet",
            "Lemon_Cream_Star_Sweet",
            "Lemon_Cream_Clover_Sweet",
            "Lemon_Cream_Flower_Sweet",
            "Lemon_Cream_Ribbon_Sweet",
            "Salted_Cream_Strawberry_Sweet",
            "Salted_Cream_Berry_Sweet",
            "Salted_Cream_Love_Sweet",
            "Salted_Cream_Star_Sweet",
            "Salted_Cream_Clover_Sweet",
            "Salted_Cream_Flower_Sweet",
            "Salted_Cream_Ribbon_Sweet",
            "Ruby_Swirl_Strawberry_Sweet",
            "Ruby_Swirl_Berry_Sweet",
            "Ruby_Swirl_Love_Sweet",
            "Ruby_Swirl_Star_Sweet",
            "Ruby_Swirl_Clover_Sweet",
            "Ruby_Swirl_Flower_Sweet",
            "Ruby_Swirl_Ribbon_Sweet",
            "Caramel_Swirl_Strawberry_Sweet",
            "Caramel_Swirl_Berry_Sweet",
            "Caramel_Swirl_Love_Sweet",
            "Caramel_Swirl_Star_Sweet",
            "Caramel_Swirl_Clover_Sweet",
            "Caramel_Swirl_Flower_Sweet",
            "Caramel_Swirl_Ribbon_Sweet",
            "Rainbow_Swirl_Strawberry_Sweet",
            "Rainbow_Swirl_Berry_Sweet",
            "Rainbow_Swirl_Love_Sweet",
            "Rainbow_Swirl_Star_Sweet",
            "Rainbow_Swirl_Clover_Sweet",
            "Rainbow_Swirl_Flower_Sweet",
            "Rainbow_Swirl_Ribbon_Sweet",
            ):
            processVariant(t, f"_{t.replace('_','')}")

        processVariant("Rapid_Strike", "_Rapid")
        processVariant("Bloodmoon", "_bloodmoon")

        # tatsiguri formes
        processVariant("Stretchy", "_Stretchy")

        # gimmighoul formes
        processVariant("Roaming", "_Roaming")

        # never seen this guy, 1017
        processVariant("Teal", "_Teal")
        processVariant("Teal_Mask", "_TealOn")
        processVariant("Wellspring", "_Wellspring")
        processVariant("Wellspring_Mask", "_WellspringOn")
        processVariant("Hearthflame", "_Hearthflame")
        processVariant("Hearthflame_Mask", "_HearthflameOn")
        processVariant("Cornerstone", "_Cornerstone")
        processVariant("Cornerstone_Mask", "_CornerstoneOn")

        for fileName, original in toCopy.items():
            newFilePath = os.path.join(newDirpath, fileName)
            if not os.path.exists(newFilePath):
                shutil.copy(original, newFilePath)
        
    with open(SPRITESHEET_SETTINGS_JS, "w") as ssJ:
        ssJ.write("export default\n")
        json.dump(spritesheetSettings, ssJ, indent=2, sort_keys=True)
    
    # copy the credits.txt file
    if os.path.exists(CREDITS_LOCATION):
        shutil.copy(CREDITS_LOCATION, os.path.join("img", "pmd-overworld", "credits.txt"))

    forbidden = (
        "Alternate",
        "Altcolor",
        "Starter",
        "Mikon",
        "Libre",
        "Cosplay",
        "Paldea_Blaze",
        "Beta",
        )
    for k,v in registeredVariants.items():
        if v and not [None for x in forbidden if (x in k)]:
            print(k, v)


if __name__ == "__main__":
    main()