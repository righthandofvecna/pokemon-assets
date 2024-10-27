
import json
import os
import shutil

INFO_JSON_LOCATION = "<path>"
FOLDER_LOCATION = "<path>"

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
    for anim in ("Walk-Anim.png", ):
        path = os.path.join(FOLDER_LOCATION, *nests, anim)
        if os.path.exists(path):
            return path
    return None

registeredVariants = {}
def registerVariant(dexnumber, v):
    if v in registeredVariants:
        registeredVariants[v].append(dexnumber)
        return
    registeredVariants[v] = [dexnumber]

def unregisterVariant(dexnumber, v):
    if v not in registeredVariants or dexnumber not in registeredVariants[v]:
        print(f"can't remove {dexnumber=} from {v=}")
    else:
        registeredVariants[v].remove(dexnumber)

with open(INFO_JSON_LOCATION, "r") as iJ:
    data = json.load(iJ)

    for dexnumber in data.keys():
        mainSprite = getAnimFileFromFilesystem(dexnumber)
        variants = {}
        if mainSprite:
            variants[""] = mainSprite
            registerVariant(dexnumber, "")
        
        sgs1 = safeGet(data, dexnumber, "subgroups", default={})
        for sg1 in sgs1.keys():
            varSprite = getAnimFileFromFilesystem(dexnumber, sg1)
            name1 = safeGet(data, dexnumber, "subgroups", sg1, "name", default="variant")   
            if varSprite:
                variants[name1] = varSprite
                registerVariant(dexnumber, name1)

            sgs2 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", default={})
            for sg2 in sgs2.keys():
                name2 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", sg2, "name", default="variant") 
                varSprite2 = getAnimFileFromFilesystem(dexnumber, sg1, sg2)
                if varSprite2:
                    variants[name1 + ":" + name2] = varSprite2
                    registerVariant(dexnumber, name1 + ":" + name2)
                 
                sgs3 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", sg2, "subgroups", default={})
                for sg3 in sgs3.keys():
                    name3 = safeGet(data, dexnumber, "subgroups", sg1, "subgroups", sg2, "subgroups", sg3, "name", default="variant") 
                    varSprite3 = getAnimFileFromFilesystem(dexnumber, sg1, sg2, sg3)
                    if varSprite3:
                        variants[name1 + ":" + name2 + ":" + name3] = varSprite3
                        registerVariant(dexnumber, name1 + ":" + name2 + ":" + name3)
        
        # make the 3-deep nested structure
        d3 = dexnumber[:-2] + "XX"
        d2 = dexnumber[:-1] + "X"
        newDirpath = os.path.join("img", "pmd-overworld", d3, d2)
        if not os.path.exists(newDirpath):
            os.makedirs(newDirpath)

        toCopy = {}
        def addVariant(key, suffix):
            if key in variants:
                if variants[key]:
                    toCopy[f"{dexnumber}{suffix}.png"] = variants[key]
                    unregisterVariant(dexnumber, key)
            if f"{key}:Shiny" in variants:
                if variants[f"{key}:Shiny"]:
                    toCopy[f"{dexnumber}s{suffix}.png"] = variants[f"{key}:Shiny"]
                    unregisterVariant(dexnumber, f"{key}:Shiny")
            if f"{key}::Male" in variants:
                if variants[f"{key}::Male"]:
                    toCopy[f"{dexnumber}m{suffix}.png"] = variants[f"{key}::Male"]
                    unregisterVariant(dexnumber, f"{key}::Male")
            if f"{key}:Shiny:Male" in variants:
                if variants[f"{key}:Shiny:Male"]:
                    toCopy[f"{dexnumber}ms{suffix}.png"] = variants[f"{key}:Shiny:Male"]
                    unregisterVariant(dexnumber, f"{key}:Shiny:Male")
            if f"{key}::Female" in variants:
                if variants[f"{key}::Female"]:
                    toCopy[f"{dexnumber}f{suffix}.png"] = variants[f"{key}::Female"]
                    unregisterVariant(dexnumber, f"{key}::Female")
            if f"{key}:Shiny:Female" in variants:
                if variants[f"{key}:Shiny:Female"]:
                    toCopy[f"{dexnumber}fs{suffix}.png"] = variants[f"{key}:Shiny:Female"]
                    unregisterVariant(dexnumber, f"{key}:Shiny:Female")

        addVariant("", "")
        # regional variants
        addVariant("Alola", "_alolan")
        addVariant("Galar", "_galarian")
        addVariant("Hisui", "_hisuian")
        addVariant("Paldea", "_paldean")

        # megas
        addVariant("Mega", "_MEGA")
        addVariant("Mega_X", "_MEGA_X")
        addVariant("Mega_Y", "_MEGA_Y")

        # type formes
        for t in ("Bug", "Dark", "Dragon", "Electric", "Fairy", "Fighting", "Fire", "Flying", "Ghost", "Grass", "Ground", "Ice", "Poison", "Psychic", "Rock", "Steel", "Water"):
            addVariant(t, f"_{t}")
        addVariant("Question_Mark", "_Untyped")

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

            ):
            addVariant(t, f"_{t}")

        # special formes (all caps)
        for t in ("Shadow", ):
            addVariant(t, f"_{t.upper()}")

        # rotom formes
        for t in ("Fan", "Frost", "Heat", "Mow", "Wash", "Drone"):
            addVariant(t, f"_{t}")

        # weather formes
        for t in ("Sunny", "Rainy", "Snowy", "Sunshine"):
            addVariant(t, f"_{t}")

        # seasonal formes
        for s in ("Summer", "Autumn", "Winter"):
            addVariant(s, f"_{s}")

        # daytime formes
        for s in ("Midnight", "Dusk", ):
            addVariant(s, f"_{s}")

        # color formes
        for t in ("Blue", "Red", "White", "Yellow", "Orange", "Green", "Indigo", "Violet", "Purple" ):
            addVariant(t, f"_{t}")
        
        # spiky pichu
        addVariant("Spiky", f"_spiky")

        # unown formes
        for c in (*"ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Exclamation", "Question"):
            addVariant(c, f"_{c}")

        # wormadam formes
        for t in ("Trash", "Sand", ):
            addVariant(t, f"_{t}")
        
        # directional shellos formes
        addVariant("East", f"_East")
        addVariant("West", f"_West")

        # genesect formes
        for t in ("Douse", "Shock", "Burn", "Chill", ):
            addVariant(t, f"_{t}")

        # vivillion formes
        for t in ("Icy_Snow", "Polar", "Tundra", "Continental", "Garden", "Elegant", "Archipelago", "High_Plains", ):
            # there are so many more than are implemented......
            # and there are already a lot
            addVariant(t, f"_{t.replace('_','')}")

        # froufrou haircut/outfit formes
        for t in ("Kabuki", ):
            addVariant(t, f"_{t}")

        # aegislash formes
        addVariant("Blade", f"_Blade")

        # size formes
        for t in ("Small", "Large", "Super" ):
            addVariant(t, f"_{t}")

        # zygarde formes
        addVariant("10", "_10%")
        addVariant("50", "_50%")
        addVariant("Complete", "_Complete")
        
        # wishiwashi formes
        addVariant("School", "_Schooling")

        # mimiku formes
        addVariant("Busted", "_Busted")

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
            addVariant(t, f"_{t.replace('_','')}")

        addVariant("Rapid_Strike", "_Rapid")
        addVariant("Bloodmoon", "_bloodmoon")

        # tatsiguri formes
        addVariant("Stretchy", "_Stretchy")

        # gimmighoul formes
        addVariant("Roaming", "_Roaming")

        # never seen this guy, 1017
        addVariant("Teal", "_Teal")
        addVariant("Teal_Mask", "_TealOn")
        addVariant("Wellspring", "_Wellspring")
        addVariant("Wellspring_Mask", "_WellspringOn")
        addVariant("Hearthflame", "_Hearthflame")
        addVariant("Hearthflame_Mask", "_HearthflameOn")
        addVariant("Cornerstone", "_Cornerstone")
        addVariant("Cornerstone_Mask", "_CornerstoneOn")

        for fileName, original in toCopy.items():
            newFilePath = os.path.join(newDirpath, fileName)
            if not os.path.exists(newFilePath):
                shutil.copy(original, newFilePath)
        
        # if dexnumber == "0530":
        #     break
    
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

