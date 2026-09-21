"use strict";

const CLASS_OPTIONS = [
  { id: "samurai", emoji: "🐗", name: "Samurai Sanglier" },
  { id: "priestess", emoji: "🦌", name: "Prêtresse Biche" },
  { id: "ninja", emoji: "🦊", name: "Renard Ninja" },
  { id: "mage", emoji: "🦦", name: "Loutre Mage" },
  { id: "bard", emoji: "🐉", name: "Dragon Barde" },
];

const SLOT_LABELS = { tete: "Tête", torse: "Torse", jambes: "Jambes", pieds: "Pieds" };

const socket = io();

const state = {
  selectedClass: null,
  player: null,
  items: {},
  zoneStatic: null,
  latestPlayers: [],
  latestMonsters: [],
  engagedMonsterId: null,
  cooldownUntil: {},
};

const els = {};
["screen-login", "screen-game", "input-name", "class-grid", "btn-login", "login-error",
 "hud-emoji", "hud-name", "hud-hp", "hud-mp", "hud-xp", "hud-level", "hud-gold",
 "zone-name", "viewport", "combat-log", "joystick-base", "joystick-knob", "btn-bag",
 "battle-panel", "battle-target-name", "battle-target-hp", "battle-abilities", "btn-flee",
 "modal-npc", "npc-title", "npc-body", "btn-close-npc",
 "modal-bag", "equip-slots", "inventory-list", "btn-close-bag",
].forEach(id => { els[id] = document.getElementById(id); });

/* ------------------------------- LOGIN SCREEN ------------------------------ */

function renderClassGrid() {
  els["class-grid"].innerHTML = "";
  CLASS_OPTIONS.forEach(c => {
    const card = document.createElement("div");
    card.className = "class-card" + (state.selectedClass === c.id ? " selected" : "");
    card.innerHTML = `<span class="emoji">${c.emoji}</span><span class="cname">${c.name}</span>`;
    card.addEventListener("click", () => {
      state.selectedClass = c.id;
      renderClassGrid();
    });
    els["class-grid"].appendChild(card);
  });
}
renderClassGrid();

els["btn-login"].addEventListener("click", () => {
  const name = els["input-name"].value.trim();
  if (!name) { els["login-error"].textContent = "Choisis un nom."; return; }
  if (!state.selectedClass) { els["login-error"].textContent = "Choisis une classe."; return; }
  els["login-error"].textContent = "";
  socket.emit("login", { name, classId: state.selectedClass }, (res) => {
    if (!res.ok) { els["login-error"].textContent = res.error; return; }
    state.player = res.player;
    state.items = res.items;
    state.zoneStatic = res.zoneStatic;
    els["screen-login"].classList.remove("active");
    els["screen-game"].classList.add("active");
    renderZoneStatic();
    renderHud();
  });
});

/* ---------------------------------- HUD ------------------------------------ */

function renderHud() {
  const p = state.player;
  if (!p) return;
  const cls = CLASS_OPTIONS.find(c => c.id === p.classId);
  els["hud-emoji"].textContent = cls ? cls.emoji : "❓";
  els["hud-name"].textContent = p.name;
  setBar(els["hud-hp"], p.hp, p.maxHp);
  setBar(els["hud-mp"], p.mana, p.maxMana);
  setBar(els["hud-xp"], p.xp, p.xpToNext);
  els["hud-level"].textContent = "Niv. " + p.level;
  els["hud-gold"].textContent = "💰 " + p.gold;
}

function setBar(el, value, max) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  el.style.width = pct + "%";
  el.classList.toggle("low", pct <= 30);
}

socket.on("player-state", (p) => {
  state.player = p;
  renderHud();
});

/* -------------------------------- LOG ------------------------------------- */

socket.on("combat-log", (msg) => addLog(msg));
socket.on("action-error", (msg) => addLog("⚠ " + msg));

function addLog(msg) {
  const p = document.createElement("p");
  p.textContent = msg;
  els["combat-log"].appendChild(p);
  els["combat-log"].scrollTop = els["combat-log"].scrollHeight;
  while (els["combat-log"].children.length > 40) els["combat-log"].removeChild(els["combat-log"].firstChild);
}

/* ------------------------------ ZONE / MONDE -------------------------------- */

const dom = { npcs: new Map(), portals: new Map(), players: new Map(), monsters: new Map() };

function renderZoneStatic() {
  const zone = state.zoneStatic;
  els["zone-name"].textContent = `${zone.name} — Niv. ${zone.recommendedLevel}`;
  els["viewport"].classList.toggle("wild", zone.type === "wild");
  els["viewport"].innerHTML = "";
  dom.npcs.clear(); dom.portals.clear(); dom.players.clear(); dom.monsters.clear();

  (zone.npcs || []).forEach(npc => {
    const el = document.createElement("div");
    el.className = "entity npc";
    el.style.left = npc.x + "px"; el.style.top = npc.y + "px";
    el.innerHTML = `<span class="e-icon">${npc.emoji}</span><span class="e-label">${npc.name}</span>`;
    el.addEventListener("click", () => talkNpc(npc.id));
    els["viewport"].appendChild(el);
    dom.npcs.set(npc.id, el);
  });

  (zone.portals || []).forEach((portal, i) => {
    const el = document.createElement("div");
    el.className = "entity portal";
    el.style.left = portal.x + "px"; el.style.top = portal.y + "px";
    el.innerHTML = `<span class="e-icon">🌀</span><span class="e-label">${portal.label}</span>`;
    els["viewport"].appendChild(el);
    dom.portals.set(i, el);
  });

  closeBattlePanel();
}

socket.on("zone-changed", (data) => {
  state.zoneStatic = data.zoneStatic;
  renderZoneStatic();
});

socket.on("zone-tick", (data) => {
  state.latestPlayers = data.players;
  state.latestMonsters = data.monsters;
  renderPlayers(data.players);
  renderMonsters(data.monsters);
  updateBattlePanelTarget();
});

function renderPlayers(list) {
  const seen = new Set();
  list.forEach(p => {
    seen.add(p.id);
    let el = dom.players.get(p.id);
    const isMe = state.player && socket.id === p.id;
    if (!el) {
      el = document.createElement("div");
      el.className = "entity player";
      el.innerHTML = `<span class="e-icon"></span><span class="e-label"></span><div class="e-bar"><div class="e-bar-fill"></div></div>`;
      els["viewport"].appendChild(el);
      dom.players.set(p.id, el);
    }
    el.classList.toggle("me", isMe);
    el.classList.toggle("ko", p.ko);
    if (isMe && state.player) {
      state.player.hp = p.hp; state.player.maxHp = p.maxHp;
      state.player.mana = p.mana; state.player.maxMana = p.maxMana;
      renderHud();
    }
    el.style.left = p.x + "px"; el.style.top = p.y + "px";
    el.querySelector(".e-icon").textContent = p.emoji;
    el.querySelector(".e-label").textContent = `${p.name} Nv.${p.level}`;
    const pct = Math.max(0, (p.hp / p.maxHp) * 100);
    const fill = el.querySelector(".e-bar-fill");
    fill.style.width = pct + "%";
    fill.classList.toggle("low", pct <= 30);
  });
  for (const [id, el] of dom.players) {
    if (!seen.has(id)) { el.remove(); dom.players.delete(id); }
  }
}

function renderMonsters(list) {
  const seen = new Set();
  list.forEach(m => {
    seen.add(m.instanceId);
    let el = dom.monsters.get(m.instanceId);
    if (!el) {
      el = document.createElement("div");
      el.className = "entity monster";
      el.innerHTML = `<span class="e-icon"></span><span class="e-label"></span><div class="e-bar"><div class="e-bar-fill"></div></div>`;
      el.addEventListener("click", () => engageMonster(m.instanceId));
      els["viewport"].appendChild(el);
      dom.monsters.set(m.instanceId, el);
    }
    el.classList.toggle("combat", m.inCombat);
    el.style.left = m.x + "px"; el.style.top = m.y + "px";
    el.querySelector(".e-icon").textContent = m.emoji;
    el.querySelector(".e-label").textContent = m.name + (m.boss ? " 👑" : "");
    const pct = Math.max(0, (m.hp / m.maxHp) * 100);
    const fill = el.querySelector(".e-bar-fill");
    fill.style.width = pct + "%";
    fill.classList.toggle("low", pct <= 30);
  });
  for (const [id, el] of dom.monsters) {
    if (!seen.has(id)) { el.remove(); dom.monsters.delete(id); }
  }
}

/* -------------------------------- JOYSTICK --------------------------------- */

(function setupJoystick() {
  const base = els["joystick-base"];
  const knob = els["joystick-knob"];
  const radius = 42;
  let activeId = null;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx * radius}px), calc(-50% + ${dy * radius}px))`;
  }

  function handleMove(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / radius;
    let dy = (clientY - cy) / radius;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    setKnob(dx, dy);
    socket.emit("move-input", { dx, dy });
  }

  base.addEventListener("pointerdown", (e) => {
    activeId = e.pointerId;
    base.setPointerCapture(activeId);
    handleMove(e.clientX, e.clientY);
  });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activeId) return;
    handleMove(e.clientX, e.clientY);
  });
  function release(e) {
    if (e.pointerId !== activeId) return;
    activeId = null;
    setKnob(0, 0);
    socket.emit("move-input", { dx: 0, dy: 0 });
  }
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);
})();

/* --------------------------------- NPC -------------------------------------- */

function talkNpc(npcId) {
  socket.emit("talk-npc", { npcId }, (dialog) => {
    if (dialog.error) { addLog("⚠ " + dialog.error); return; }
    els["npc-title"].textContent = dialog.name;
    els["npc-body"].innerHTML = "";
    if (dialog.type === "shop") renderShop(dialog);
    else renderQuestList(dialog);
    els["modal-npc"].classList.remove("hidden");
  });
}

function renderQuestList(dialog) {
  if (dialog.quests.length === 0) {
    els["npc-body"].innerHTML = '<p class="hint">Rien à proposer pour l\'instant.</p>';
    return;
  }
  dialog.quests.forEach(q => {
    const div = document.createElement("div");
    div.className = "quest-item";
    let action = "";
    if (q.status === "locked") action = `<span class="tag">Niveau ${q.minLevel} requis</span>`;
    else if (q.status === "available") action = `<button data-accept="${q.id}">Accepter</button>`;
    else if (q.status === "inProgress") action = `<span class="tag">${q.progress}/${q.count}</span>`;
    else if (q.status === "readyToTurnIn") action = `<button data-turnin="${q.id}">Récupérer la récompense</button>`;
    else if (q.status === "turnedIn") action = `<span class="tag">Terminée ✓</span>`;

    div.innerHTML = `
      <div class="q-name">${q.name}</div>
      <div class="q-desc">${q.desc}</div>
      <div class="q-meta">Récompense : ${q.rewardXp} XP, ${q.rewardGold} or${q.rewardItem ? ", " + q.rewardItem : ""}</div>
      ${action}
    `;
    els["npc-body"].appendChild(div);
  });

  els["npc-body"].querySelectorAll("[data-accept]").forEach(btn => {
    btn.addEventListener("click", () => {
      socket.emit("accept-quest", { questId: btn.dataset.accept }, (res) => {
        if (res.error) { addLog("⚠ " + res.error); return; }
        talkNpc(dialog.npcId);
      });
    });
  });
  els["npc-body"].querySelectorAll("[data-turnin]").forEach(btn => {
    btn.addEventListener("click", () => {
      socket.emit("turn-in-quest", { questId: btn.dataset.turnin }, (res) => {
        if (res.error) { addLog("⚠ " + res.error); return; }
        state.player = res.player;
        renderHud();
        if (res.leveled) addLog(`✨ Niveau ${state.player.level} atteint !`);
        talkNpc(dialog.npcId);
      });
    });
  });
}

function renderShop(dialog) {
  dialog.items.forEach(item => {
    const div = document.createElement("div");
    div.className = "shop-item";
    const stats = [];
    if (item.def) stats.push(`DEF +${item.def}`);
    if (item.hp) stats.push(`PV +${item.hp}`);
    if (item.atk) stats.push(`ATQ +${item.atk}`);
    div.innerHTML = `
      <div class="s-name">${item.name} <span class="tag">${SLOT_LABELS[item.slot]}</span></div>
      <div class="s-meta">${stats.join(" · ")}</div>
      <div class="s-meta">💰 ${item.price}</div>
      <button ${item.canAfford ? "" : "disabled"} data-buy="${item.id}">Acheter</button>
    `;
    els["npc-body"].appendChild(div);
  });
  els["npc-body"].querySelectorAll("[data-buy]").forEach(btn => {
    btn.addEventListener("click", () => {
      socket.emit("buy-item", { itemId: btn.dataset.buy }, (res) => {
        if (res.error) { addLog("⚠ " + res.error); return; }
        state.player.gold = res.gold;
        state.player.inventory = res.inventory;
        renderHud();
        talkNpc(dialog.npcId);
      });
    });
  });
}

els["btn-close-npc"].addEventListener("click", () => els["modal-npc"].classList.add("hidden"));

/* ------------------------------- SAC / EQUIP -------------------------------- */

els["btn-bag"].addEventListener("click", () => {
  renderBag();
  els["modal-bag"].classList.remove("hidden");
});
els["btn-close-bag"].addEventListener("click", () => els["modal-bag"].classList.add("hidden"));

function renderBag() {
  const p = state.player;
  els["equip-slots"].innerHTML = "";
  Object.keys(SLOT_LABELS).forEach(slot => {
    const itemId = p.equipment[slot];
    const item = itemId ? state.items[itemId] : null;
    const div = document.createElement("div");
    div.className = "equip-slot" + (item ? " filled" : "");
    if (item) {
      const stats = [];
      if (item.def) stats.push(`DEF +${item.def}`);
      if (item.hp) stats.push(`PV +${item.hp}`);
      if (item.atk) stats.push(`ATQ +${item.atk}`);
      div.innerHTML = `<span class="slot-label">${SLOT_LABELS[slot]}</span>${item.name}<br>${stats.join(" · ")}<br><button data-unequip="${slot}">Retirer</button>`;
    } else {
      div.innerHTML = `<span class="slot-label">${SLOT_LABELS[slot]}</span>Vide`;
    }
    els["equip-slots"].appendChild(div);
  });
  els["equip-slots"].querySelectorAll("[data-unequip]").forEach(btn => {
    btn.addEventListener("click", () => {
      socket.emit("unequip-item", { slot: btn.dataset.unequip }, (res) => {
        if (res.error) { addLog("⚠ " + res.error); return; }
        applyEquipResult(res);
        renderBag();
      });
    });
  });

  els["inventory-list"].innerHTML = "";
  if (p.inventory.length === 0) {
    els["inventory-list"].innerHTML = '<p class="hint">Ton sac est vide.</p>';
  }
  p.inventory.forEach((itemId, idx) => {
    const item = state.items[itemId];
    if (!item) return;
    const div = document.createElement("div");
    div.className = "inv-item";
    const stats = [];
    if (item.def) stats.push(`DEF +${item.def}`);
    if (item.hp) stats.push(`PV +${item.hp}`);
    if (item.atk) stats.push(`ATQ +${item.atk}`);
    div.innerHTML = `<div class="i-name">${item.name} <span class="tag">${SLOT_LABELS[item.slot]}</span></div><div class="q-meta">${stats.join(" · ")}</div><button data-equip="${itemId}">Équiper</button>`;
    els["inventory-list"].appendChild(div);
  });
  els["inventory-list"].querySelectorAll("[data-equip]").forEach(btn => {
    btn.addEventListener("click", () => {
      socket.emit("equip-item", { itemId: btn.dataset.equip }, (res) => {
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

/* -------------------------------- COMBAT ------------------------------------ */

function engageMonster(instanceId) {
  state.engagedMonsterId = instanceId;
  openBattlePanel();
}

function openBattlePanel() {
  els["battle-panel"].classList.remove("hidden");
  renderBattleAbilities();
  updateBattlePanelTarget();
}
function closeBattlePanel() {
  state.engagedMonsterId = null;
  els["battle-panel"].classList.add("hidden");
}
els["btn-flee"].addEventListener("click", closeBattlePanel);

function isSelfAbility(ab) { return !!(ab.heal || ab.shield || ab.buff); }

function getBattleAbilities() {
  const basic = { id: "attack", name: "Attaque", cost: 0, cooldownMs: 1200, desc: "Coup basique." };
  return [basic, ...state.player.abilities];
}

function renderBattleAbilities() {
  els["battle-abilities"].innerHTML = "";
  getBattleAbilities().forEach(ab => {
    const btn = document.createElement("button");
    btn.className = "ability-btn";
    btn.dataset.abilityId = ab.id;
    btn.innerHTML = `<span class="ab-name">${ab.name}</span><span class="ab-cost">${ab.cost > 0 ? ab.cost + " PM" : "Gratuit"}</span>`;
    btn.title = ab.desc || "";
    btn.addEventListener("click", () => useAbility(ab));
    els["battle-abilities"].appendChild(btn);
  });
  updateBattleAbilityStates();
}

function updateBattleAbilityStates() {
  const p = state.player;
  getBattleAbilities().forEach(ab => {
    const btn = els["battle-abilities"].querySelector(`[data-ability-id="${ab.id}"]`);
    if (!btn) return;
    const onCooldown = (state.cooldownUntil[ab.id] || 0) > Date.now();
    const needsTarget = !isSelfAbility(ab) && !state.engagedMonsterId;
    const noMana = p.mana < ab.cost;
    btn.disabled = onCooldown || needsTarget || noMana;
  });
}

function useAbility(ab) {
  socket.emit("action", { monsterId: state.engagedMonsterId, abilityId: ab.id });
  state.cooldownUntil[ab.id] = Date.now() + (ab.cooldownMs || 1200);
}

function updateBattlePanelTarget() {
  if (!state.engagedMonsterId || els["battle-panel"].classList.contains("hidden")) return;
  const m = state.latestMonsters.find(x => x.instanceId === state.engagedMonsterId);
  if (!m) { closeBattlePanel(); return; }
  els["battle-target-name"].textContent = `${m.emoji} ${m.name}`;
  setBar(els["battle-target-hp"], m.hp, m.maxHp);
}

setInterval(() => {
  if (!els["battle-panel"].classList.contains("hidden")) updateBattleAbilityStates();
}, 400);
