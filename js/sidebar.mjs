import { MODULENAME } from "./utils.mjs";

function OnRenderActorDirectory(_app, html) {
  if (!game.settings.get("ptu", "advancementPendingIndicator")) return;
  const MODULE = game.modules.get(MODULENAME);

  // Mark individual actor entries
  html.querySelectorAll("li[data-entry-id]").forEach((el) => {
    const actorId = el.dataset.entryId;
    const actor = game.actors.get(actorId);
    const nameEl = el.querySelector(".entry-name");
    if (!nameEl) return;
    const isShiny = MODULE?.api?.logic?.ActorShiny?.(actor) ?? false;
    const isAlpha = MODULE?.api?.logic?.IsAlpha?.(actor) ?? false;

    // Alpha indicator
    if (isAlpha) {
      if (!nameEl.querySelector(".pa-is-pokemon-alpha")) {
        const alphaImg = document.createElement("img");
        alphaImg.src = `modules/${MODULENAME}/img/ui/alpha-indicator.png`;
        alphaImg.title = "Alpha Pokémon";
        alphaImg.classList.add("icon");
        alphaImg.classList.add("pa-is-pokemon-alpha");
        alphaImg.style.width = "1em";
        alphaImg.style.height = "1em";
        alphaImg.style.display = "inline-block";
        alphaImg.style.marginLeft = "0.5em";
        nameEl.append(alphaImg);
      }
    } else {
      nameEl.querySelector(".pa-is-pokemon-alpha")?.remove();
    }

    // Shiny indicator
    if (isShiny) {
      if (!nameEl.querySelector(".pa-is-pokemon-shiny")) {
        const shinyImg = document.createElement("img");
        shinyImg.src = `modules/${MODULENAME}/img/ui/shiny-indicator.png`;
        shinyImg.title = "Shiny Pokémon";
        shinyImg.classList.add("icon");
        shinyImg.classList.add("pa-is-pokemon-shiny");
        shinyImg.style.width = "1em";
        shinyImg.style.height = "1em";
        shinyImg.style.display = "inline-block";
        shinyImg.style.marginLeft = "0.5em";
        nameEl.append(shinyImg);
      }
    } else {
      nameEl.querySelector(".pa-is-pokemon-shiny")?.remove();
    }
  });
}

export function register() {
  Hooks.on("renderActorDirectory", OnRenderActorDirectory);
}