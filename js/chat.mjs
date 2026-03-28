import { MODULENAME } from "./utils.mjs";


/**
 * Handle emote-related chat commands.
 */
function onChatMessage(_chatLog, message, chatData) {
  console.log("Chat message:", ...arguments);
  if (!message.startsWith("/emote")) return;
  const content = message.replace("/emote", "").trim();
  const TokenReact = game.modules.get(MODULENAME)?.api?.scripts?.TokenReact;
  if (!TokenReact) return;
  const token = game.scenes.get(chatData?.speaker?.scene)?.tokens.get(chatData?.speaker?.token);
  if (!token) return;
  console.log("Emote content:", content);

  const react = (()=>{
    if (["angry", "anger"].includes(content)) return "angry";
    else if (["cry", "crying", ":'("].includes(content)) return "cry";
    else if (["dismayed", "dismay", "oh no", "oh no!", "D:"].includes(content)) return "dismayed";
    else if (["ellipsis", "thinking", "..."].includes(content)) return "ellipsis";
    else if (["furious", "fury", ">:("].includes(content)) return "furious";
    else if (["grin", "grinning", ":D"].includes(content)) return "grin";
    else if (["happy", "happiness"].includes(content)) return "happy";
    else if (["heart", "love", "<3"].includes(content)) return "heart";
    else if (["pleased", "satisfied", "^_^"].includes(content)) return "pleased";
    else if (["question", "confused", "?"].includes(content)) return "question";
    else if (["sad", "sadness", ":("].includes(content)) return "sad";
    else if (["sing", "singing", "song", "note", "♪"].includes(content)) return "sing";
    else if (["smile", "smiling", ":)"].includes(content)) return "smile";
    else if (["surprise", "surprised", "!"].includes(content)) return "surprise";
    return null;
  })()

  if (!react) return;

  TokenReact(token, react);
  return false;
}


export function register() {
  Hooks.on("chatMessage", onChatMessage);
}