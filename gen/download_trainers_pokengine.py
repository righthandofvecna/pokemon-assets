
import requests
from lxml import etree
import time
import os
import json

# "https://pokengine.org/collections/10qmfbx6/Nintendo?tab=trainers&trainerclass&overworlds&page={}"

scrapedPages = []

excludeIds = ["01kgg83j", "016r8yo2", "01pr4le2", "01p3i91e", "013ohjyp", "01ruoex4", "01jqeywe", "019mrij7", "01lge4u5", "01ar2jhc", "01mjbqtg", "01gn85vi", "0122np9z", "01lcjqkl", "0123v1xg"]

attribution = {}

SPRITESHEET_SETTINGS_JS = os.path.join("data", "spritesheetmap.js")

with open(SPRITESHEET_SETTINGS_JS, "r") as ssjs:
    ssjs.readline()
    spritesheetSettings = json.load(ssjs)

def scrapeTrainerClassPage(pageSrc):
    if pageSrc in scrapedPages:
        return
    scrapedPages.append(pageSrc)
    time.sleep(2)
    r = requests.get(pageSrc)
    tcDoc = etree.HTML(r.text)

    for classVariant in tcDoc.xpath('//form/div[@class="content"]'):
        try:
            permission = len(classVariant.xpath('div/a[@class="free-to-use yes"]')) > 0
            ownerElement = classVariant.xpath('div/b[@class="owner"]/following-sibling::*')[0]
            owner = ownerElement.text
            ownerLink = ownerElement.attrib['href']
            if not permission:
                continue

            name = classVariant.xpath('a')[0].text.lower().replace(' ', '')
            gender = ""
            for tag in classVariant.xpath('div/a[@class="tab"]'):
                if tag.text == "#male":
                    gender = "_m"
                    break
                if tag.text == "#female":
                    gender = "_f"
                    break

            trainerClassSrc:str = ""
            trainerOverworldSrc = ""
            for sprite in classVariant.xpath('div[@class="panel"]/div[contains(@class, "sprite")]//img'):
                spriteSrc = sprite.attrib["src"]
                if "/fronts/" in spriteSrc:
                    trainerClassSrc = spriteSrc
                if "/overworlds/" in spriteSrc:
                    trainerOverworldSrc = spriteSrc
            if not trainerClassSrc or not trainerOverworldSrc:
                continue

            trainerId = trainerClassSrc[trainerClassSrc.rindex("/")+1:trainerClassSrc.index(".webp")]
            if trainerId in excludeIds:
                continue

            fname = f"trainer_{name}{gender}_pe_{trainerId}.webp"

            # download the trainer class image
            tcPath = os.path.join("img","trainers-profile", fname)
            if not os.path.exists(tcPath):
                imgR = requests.get(trainerClassSrc)
                if imgR.status_code != 200:
                    print("can't create", fname, ":: response code", r.status_code)
                    continue
                with open(tcPath, "wb") as fp:
                    fp.write(imgR.content)

            # download the trainer overworld image
            toPath = os.path.join("img","trainers-overworld", fname)
            if not os.path.exists(toPath):
                imgR = requests.get(trainerOverworldSrc)
                if imgR.status_code != 200:
                    print("can't create", fname, ":: response code", r.status_code)
                    continue
                with open(toPath, "wb") as fp:
                    fp.write(imgR.content)
            
            attribution[owner] = {
                "owner": owner,
                "url": f"https://pokengine.org{ownerLink}"
            }

            foundryPathA = "modules/pokemon-assets/img/trainers-overworld/trainer_"
            foundryPathB = fname[len("trainer_"):]
            if foundryPathB not in spritesheetSettings[foundryPathA]["images"]:
                spritesheetSettings[foundryPathA]["images"][foundryPathB] = {}
        except Exception as e:
            print(e)


def scrapePage(pageNum):
    try:
        r = requests.get(f"https://pokengine.org/collections/10qmfbx6/Nintendo?tab=trainers&trainerclass&overworlds&page={pageNum}")
        if r.status_code != 200:
            print("failed", r)
            return False
        tcDoc = etree.HTML(r.text)
        for spriteContainer in tcDoc.xpath('//div[@class="dex-block"]'):
            src = ""
            for scimg in spriteContainer.xpath('a'):
                src = scimg.attrib["href"]
                break
            if not src: continue
            scrapeTrainerClassPage(f"https://pokengine.org{src}")
        
        return True
    except Exception as e:
        print(e)
        return False

def main():
    for i in range(100):
        result = scrapePage(i + 1)
        if not result:
            break
        time.sleep(2)
    credits = []
    with open("CREDITS.md", "r", encoding="utf-8") as fp:
        credits = fp.readlines()
    with open("CREDITS.md", "w", encoding="utf-8") as fp:
        for i, credit in enumerate(credits):
            if i == 2: # the line that these credits are listed
                fp.write("Some sprites used from " + ", ".join(f"[{o['owner']}]({o['url']})" for o in attribution.values()) + "\n")
            else:
                fp.write(credit)
    
    with open(SPRITESHEET_SETTINGS_JS, "w") as ssJ:
        ssJ.write("export default\n")
        json.dump(spritesheetSettings, ssJ, indent=2, sort_keys=True)
                
    

if __name__ == "__main__":
    main()