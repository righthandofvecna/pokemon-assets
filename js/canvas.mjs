
function OnCanvasReady(cnvs) {
  try {
    cnvs?.tokens?.objects?.children?.forEach(o=>o?.startIdleAnimation?.());
  } catch (e) {
    console.error("OnCanvasReady():", e);
  }
}


export function register() {
  Hooks.on("canvasReady", OnCanvasReady);
}
