"use strict";

var CLASS_OPTIONS = [
  { id: "samurai", emoji: "🐗", name: "Samurai Sanglier" },
  { id: "priestess", emoji: "🦌", name: "Prêtresse Biche" },
  { id: "ninja", emoji: "🦊", name: "Renard Ninja" },
  { id: "mage", emoji: "🦦", name: "Loutre Mage" },
  { id: "bard", emoji: "🐉", name: "Dragon Barde" },
];
var SLOT_LABELS = { tete: "Tête", torse: "Torse", jambes: "Jambes", pieds: "Pieds" };
var SCALE = 0.1;

var ZONE_THEMES = {
  racine_feuille: { ground: 0x2f4d34, fog: 0x0b1a12, fogDensity: 0.032, ambient: 0x9fb8a6, sun: 0xffcf8a, trees: "blossom", treeCount: 10, torii: true, lanterns: true, rocks: 0, huts: 0, walls: 0 },
  sente_loups: { ground: 0x24361f, fog: 0x0a140d, fogDensity: 0.05, ambient: 0x7a9a8a, sun: 0xb8c8ff, trees: "pine", treeCount: 14, torii: false, lanterns: false, rocks: 4, huts: 0, walls: 0 },
  hameau_brumes: { ground: 0x3a4038, fog: 0x2a3238, fogDensity: 0.06, ambient: 0x9fb0b8, sun: 0xd8e0ff, trees: "pine", treeCount: 4, torii: false, lanterns: true, rocks: 2, huts: 4, walls: 0 },
  marais_hurlant: { ground: 0x3d3a24, fog: 0x2e2c1c, fogDensity: 0.065, ambient: 0x8a9a7a, sun: 0xc8d090, trees: "dead", treeCount: 10, torii: false, lanterns: false, rocks: 6, huts: 0, walls: 0 },
  citadelle_pic: { ground: 0x6a6a62, fog: 0x3a3a3a, fogDensity: 0.045, ambient: 0xb8b0a0, sun: 0xffe0a0, trees: "none", treeCount: 0, torii: false, lanterns: true, rocks: 3, huts: 0, walls: 4 },
  cretes_oni: { ground: 0x4a3230, fog: 0x2a1414, fogDensity: 0.06, ambient: 0x9a7a7a, sun: 0xff9a7a, trees: "dead", treeCount: 6, torii: false, lanterns: false, rocks: 10, huts: 0, walls: 0 },
};

var socket = io();

var state = {
  selectedClass: null,
  player: null,
  items: {},
  zoneStatic: null,
  constants: { ZONE_W: 320, ZONE_H: 440, MOVE_SPEED: 90 },
  latestMonsters: [],
  engagedMonsterId: null,
  cooldownUntil: {},
};

var els = {};
["screen-login", "screen-game", "input-name", "class-grid", "btn-login", "login-error",
 "hud-emoji", "hud-name", "hud-hp", "hud-mp", "hud-xp", "hud-level", "hud-gold",
 "zone-name", "combat-log", "joystick-base", "joystick-knob", "btn-bag",
 "battle-panel", "battle-target-name", "battle-target-hp", "battle-abilities", "btn-flee",
 "modal-npc", "npc-title", "npc-body", "btn-close-npc",
 "modal-bag", "equip-slots", "inventory-list", "btn-close-bag",
 "canvas-wrap", "labels-layer", "fallback",
].forEach(function (id) { els[id] = document.getElementById(id); });

function toWorldX(sx) { return (sx - state.constants.ZONE_W / 2) * SCALE; }
function toWorldZ(sy) { return (sy - state.constants.ZONE_H / 2) * SCALE; }

/* ------------------------------- LOGIN SCREEN ------------------------------ */

function renderClassGrid() {
  els["class-grid"].innerHTML = "";
  CLASS_OPTIONS.forEach(function (c) {
    var card = document.createElement("div");
    card.className = "class-card" + (state.selectedClass === c.id ? " selected" : "");
    card.innerHTML = '<span class="emoji">' + c.emoji + '</span><span class="cname">' + c.name + "</span>";
    card.addEventListener("click", function () { state.selectedClass = c.id; renderClassGrid(); });
    els["class-grid"].appendChild(card);
  });
}
renderClassGrid();

els["btn-login"].addEventListener("click", function () {
  var name = els["input-name"].value.trim();
  if (!name) { els["login-error"].textContent = "Choisis un nom."; return; }
  if (!state.selectedClass) { els["login-error"].textContent = "Choisis une classe."; return; }
  els["login-error"].textContent = "";
  socket.emit("login", { name: name, classId: state.selectedClass }, function (res) {
    if (!res.ok) { els["login-error"].textContent = res.error; return; }
    state.player = res.player;
    state.items = res.items;
    state.zoneStatic = res.zoneStatic;
    state.constants = res.constants;
    els["screen-login"].classList.remove("active");
    els["screen-game"].classList.add("active");
    initScene();
    loadZone(state.zoneStatic);
    renderHud();
  });
});

/* ---------------------------------- HUD ------------------------------------ */

function renderHud() {
  var p = state.player;
  if (!p) return;
  var cls = CLASS_OPTIONS.filter(function (c) { return c.id === p.classId; })[0];
  els["hud-emoji"].textContent = cls ? cls.emoji : "❓";
  els["hud-name"].textContent = p.name;
  setBar(els["hud-hp"], p.hp, p.maxHp);
  setBar(els["hud-mp"], p.mana, p.maxMana);
  setBar(els["hud-xp"], p.xp, p.xpToNext);
  els["hud-level"].textContent = "Niv. " + p.level;
  els["hud-gold"].textContent = "💰 " + p.gold;
}
function setBar(el, value, max) {
  var pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  el.style.width = pct + "%";
  el.classList.toggle("low", pct <= 30);
}

socket.on("player-state", function (p) { state.player = p; renderHud(); });

/* -------------------------------- LOG ------------------------------------- */

socket.on("combat-log", function (msg) { addLog(msg); });
socket.on("action-error", function (msg) { addLog("⚠ " + msg); });
function addLog(msg) {
  var p = document.createElement("p");
  p.textContent = msg;
  els["combat-log"].appendChild(p);
  els["combat-log"].scrollTop = els["combat-log"].scrollHeight;
  while (els["combat-log"].children.length > 30) els["combat-log"].removeChild(els["combat-log"].firstChild);
}

/* ================================================================ SCENE 3D */

var three = { scene: null, camera: null, renderer: null, raycaster: null, ambient: null, sun: null, rim: null };
var world = { npcs: new Map(), portals: [], props: [], players: new Map(), monsters: new Map() };
var MY_ID = null;
var input = { x: 0, y: 0 };
var raycastTargets = [];

function initScene() {
  if (typeof THREE === "undefined") { els["fallback"].classList.remove("hidden"); return; }
  Models.initToon();

  three.scene = new THREE.Scene();
  three.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
  three.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  three.renderer.setSize(window.innerWidth, window.innerHeight);
  els["canvas-wrap"].appendChild(three.renderer.domElement);
  three.raycaster = new THREE.Raycaster();

  three.ambient = new THREE.AmbientLight(0x9fb8a6, 0.55);
  three.scene.add(three.ambient);
  three.sun = new THREE.DirectionalLight(0xffcf8a, 1.15);
  three.sun.position.set(6, 10, 4);
  three.scene.add(three.sun);
  three.rim = new THREE.DirectionalLight(0xff8fb1, 0.4);
  three.rim.position.set(-6, 4, -6);
  three.scene.add(three.rim);

  window.addEventListener("resize", function () {
    three.camera.aspect = window.innerWidth / window.innerHeight;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  setupJoystick();
  setupTapToInteract();

  MY_ID = socket.id;
  var myGroup = Models.buildHero(state.player.classId);
  three.scene.add(myGroup);
  world.players.set(MY_ID, {
    group: myGroup, targetX: 0, targetZ: 0, facing: 0, walkT: 0,
    prevX: state.player.x, prevY: state.player.y,
    hp: state.player.hp, maxHp: state.player.maxHp, name: state.player.name, mine: true,
  });

  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.getElapsedTime();
    updateEntities(dt, t);
    updateCamera(dt);
    updateLabels();
    updatePropAnimations(t);
    three.renderer.render(three.scene, three.camera);
  }
  animate();
}

/* ------------------------------------------------------------ ZONE LOADING */

function clearZoneObjects() {
  world.npcs.forEach(function (n) { three.scene.remove(n.group); });
  world.npcs.clear();
  world.portals.forEach(function (p) { three.scene.remove(p.group); });
  world.portals = [];
  world.props.forEach(function (p) { three.scene.remove(p); });
  world.props = [];
  raycastTargets = [];
}

function loadZone(zoneStatic) {
  clearZoneObjects();
  var theme = ZONE_THEMES[zoneStatic.id] || ZONE_THEMES.racine_feuille;

  three.scene.background = new THREE.Color(theme.fog);
  three.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
  three.ambient.color.setHex(theme.ambient);
  three.sun.color.setHex(theme.sun);

  var groundSize = Math.max(state.constants.ZONE_W, state.constants.ZONE_H) * SCALE + 12;
  var ground = new THREE.Mesh(new THREE.CircleGeometry(groundSize / 1.6, 40), Models.toon(theme.ground));
  ground.rotation.x = -Math.PI / 2;
  three.scene.add(ground);
  world.props.push(ground);

  var halfW = state.constants.ZONE_W * SCALE / 2;
  var halfH = state.constants.ZONE_H * SCALE / 2;

  // NPC (position exacte serveur)
  (zoneStatic.npcs || []).forEach(function (npc) {
    var group = Models.buildNpc(npc.id);
    group.position.set(toWorldX(npc.x), 0, toWorldZ(npc.y));
    three.scene.add(group);
    var hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.set(0, 1.1, 0);
    hitbox.userData = { kind: "npc", id: npc.id };
    group.add(hitbox);
    raycastTargets.push(hitbox);
    world.npcs.set(npc.id, { group: group, def: npc });
  });

  // Portails (anneaux lumineux)
  (zoneStatic.portals || []).forEach(function (portal) {
    var group = Models.buildPortalRing();
    group.position.set(toWorldX(portal.x), 0, toWorldZ(portal.y));
    three.scene.add(group);
    world.portals.push({ group: group });
  });

  // Décor : arbres / rochers / huttes / murs
  function randomSpot(marginFromEdge) {
    return {
      x: (Math.random() - 0.5) * (state.constants.ZONE_W * SCALE - marginFromEdge * 2),
      z: (Math.random() - 0.5) * (state.constants.ZONE_H * SCALE - marginFromEdge * 2),
    };
  }
  var treeBuilder = theme.trees === "blossom" ? Models.buildBlossomTree
    : theme.trees === "pine" ? Models.buildPineTree
    : theme.trees === "dead" ? Models.buildDeadTree
    : null;
  if (treeBuilder) {
    for (var i = 0; i < theme.treeCount; i++) {
      var spot = randomSpot(3);
      if (Math.hypot(spot.x, spot.z) < 4) continue;
      var tree = treeBuilder(0.85 + Math.random() * 0.5);
      tree.position.set(spot.x, 0, spot.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      three.scene.add(tree);
      world.props.push(tree);
    }
  }
  for (var r = 0; r < (theme.rocks || 0); r++) {
    var rs = randomSpot(2);
    var rock = Models.buildRock(0.7 + Math.random() * 0.6);
    rock.position.set(rs.x, 0, rs.z);
    three.scene.add(rock);
    world.props.push(rock);
  }
  for (var h = 0; h < (theme.huts || 0); h++) {
    var hs = randomSpot(4);
    if (Math.hypot(hs.x, hs.z) < 5) continue;
    var hut = Models.buildHut(0.9 + Math.random() * 0.3);
    hut.position.set(hs.x, 0, hs.z);
    hut.rotation.y = Math.random() * Math.PI * 2;
    three.scene.add(hut);
    world.props.push(hut);
  }
  for (var w = 0; w < (theme.walls || 0); w++) {
    var angle = (w / theme.walls) * Math.PI * 2;
    var wall = Models.buildWallSegment(1);
    wall.position.set(Math.cos(angle) * halfW * 0.95, 0, Math.sin(angle) * halfH * 0.95);
    wall.rotation.y = angle;
    three.scene.add(wall);
    world.props.push(wall);
  }
  if (theme.lanterns) {
    [[-halfW * 0.4, halfH * 0.5], [halfW * 0.4, halfH * 0.5]].forEach(function (p) {
      var lantern = Models.buildLantern();
      lantern.position.set(p[0], 0, p[1]);
      three.scene.add(lantern);
      world.props.push(lantern);
    });
  }
  if (theme.torii) {
    var torii = Models.buildTorii(1);
    torii.position.set(0, 0, -halfH * 0.85);
    three.scene.add(torii);
    world.props.push(torii);
  }

  els["zone-name"].textContent = zoneStatic.name + " — Niv. " + zoneStatic.recommendedLevel;

  var spawnX = toWorldX(state.player.x);
  var spawnZ = toWorldZ(state.player.y);
  world.players.forEach(function (e, id) {
    if (id === MY_ID) {
      e.group.position.set(spawnX, 0, spawnZ);
      e.targetX = spawnX; e.targetZ = spawnZ;
      e.prevX = state.player.x; e.prevY = state.player.y;
    } else {
      three.scene.remove(e.group);
      removeLabel(e);
      world.players.delete(id);
    }
  });
  world.monsters.forEach(function (e) { three.scene.remove(e.group); removeLabel(e); });
  world.monsters.clear();
  closeBattlePanel();
}

socket.on("zone-changed", function (data) {
  state.zoneStatic = data.zoneStatic;
  loadZone(state.zoneStatic);
});

/* -------------------------------------------------------------- TICK RESEAU */

socket.on("zone-tick", function (data) {
  state.latestMonsters = data.monsters;
  syncPlayers(data.players);
  syncMonsters(data.monsters);
  updateBattlePanelTarget();
});

function syncPlayers(list) {
  var seen = {};
  list.forEach(function (p) {
    seen[p.id] = true;
    var e = world.players.get(p.id);
    if (!e) {
      var isMine = p.id === MY_ID;
      var group = Models.buildHero(p.classId);
      three.scene.add(group);
      e = {
        group: group, targetX: toWorldX(p.x), targetZ: toWorldZ(p.y), facing: 0, walkT: 0,
        prevX: p.x, prevY: p.y, mine: isMine, label: isMine ? null : makeLabel(false),
      };
      group.position.set(e.targetX, 0, e.targetZ);
      world.players.set(p.id, e);
    }
    e.targetX = toWorldX(p.x);
    e.targetZ = toWorldZ(p.y);
    e.moving = Math.hypot(p.x - e.prevX, p.y - e.prevY) > 0.5;
    if (e.moving) e.facing = Math.atan2(p.x - e.prevX, p.y - e.prevY);
    e.prevX = p.x; e.prevY = p.y;
    e.hp = p.hp; e.maxHp = p.maxHp; e.name = p.name + " Nv." + p.level; e.ko = p.ko;
  });
  world.players.forEach(function (e, id) {
    if (!seen[id]) { three.scene.remove(e.group); removeLabel(e); world.players.delete(id); }
  });
}

function syncMonsters(list) {
  var seen = {};
  list.forEach(function (m) {
    seen[m.instanceId] = true;
    var e = world.monsters.get(m.instanceId);
    if (!e) {
      var group = Models.buildMonster(m.templateId);
      three.scene.add(group);
      var hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.set(0, 1.1, 0);
      hitbox.userData = { kind: "monster", id: m.instanceId };
      group.add(hitbox);
      raycastTargets.push(hitbox);
      e = { group: group, targetX: toWorldX(m.x), targetZ: toWorldZ(m.y), label: makeLabel(!!m.boss) };
      group.position.set(e.targetX, 0, e.targetZ);
      world.monsters.set(m.instanceId, e);
    }
    e.hp = m.hp; e.maxHp = m.maxHp; e.name = m.name; e.inCombat = m.inCombat;
  });
  world.monsters.forEach(function (e, id) {
    if (!seen[id]) {
      three.scene.remove(e.group);
      removeLabel(e);
      raycastTargets = raycastTargets.filter(function (r) { return r.userData.id !== id; });
      world.monsters.delete(id);
      if (state.engagedMonsterId === id) closeBattlePanel();
    }
  });
}

/* --------------------------------------------------------------- ANIMATION */

function updateEntities(dt, t) {
  world.players.forEach(function (e) {
    var lerpSpeed = e.mine ? 8 : 6;
    e.group.position.x += (e.targetX - e.group.position.x) * Math.min(1, dt * lerpSpeed);
    e.group.position.z += (e.targetZ - e.group.position.z) * Math.min(1, dt * lerpSpeed);
    var diff = Math.atan2(Math.sin(e.facing - e.group.rotation.y), Math.cos(e.facing - e.group.rotation.y));
    e.group.rotation.y += diff * Math.min(1, dt * 8);
    var ud = e.group.userData;
    if (e.moving) e.walkT = (e.walkT || 0) + dt * 8; else e.walkT = (e.walkT || 0) * 0.9;
    ud.torso.position.y = ud.torsoBaseY + Math.sin(e.walkT) * 0.03;
    if (ud.legs) {
      ud.legs[0].rotation.x = Math.sin(e.walkT) * 0.5;
      ud.legs[1].rotation.x = -Math.sin(e.walkT) * 0.5;
    }
  });
  world.monsters.forEach(function (e, id) {
    var ud = e.group.userData;
    var phase = t * 1.6 + (hashCode(id) % 10);
    if (ud.floaty) {
      e.group.position.y = 0.15 + Math.sin(phase) * 0.1;
      e.group.rotation.y += dt * 0.4;
    } else if (ud.squish) {
      var s = 1 + Math.sin(phase * 1.5) * 0.06;
      e.group.scale.set(1, s, 1);
    } else if (ud.torso) {
      ud.torso.position.y = ud.torsoBaseY + Math.sin(phase) * 0.02;
    }
  });
}

function hashCode(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function updatePropAnimations(t) {
  world.portals.forEach(function (p) {
    p.group.rotation.y += 0.01;
    var ring = p.group.userData.ring;
    if (ring) ring.material.emissiveIntensity = 0.9 + Math.sin(t * 2) * 0.25;
  });
  world.props.forEach(function (p) {
    if (p.userData && p.userData.lamp) {
      p.userData.lamp.material.emissiveIntensity = 0.75 + Math.sin(t * 2 + p.id) * 0.15;
    }
  });
}

function updateCamera(dt) {
  var me = world.players.get(MY_ID);
  if (!me) return;
  var camOffset = new THREE.Vector3(0, 4.4, 7.2);
  var desired = new THREE.Vector3(me.group.position.x, 0, me.group.position.z).add(camOffset);
  three.camera.position.lerp(desired, Math.min(1, dt * 4));
  three.camera.lookAt(me.group.position.x, 1.1, me.group.position.z);
}

/* ------------------------------------------------------------------ LABELS */

function makeLabel(isBoss) {
  var el = document.createElement("div");
  el.className = "entity-label" + (isBoss ? " boss" : "");
  el.innerHTML = '<div class="l-name"></div><div class="l-bar-bg"><div class="l-bar-fill"></div></div>';
  els["labels-layer"].appendChild(el);
  return el;
}
function removeLabel(e) { if (e.label && e.label.parentNode) e.label.parentNode.removeChild(e.label); }

function updateLabels() {
  var vw = window.innerWidth, vh = window.innerHeight;
  function place(e, heightOffset) {
    var pos = new THREE.Vector3(e.group.position.x, heightOffset, e.group.position.z);
    pos.project(three.camera);
    if (pos.z > 1) { e.label.style.display = "none"; return; }
    e.label.style.display = "block";
    e.label.style.left = ((pos.x * 0.5 + 0.5) * vw) + "px";
    e.label.style.top = ((-pos.y * 0.5 + 0.5) * vh) + "px";
    e.label.querySelector(".l-name").textContent = e.name || "";
    var pct = e.maxHp ? Math.max(0, (e.hp / e.maxHp) * 100) : 0;
    var fill = e.label.querySelector(".l-bar-fill");
    fill.style.width = pct + "%";
    fill.classList.toggle("low", pct <= 30);
    e.label.classList.toggle("dim", !!e.ko);
  }
  world.players.forEach(function (e) { if (e.label) place(e, 2.2); });
  world.monsters.forEach(function (e) { place(e, 2.0); });
}

/* -------------------------------------------------------------- JOYSTICK */

function setupJoystick() {
  var base = els["joystick-base"];
  var knob = els["joystick-knob"];
  var radius = 42;
  var activeId = null;

  function setKnob(dx, dy) { knob.style.transform = "translate(calc(-50% + " + (dx * radius) + "px), calc(-50% + " + (dy * radius) + "px))"; }
  function handleMove(clientX, clientY) {
    var rect = base.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var dx = (clientX - cx) / radius, dy = (clientY - cy) / radius;
    var mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    setKnob(dx, dy);
    input.x = dx; input.y = dy;
  }
  base.addEventListener("pointerdown", function (e) {
    activeId = e.pointerId;
    base.setPointerCapture(activeId);
    handleMove(e.clientX, e.clientY);
  });
  base.addEventListener("pointermove", function (e) {
    if (e.pointerId !== activeId) return;
    handleMove(e.clientX, e.clientY);
  });
  function release(e) {
    if (e.pointerId !== activeId) return;
    activeId = null;
    setKnob(0, 0);
    input.x = 0; input.y = 0;
    socket.emit("move-input", { dx: 0, dy: 0 });
  }
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);
}

/* ---------------------------------------------------------- TAP POUR AGIR */

function setupTapToInteract() {
  var canvas = three.renderer.domElement;
  var downX = 0, downY = 0, moved = false;
  canvas.addEventListener("pointerdown", function (e) { downX = e.clientX; downY = e.clientY; moved = false; });
  canvas.addEventListener("pointermove", function (e) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
  });
  canvas.addEventListener("pointerup", function (e) {
    if (moved) return;
    var mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    three.raycaster.setFromCamera(mouse, three.camera);
    var hits = three.raycaster.intersectObjects(raycastTargets, false);
    if (hits.length === 0) return;
    var hit = hits[0].object.userData;
    if (hit.kind === "npc") talkNpc(hit.id);
    else if (hit.kind === "monster") engageMonster(hit.id);
  });
}

/* --------------------------------------------------------------- NPC ---- */

function talkNpc(npcId) {
  socket.emit("talk-npc", { npcId: npcId }, function (dialog) {
    if (dialog.error) { addLog("⚠ " + dialog.error); return; }
    els["npc-title"].textContent = dialog.name;
    els["npc-body"].innerHTML = "";
    if (dialog.type === "shop") renderShop(dialog); else renderQuestList(dialog);
    els["modal-npc"].classList.remove("hidden");
  });
}

function renderQuestList(dialog) {
  state.currentNpcId = dialog.npcId;
  if (dialog.quests.length === 0) { els["npc-body"].innerHTML = '<p class="hint">Rien à proposer pour l\'instant.</p>'; return; }
  dialog.quests.forEach(function (q) {
    var div = document.createElement("div");
    div.className = "quest-item";
    var action = "";
    if (q.status === "locked") action = '<span class="tag">Niveau ' + q.minLevel + ' requis</span>';
    else if (q.status === "available") action = '<button data-accept="' + q.id + '">Accepter</button>';
    else if (q.status === "inProgress") action = '<span class="tag">' + q.progress + "/" + q.count + "</span>";
    else if (q.status === "readyToTurnIn") action = '<button data-turnin="' + q.id + '">Récupérer la récompense</button>';
    else if (q.status === "turnedIn") action = '<span class="tag">Terminée ✓</span>';
    div.innerHTML = '<div class="q-name">' + q.name + '</div><div class="q-desc">' + q.desc + '</div>' +
      '<div class="q-meta">Récompense : ' + q.rewardXp + " XP, " + q.rewardGold + " or" + (q.rewardItem ? ", " + q.rewardItem : "") + "</div>" + action;
    els["npc-body"].appendChild(div);
  });
  Array.prototype.forEach.call(els["npc-body"].querySelectorAll("[data-accept]"), function (btn) {
    btn.addEventListener("click", function () {
      socket.emit("accept-quest", { questId: btn.dataset.accept }, function (res) {
        if (res.error) { addLog("⚠ " + res.error); return; }
        talkNpc(state.currentNpcId);
      });
    });
  });
  Array.prototype.forEach.call(els["npc-body"].querySelectorAll("[data-turnin]"), function (btn) {
    btn.addEventListener("click", function () {
      socket.emit("turn-in-quest", { questId: btn.dataset.turnin }, function (res) {
        if (res.error) { addLog("⚠ " + res.error); return; }
        state.player = res.player;
        renderHud();
        if (res.leveled) addLog("✨ Niveau " + state.player.level + " atteint !");
        talkNpc(state.currentNpcId);
      });
    });
  });
}

function renderShop(dialog) {
  state.currentNpcId = dialog.npcId;
  dialog.items.forEach(function (item) {
    var div = document.createElement("div");
    div.className = "shop-item";
    var stats = [];
    if (item.def) stats.push("DEF +" + item.def);
    if (item.hp) stats.push("PV +" + item.hp);
    if (item.atk) stats.push("ATQ +" + item.atk);
    div.innerHTML = '<div class="s-name">' + item.name + ' <span class="tag">' + SLOT_LABELS[item.slot] + '</span></div>' +
      '<div class="s-meta">' + stats.join(" · ") + '</div><div class="s-meta">💰 ' + item.price + '</div>' +
      '<button ' + (item.canAfford ? "" : "disabled") + ' data-buy="' + item.id + '">Acheter</button>';
    els["npc-body"].appendChild(div);
  });
  Array.prototype.forEach.call(els["npc-body"].querySelectorAll("[data-buy]"), function (btn) {
    btn.addEventListener("click", function () {
      socket.emit("buy-item", { itemId: btn.dataset.buy }, function (res) {
        if (res.error) { addLog("⚠ " + res.error); return; }
        state.player.gold = res.gold;
        state.player.inventory = res.inventory;
        renderHud();
        talkNpc(state.currentNpcId);
      });
    });
  });
}

els["btn-close-npc"].addEventListener("click", function () { els["modal-npc"].classList.add("hidden"); });

/* ------------------------------- SAC / EQUIP -------------------------------- */

els["btn-bag"].addEventListener("click", function () { renderBag(); els["modal-bag"].classList.remove("hidden"); });
els["btn-close-bag"].addEventListener("click", function () { els["modal-bag"].classList.add("hidden"); });

function renderBag() {
  var p = state.player;
  els["equip-slots"].innerHTML = "";
  Object.keys(SLOT_LABELS).forEach(function (slot) {
    var itemId = p.equipment[slot];
    var item = itemId ? state.items[itemId] : null;
    var div = document.createElement("div");
    div.className = "equip-slot" + (item ? " filled" : "");
    if (item) {
      var stats = [];
      if (item.def) stats.push("DEF +" + item.def);
      if (item.hp) stats.push("PV +" + item.hp);
      if (item.atk) stats.push("ATQ +" + item.atk);
      div.innerHTML = '<span class="slot-label">' + SLOT_LABELS[slot] + '</span>' + item.name + '<br>' + stats.join(" · ") + '<br><button data-unequip="' + slot + '">Retirer</button>';
    } else {
      div.innerHTML = '<span class="slot-label">' + SLOT_LABELS[slot] + '</span>Vide';
    }
    els["equip-slots"].appendChild(div);
  });
  Array.prototype.forEach.call(els["equip-slots"].querySelectorAll("[data-unequip]"), function (btn) {
    btn.addEventListener("click", function () {
      socket.emit("unequip-item", { slot: btn.dataset.unequip }, function (res) {
        if (res.error) { addLog("⚠ " + res.error); return; }
        applyEquipResult(res);
        renderBag();
      });
    });
  });

  els["inventory-list"].innerHTML = "";
  if (p.inventory.length === 0) els["inventory-list"].innerHTML = '<p class="hint">Ton sac est vide.</p>';
  p.inventory.forEach(function (itemId) {
    var item = state.items[itemId];
    if (!item) return;
    var div = document.createElement("div");
    div.className = "inv-item";
    var stats = [];
    if (item.def) stats.push("DEF +" + item.def);
    if (item.hp) stats.push("PV +" + item.hp);
    if (item.atk) stats.push("ATQ +" + item.atk);
    div.innerHTML = '<div class="i-name">' + item.name + ' <span class="tag">' + SLOT_LABELS[item.slot] + '</span></div><div class="q-meta">' + stats.join(" · ") + '</div><button data-equip="' + itemId + '">Équiper</button>';
    els["inventory-list"].appendChild(div);
  });
  Array.prototype.forEach.call(els["inventory-list"].querySelectorAll("[data-equip]"), function (btn) {
    btn.addEventListener("click", function () {
      socket.emit("equip-item", { itemId: btn.dataset.equip }, function (res) {
        if (res.error) { addLog("⚠ " + res.error); return; }
        applyEquipResult(res);
        renderBag();
      });
    });
  });
}

function applyEquipResult(res) {
  state.player.equipment = res.equipment;
  state.player.inventory = res.inventory;
  state.player.hp = res.hp; state.player.maxHp = res.maxHp;
  state.player.atk = res.atk; state.player.def = res.def;
  renderHud();
}

/* -------------------------------------------------------------- COMBAT ---- */

function engageMonster(instanceId) { state.engagedMonsterId = instanceId; openBattlePanel(); }

function openBattlePanel() {
  els["battle-panel"].classList.remove("hidden");
  renderBattleAbilities();
  updateBattlePanelTarget();
}
function closeBattlePanel() { state.engagedMonsterId = null; els["battle-panel"].classList.add("hidden"); }
els["btn-flee"].addEventListener("click", closeBattlePanel);

function isSelfAbility(ab) { return !!(ab.heal || ab.shield || ab.buff); }
function getBattleAbilities() {
  return [{ id: "attack", name: "Attaque", cost: 0, cooldownMs: 1200, desc: "Coup basique." }].concat(state.player.abilities);
}
function renderBattleAbilities() {
  els["battle-abilities"].innerHTML = "";
  getBattleAbilities().forEach(function (ab) {
    var btn = document.createElement("button");
    btn.className = "ability-btn";
    btn.dataset.abilityId = ab.id;
    btn.innerHTML = '<span class="ab-name">' + ab.name + '</span><span class="ab-cost">' + (ab.cost > 0 ? ab.cost + " PM" : "Gratuit") + '</span>';
    btn.title = ab.desc || "";
    btn.addEventListener("click", function () { useAbility(ab); });
    els["battle-abilities"].appendChild(btn);
  });
  updateBattleAbilityStates();
}
function updateBattleAbilityStates() {
  var p = state.player;
  getBattleAbilities().forEach(function (ab) {
    var btn = els["battle-abilities"].querySelector('[data-ability-id="' + ab.id + '"]');
    if (!btn) return;
    var onCooldown = (state.cooldownUntil[ab.id] || 0) > Date.now();
    var needsTarget = !isSelfAbility(ab) && !state.engagedMonsterId;
    var noMana = p.mana < ab.cost;
    btn.disabled = onCooldown || needsTarget || noMana;
  });
}
function useAbility(ab) {
  socket.emit("action", { monsterId: state.engagedMonsterId, abilityId: ab.id });
  state.cooldownUntil[ab.id] = Date.now() + (ab.cooldownMs || 1200);
}
function updateBattlePanelTarget() {
  if (!state.engagedMonsterId || els["battle-panel"].classList.contains("hidden")) return;
  var m = state.latestMonsters.filter(function (x) { return x.instanceId === state.engagedMonsterId; })[0];
  if (!m) { closeBattlePanel(); return; }
  els["battle-target-name"].textContent = m.emoji + " " + m.name;
  setBar(els["battle-target-hp"], m.hp, m.maxHp);
}
setInterval(function () { if (!els["battle-panel"].classList.contains("hidden")) updateBattleAbilityStates(); }, 400);
