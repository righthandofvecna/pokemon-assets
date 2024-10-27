import requests
from lxml import etree
import time
import os

# https://pokemon.fandom.com/wiki/Youngster

SPRITES_TO_GET = ("FRLG", "RSE", "DPPt", "HGSS", "BW", "DP", "VI", "IV", "V", "III", )

SPRITE_GEN_NAME_FILTER = {
    "FRLG": "frlg",
    "RSE": "rse",
    "DPPt": "dppt",
    "HGSS": "hgss",
    "BW": "bw",
    "DP": "dppt",
    "VI": "bw",
    "V": "hgss",
    "IV": "dppt",
    "III": "frlg"
}

SPRITE_GENDER_NAME_FILTER = {
    "(F)": "_f",
    "Female": "_f",
    "(M)": "_m",
    "Male": "_m",
    None: ""
}

def whichIncludes(t, any):
    for a in any:
        if not a:
            continue
        if a in t:
            return a
    return None

def firstOrDefault(*l, default=None):
    for li in l:
        if li:
            return li[0]
    return default


def getTrainerClassImages(trainerClassUrl):
    r = requests.get(trainerClassUrl)
    tcDoc = etree.HTML(r.text)
    name = " ".join(e.text for e in tcDoc.xpath('//h1/*[@class="mw-page-title-main"]')).lower().replace(' ', '').replace('(trainerclass)', '')
    allSprites = tcDoc.xpath('//div[@id="content"]//*[@id="Sprites"]/../following-sibling::*[1]//img')
    filteredSprites = [
        (
            firstOrDefault(e.xpath("@data-src"), e.xpath("@src")),
            SPRITE_GEN_NAME_FILTER[whichIncludes(e.xpath("@data-image-name")[0], SPRITES_TO_GET)],
            SPRITE_GENDER_NAME_FILTER[whichIncludes(e.xpath("@data-image-name")[0], SPRITE_GENDER_NAME_FILTER.keys())],
        ) for e in allSprites if whichIncludes(e.xpath("@data-image-name")[0], SPRITES_TO_GET) != None][::-1]
    
    # skip downloading ungendered sprites (already got em)
    if not [True for _,_,x in filteredSprites if x]:
        print(name, filteredSprites)
        return True

    if not filteredSprites:
        return False
    
    # get all images and put in the gen folder
    for fs, gen, gender in filteredSprites:
        r = requests.get(fs)
        fname = f"trainer_{name}{gender}_{gen}.png"
        if r.status_code != 200:
            print("can't create", fname, ":: response code", r.status_code)
            continue
        with open(os.path.join("img","trainers-profile-gen", fname), "wb") as fp:
            fp.write(r.content)
    return True


def getAllTrainerClasses():
    r = requests.get("https://pokemon.fandom.com/wiki/Youngster")
    tcDoc = etree.HTML(r.text)

    allLinks = tcDoc.xpath('//div[@id="content"]//table[contains(@class, "navbox")]//a/@href')
    allTCs = [l for l in allLinks if l.startswith("/wiki/") and "Template" not in l and "Version" not in l and "Generation" not in l]
    # exclude some links
    allTCs = set(allTCs)
    try: allTCs.remove("/wiki/Pok%C3%A9mon_Trainer")
    except: pass
    try: allTCs.remove("/wiki/Pok%C3%A9mon_Champion")
    except: pass
    try: allTCs.remove("/wiki/Champion")
    except: pass
    try: allTCs.remove("/wiki/Pocket_Monsters_Red_and_Pocket_Monsters_Green")
    except: pass
    try: allTCs.remove("/wiki/Pocket_Monsters_Blue")
    except: pass
    try: allTCs.remove("/wiki/Pok%C3%A9mon_Yellow_Special_Pikachu_Edition")
    except: pass
    try: allTCs.remove("/wiki/Tower_Tycoon")
    except: pass
    try: allTCs.remove("/wiki/Kimono_Girl")
    except: pass

    time.sleep(1)
    getTrainerClassImages(f"https://pokemon.fandom.com/wiki/Youngster")

    # iterate
    for tc in allTCs:
        time.sleep(1)
        found = getTrainerClassImages(f"https://pokemon.fandom.com{tc}")
        if found: continue
        # try disambiguating
        found = getTrainerClassImages(f"https://pokemon.fandom.com{tc}_(Trainer_class)")
        if not found:
            print("still not found:", tc)

getAllTrainerClasses()