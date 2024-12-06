import { MODULENAME, isTheGM, isGMOnline, early_isGM } from "./utils.mjs";

const FLAG_FOLLOWING = "following";

function getFollowMap(scene) {
  const followMap = {};
  const allSceneTokens = scene?.tokens;
  if (!allSceneTokens) return {};
  
  for (const t of allSceneTokens) {
    const following = t.getFlag(MODULENAME, FLAG_FOLLOWING)?.who;
    if (!following) continue;
    followMap[following] ??= [];
    followMap[following].push(t.id);
  }
  return followMap;
}

function getAllFollowing(token) {
  const allSceneTokens = token?.scene?.tokens;
  const followMap = getFollowMap(token?.scene);
  const followerIds = [];
  const addFollower = function (fid) {
    followMap[fid]?.forEach(sfid=>{
      if (followerIds.includes(sfid)) {
        return;
      }
      followerIds.push(sfid);
      addFollower(sfid);
    });
  };
  addFollower(token.id);
  return followerIds.map(fid=>allSceneTokens.get(fid));
}


function getFollowerUpdates(tPos, followers) {
  const followerUpdates = [];
  let p = tPos;
  for (const follower of followers) {
    const desc = foundry.utils.deepClone(follower.getFlag(MODULENAME, FLAG_FOLLOWING));
    desc.positions.push(p);
    const followPath = new SimpleSpline(desc.positions);
    let data = {
      _id: follower.id,
    };

    let param = followPath.plen-desc.dist;
    let new_pos = followPath.parametricPosition(param);
    // Snap the new position to the grid
    new_pos = canvas.grid.getSnappedPoint( new_pos, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX } );
    data.x = new_pos.x;
    data.y = new_pos.y;

    p = { x: data.x, y: data.y }; // update for the next follower
    if (data.x == follower.x) delete data.x;
    if (data.y == follower.y) delete data.y;

    // don't need to reorient, this module already does it

    // TODO: collisions


    followPath.prune(param);
    desc.positions = followPath.p;
    data[`flags.${MODULENAME}.${FLAG_FOLLOWING}`] = desc;
    if (!(!data.x && !data.y)) {
      followerUpdates.push(data);
    }
  }
  return followerUpdates;
}


function OnFollowKey() {
  const allTokens = canvas?.tokens;
  let leader = canvas?.tokens?.hover?.id;
  const followers = (canvas?.tokens?.controlled ?? []).map(t=>t.id);

  if (!leader || followers.length === 0) return;

  const followMap = getFollowMap(canvas.scene);

  const updatesById = {};

  // find the tail
  let cycleDetected = false;

  // Initialize structures to track line order and visited IDs
  const visited = new Set();

  // Build a reverse mapping for incoming connections
  const reverseRecord = {};
  for (const [id, followers] of Object.entries(followMap)) {
    for (const follower of followers) {
      if (!reverseRecord[follower]) {
        reverseRecord[follower] = [];
      }
      reverseRecord[follower].push(id);
    }
  }

  function _traverseReverse(id) {
    if (cycleDetected || visited.has(id)) {
      cycleDetected = true;
      return []; // Avoid revisiting
    }
    visited.add(id);            // Mark as visited
    const lineOrder = [];
    // Explore incoming connections
    for (const followerOf of reverseRecord[id] || []) {
      lineOrder.push(..._traverseReverse(followerOf));
    }
    lineOrder.push(id);
    return lineOrder
  }

  function _traverseForwards(id) {
    if (cycleDetected || visited.has(id)) {
      cycleDetected = true;
      return []; // Avoid revisiting
    }
    visited.add(id);            // Mark as visited
    const lineOrder = [id];
    // Explore outgoing connections
    for (const follower of followMap[id] || []) {
      lineOrder.push(..._traverseForwards(follower));
    }
    return lineOrder;
  }

  // Recursive function to traverse connections in both directions
  function traverse(id) {
    if (cycleDetected || visited.has(id)) {
      cycleDetected = true;
      return []; // Avoid revisiting
    }
    visited.add(id);            // Mark as visited
    const lineOrder = [];
    // Explore incoming connections
    for (const followerOf of reverseRecord[id] || []) {
      lineOrder.push(..._traverseReverse(followerOf));
    }
    lineOrder.push(id);
    // Explore outgoing connections
    for (const follower of followMap[id] || []) {
      lineOrder.push(..._traverseForwards(follower));
    }
    return lineOrder;
  }

  // Start traversal from the given startID
  const lineOrder = traverse(leader);
  leader = lineOrder[lineOrder.length - 1];

  if (cycleDetected) {
    ui.notifications.error("A cycle is detected!!");
    Object.entries(followMap).flatMap(([_id, v])=>[_id, ...v]).forEach(_id=>{
      updatesById[_id] = {
        [`flags.${MODULENAME}.${FLAG_FOLLOWING}.who`]: null,
      };
    });
  }
  else {
    for (const follower of followers) {
      const leaderToken = allTokens.get(leader);
      const followerToken = allTokens.get(follower);
      if (!leaderToken || !followerToken) return;
      if (lineOrder.includes(follower) && followerToken.document.getFlag(MODULENAME, FLAG_FOLLOWING)?.who) {
        const lastLeaderToken = allTokens.get(lineOrder[lineOrder.findIndex((_id)=>_id === follower)-1]);
        canvas.interface.createScrollingText(followerToken, `Unfollowing ${lastLeaderToken?.document?.name ?? "someone"}!`, {
          anchor: CONST.TEXT_ANCHOR_POINTS.TOP, 
          fill:   "#FFFFFF", 
          stroke: "#FFFFFF"
        });
        updatesById[follower] ??= {};
        updatesById[follower][`flags.${MODULENAME}.${FLAG_FOLLOWING}.who`] = null;
        lineOrder.splice(lineOrder.findIndex(follower), 1);
        continue;
      } else if (lineOrder.includes(follower)) {
        canvas.interface.createScrollingText(followerToken, `You can't follow ${leaderToken?.document?.name ?? "someone"}, they are following you!`, {
          anchor: CONST.TEXT_ANCHOR_POINTS.TOP, 
          fill:   "#FF0000", 
          stroke: "#FF0000",
        });
        continue;
      }
      const dist = (Math.max(leaderToken.w, leaderToken.h) + Math.max(followerToken.w, followerToken.h)) / 2;
      canvas.interface.createScrollingText(followerToken, `Following ${leaderToken?.document?.name ?? "someone"}!`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP, 
        fill:   "#FFFFFF", 
        stroke: "#FFFFFF"
      });
      updatesById[follower] ??= {};
      updatesById[follower][`flags.${MODULENAME}.${FLAG_FOLLOWING}.who`] = leader;
      updatesById[follower][`flags.${MODULENAME}.${FLAG_FOLLOWING}.dist`] = dist;
      updatesById[follower][`flags.${MODULENAME}.${FLAG_FOLLOWING}.positions`] = [{x: followerToken.x, y: followerToken.y}, { x: leaderToken.x, y: leaderToken.y }];
      lineOrder.push(follower);

      leader = follower;
    }
  }

  const allUpdates = Object.entries(updatesById).map(([_id, v])=>({_id, ...v}));
  const follower_updates = allUpdates.filter(u=>!allTokens.get(u._id)?.isOwner);
  const updates = allUpdates.filter(u=>follower_updates.findIndex(u2=>u2._id === u._id) === -1);

  game.scenes.active.updateEmbeddedDocuments("Token", updates, { follower_updates });
}

function OnManualMove(token, update, follower_updates) {
  if (game.combats.find(c=>c.active && c.scene.uuid === token?.scene?.uuid)) return;
  const followers = getAllFollowing(token);

  // check if the token is a follower that just moved
  const newWho = foundry.utils.getProperty(update, `flags.${MODULENAME}.${FLAG_FOLLOWING}.who`);
  const oldWho = foundry.utils.getProperty(token, `flags.${MODULENAME}.${FLAG_FOLLOWING}.who`);
  if (["x", "y"].some(p=>foundry.utils.hasProperty(update, p)) && ( newWho || oldWho ) ) {
    update[`flags.${MODULENAME}.${FLAG_FOLLOWING}.who`] = null;
    canvas.interface.createScrollingText(token, `Follow broken!`, {
      anchor: CONST.TEXT_ANCHOR_POINTS.TOP, 
      fill:   "#FF0000", 
      stroke: "#FF0000"
    });
  }

  follower_updates.push(...getFollowerUpdates({
    x: update.x ?? token.x,
    y: update.y ?? token.y
  }, followers));
}

function OnUpdateToken(token, change, options, userId) {
  if (!options?.follower_updates || options.follower_updates.length == 0) return;
  if (!isTheGM() && isGMOnline()) return;
  const scene = token.scene;
  if (!scene) return;
  scene.updateEmbeddedDocuments("Token", options.follower_updates, { follower_updates: [] });
}

export function register() {
  if (game.modules.get("FollowMe")?.active) {
    if (early_isGM()) {
      ui.notifications.warning(`"Pokemon Assets" provides a replacement for "Follow Me!", and may work better if that module is disabled.`);
    }
    return;
  }
  Hooks.on("updateToken", OnUpdateToken);
  Hooks.on("pokemon-assets.manualMove", OnManualMove);

  game.keybindings.register(MODULENAME, "follow", {
    name: "Follow Token",
    hint: "The key to join or leave the chain of tokens being followed.",
    editable: [
      {
        key: "KeyF"
      }
    ],
    onDown: OnFollowKey,
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}


/* ------------ UTILITIES ---------------- */


function vNeg(p){ // Return -1*v
  return {x:-p.x, y:-p.y};
}
function vAdd(p1, p2){ // Return the sum, p1 + p2
  return {x:p1.x+p2.x, y:p1.y+p2.y };
}
function vSub(p1, p2){// Return the difference, p1-p2
  return {x:p1.x-p2.x, y:p1.y-p2.y };
}
function vMult(p,v){ // Multiply vector p with value v
  return {x:p.x*v, y: p.y*v};  
}
function vDot(p1, p2){ // Return the dot product of p1 and p2
  return p1.x*p2.x + p1.y*p2.y;
}
function vLen(p){ // Return the length of the vector p
  return Math.sqrt(p.x**2 + p.y**2);
}
function vNorm(p){ // Normalize the vector p, p/||p||
  return vMult(p, 1.0/vLen(p));
}
function vAngle(p){ // The foundry compatible 'rotation angle' to point along the vector p
  return 90+Math.toDegrees(Math.atan2(p.y, p.x));
}

// An implementation of hermite-like interpolation. The derivative is hermite-like, whereas the position is linearly interpolated
class SimpleSpline{
  constructor(points, smoothness=0.0){
    this.p = points;
    this.smoothness = smoothness;
    this.lengths = [];
    for (let i = 1; i < this.len; ++i){
      this.lengths.push( vLen(vSub(this.p[i-1], this.p[i])) );
    }
  }
  parametricLength(){
    return this.lengths.reduce((p, a)=>p+a,0);
  }
  get len (){
    return this.p.length;
  }
  get plen(){
    return this.parametricLength();
  }

  // Position at parametric position t
  parametricPosition( t ){
    if (this.len<2){return this.p[0];}    
    let len = 0;
    for (let i = 1; i < this.len; ++i){
      let nlen = this.lengths[i-1];
      if (len+nlen >= t){
        let nfrac = (t-len)/(nlen);//normalized fraction
        // returning (1-nt)*prev + nt*cur
        return vAdd(vMult(this.p[i-1], 1-nfrac), vMult(this.p[i], nfrac) );
      }
      len += nlen;
    }
    // we have gone past our parametric length, clamp at last point
    return this.p[this.len-1];
  }

  #iNorm(i){
    if(i<1){
      return vNorm(vSub(this.p[0], this.p[1]));
    }
    if(i > (this.len-2)){
      // last (or past last) point, return (last - next to last)
      return vNorm(vSub(this.p[this.len-2], this.p[this.len-1]));
    }
    return vNorm( vSub(this.p[i-1], this.p[i+1]));
  }

  prune(before){
      if (this.len<=2)return;
      let cumsum = 0;
      let i = 0;
      for(;cumsum < before; ++i){
          cumsum+=this.lengths[i];
      }
      --i;
      if (i>0){
          this.lengths = this.lengths.slice(i);
          this.p = this.p.slice(i);
      }
  }

  // Derivative at parametric position t
  derivative(t){
    if (t<=0){ 
      return this.#iNorm(0);
    }
    let len = 0;
    for (let i = 1; i < this.len; ++i){
      let nlen = this.lengths[i-1];
      if ((len+nlen) >= t){
        let nfrac = (t-len)/(nlen);//normalized fraction
        let p = this.#iNorm(i-1);
        let n = this.#iNorm(i);
        return vNorm( vAdd(vMult(p,1-nfrac), vMult(n,nfrac)) );
      }
      len += nlen;
    }
    return this.#iNorm(this.len);
  }
}