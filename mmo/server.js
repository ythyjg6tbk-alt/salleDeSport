"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const D = require("./gameData");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 5;
const SAVE_PATH = path.join(__dirname, "data", "save.json");
const ATTACK_COOLDOWN_MS = 1200;

/* ------------------------------- PERSISTENCE ------------------------------ */

let saves = {};
try {
  if (fs.existsSync(SAVE_PATH)) {
    saves = JSON.parse(fs.readFileSync(SAVE_PATH, "utf8"));
  }
} catch (e) {
  console.error("Erreur de lecture de la sauvegarde :", e);
  saves = {};
}

function persistAll() {
  try {
    fs.mkdirSync(path.dirname(SAVE_PATH), { recursive: true });
    fs.writeFileSync(SAVE_PATH, JSON.stringify(saves, null, 2));
  } catch (e) {
    console.error("Erreur de sauvegarde :", e);
  }
}

function saveKeyFor(name) { return name.trim().toLowerCase(); }

function snapshotForSave(player) {
  return {
    classId: player.classId,
    level: player.level,
    xp: player.xp,
    gold: player.gold,
    equipment: player.equipment,
    inventory: player.inventory,
    questProgress: player.questProgress,
    zone: player.zone,
    x: player.x,
    y: player.y,
  };
}

function persistPlayer(player) {
  saves[saveKeyFor(player.name)] = snapshotForSave(player);
  persistAll();
}

/* --------------------------------- ETAT ----------------------------------- */

/** @type {Map<string, object>} socket.id -> player */
const players = new Map();

/** monstres vivants par zone : { [zoneId]: Map<instanceId, monster> } */
const monsters = {};
for (const zoneId of Object.keys(D.ZONES)) {
  const zone = D.ZONES[zoneId];
  monsters[zoneId] = new Map();
  (zone.monsters || []).forEach((spawn, i) => {
    const tpl = D.MONSTER_TEMPLATES[spawn.templateId];
    const instanceId = `${zoneId}_${spawn.templateId}_${i}`;
    monsters[zoneId].set(instanceId, {
      instanceId, templateId: spawn.templateId, zoneId,
      spawnX: spawn.x, spawnY: spawn.y, x: spawn.x, y: spawn.y,
      hp: tpl.hp, maxHp: tpl.hp, atk: tpl.atk, def: tpl.def,
      alive: true, respawnAt: null,
      participants: new Set(),
      lastRetaliateAt: 0,
      statuses: [],
    });
  });
}

/* ------------------------------- UTILITAIRES ------------------------------- */

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function effectiveStats(player) {
  const base = D.statsForLevel(player.classId, player.level);
  let hpBonus = 0, defBonus = 0, atkBonus = 0;
  for (const slot of Object.keys(player.equipment)) {
    const itemId = player.equipment[slot];
    if (!itemId) continue;
    const item = D.ITEMS[itemId];
    if (!item) continue;
    hpBonus += item.hp || 0;
    defBonus += item.def || 0;
    atkBonus += item.atk || 0;
  }
  let atk = base.atk + atkBonus;
  const atkup = player.statuses.find(s => s.key === "atkup");
  if (atkup) atk *= 1.3;
  if (player.classId === "samurai" && player.hp / player.maxHp < 0.3) atk *= 1.4;
  return {
    maxHp: Math.round(base.maxHp + hpBonus),
    maxMana: base.maxMana,
    atk: Math.round(atk * 10) / 10,
    def: Math.round((base.def + defBonus) * 10) / 10,
  };
}

function refreshStats(player, opts) {
  const stats = effectiveStats(player);
  const wasFull = player.hp >= player.maxHp;
  player.maxHp = stats.maxHp;
  player.maxMana = stats.maxMana;
  player.atk = stats.atk;
  player.def = stats.def;
  if (opts && opts.healFull) {
    player.hp = player.maxHp;
    player.mana = player.maxMana;
  } else {
    player.hp = clamp(player.hp, 0, player.maxHp);
    player.mana = clamp(player.mana, 0, player.maxMana);
    if (wasFull) player.hp = player.maxHp;
  }
}

function publicPlayer(player) {
  return {
    id: player.id, name: player.name, classId: player.classId,
    emoji: D.CLASSES[player.classId].emoji,
    level: player.level, x: Math.round(player.x), y: Math.round(player.y),
    hp: Math.round(player.hp), maxHp: player.maxHp, ko: player.ko,
    mana: Math.round(player.mana), maxMana: player.maxMana,
  };
}

function privatePlayerState(player) {
  return {
    name: player.name, classId: player.classId, level: player.level,
    xp: player.xp, xpToNext: D.xpToNextLevel(player.level),
    gold: player.gold, hp: Math.round(player.hp), maxHp: player.maxHp,
    mana: Math.round(player.mana), maxMana: player.maxMana,
    atk: player.atk, def: player.def,
    equipment: player.equipment, inventory: player.inventory,
    questProgress: player.questProgress,
    zone: player.zone, x: player.x, y: player.y,
    abilities: D.CLASSES[player.classId].abilities,
  };
}

function zoneRoom(zoneId) { return "zone:" + zoneId; }

function findSocket(playerId) {
  return io.sockets.sockets.get(playerId);
}

function grantXp(player, amount) {
  player.xp += amount;
  let leveled = false;
  while (player.level < D.MAX_LEVEL && player.xp >= D.xpToNextLevel(player.level)) {
    player.xp -= D.xpToNextLevel(player.level);
    player.level += 1;
    leveled = true;
  }
  if (player.level >= D.MAX_LEVEL) { player.level = D.MAX_LEVEL; player.xp = 0; }
  refreshStats(player, { healFull: leveled });
  return leveled;
}

function addQuestKillProgress(player, templateId) {
  const events = [];
  for (const questId of Object.keys(D.QUESTS)) {
    const quest = D.QUESTS[questId];
    const progress = player.questProgress[questId];
    if (!progress || progress.turnedIn || progress.done) continue;
    const matches = quest.type === "kill" ? quest.monster === templateId
      : quest.type === "kill-any" ? quest.monsters.includes(templateId)
      : false;
    if (!matches) continue;
    progress.count = Math.min(quest.count, progress.count + 1);
    if (progress.count >= quest.count) progress.done = true;
    events.push(questId);
  }
  return events;
}

/* --------------------------------- COMBAT ---------------------------------- */

function calcDamage(atk, def, mult, critChance) {
  let dmg = Math.max(1, Math.round(atk * mult - def * 0.5));
  if (critChance && Math.random() < critChance) dmg = Math.round(dmg * 1.5);
  return dmg;
}

function monsterDies(monster, io) {
  monster.alive = false;
  monster.hp = 0;
  monster.respawnAt = Date.now() + D.RESPAWN_MS;
  const tpl = D.MONSTER_TEMPLATES[monster.templateId];
  const rewardedPlayers = [];
  for (const playerId of monster.participants) {
    const player = players.get(playerId);
    if (!player) continue;
    const leveled = grantXp(player, tpl.xp);
    player.gold += tpl.gold;
    const questEvents = addQuestKillProgress(player, monster.templateId);
    rewardedPlayers.push(player);
    const sock = findSocket(playerId);
    if (sock) {
      sock.emit("player-state", privatePlayerState(player));
      sock.emit("combat-log", `${tpl.emoji} ${tpl.name} vaincu ! +${tpl.xp} XP, +${tpl.gold} or.` + (leveled ? ` Niveau ${player.level} !` : ""));
      if (questEvents.length) sock.emit("quest-progress", { questProgress: player.questProgress });
    }
  }
  monster.participants.clear();
}

function applyAbility(player, monster, abilityId) {
  const cls = D.CLASSES[player.classId];
  const ability = abilityId === "attack"
    ? { id: "attack", name: "Attaque", cost: 0, cooldownMs: ATTACK_COOLDOWN_MS, mult: 1 }
    : cls.abilities.find(a => a.id === abilityId);
  if (!ability) return { error: "Compétence inconnue." };

  const now = Date.now();
  const cd = player.cooldowns[ability.id] || 0;
  if (now < cd) return { error: "Compétence en recharge." };
  if (player.mana < ability.cost) return { error: "Mana insuffisant." };
  if (player.ko) return { error: "Vous êtes à terre." };

  const isSelfAbility = ability.heal || ability.shield || ability.buff;
  if (!isSelfAbility) {
    if (!monster || !monster.alive) return { error: "Cible invalide." };
    if (dist(player.x, player.y, monster.x, monster.y) > D.MONSTER_RADIUS * 1.8) {
      return { error: "Trop loin de la cible." };
    }
  }

  let freeCast = false;
  if (player.classId === "mage" && ability.cost > 0 && Math.random() < 0.15) freeCast = true;
  if (!freeCast) player.mana -= ability.cost;

  player.cooldowns[ability.id] = now + ability.cooldownMs;

  const logs = [];

  if (ability.heal) {
    const healAmt = Math.round(player.atk * (ability.mult || 2) + 15);
    player.hp = clamp(player.hp + healAmt, 0, player.maxHp);
    logs.push(`${player.name} se soigne de ${healAmt} PV.`);
    return { logs, selfUpdate: true };
  }
  if (ability.shield) {
    player.statuses = player.statuses.filter(s => s.key !== "bouclier");
    player.statuses.push({ key: "bouclier", amount: Math.round(player.def * 3 + 20), expiresAt: now + 8000 });
    logs.push(`${player.name} pose un bouclier protecteur.`);
    return { logs, selfUpdate: true };
  }
  if (ability.buff) {
    player.statuses = player.statuses.filter(s => s.key !== "atkup");
    player.statuses.push({ key: "atkup", expiresAt: now + 10000 });
    refreshStats(player);
    logs.push(`${player.name} chante un hymne de bravoure (ATQ augmentée).`);
    return { logs, selfUpdate: true };
  }

  const critChance = player.classId === "ninja" ? 0.2 : 0;
  let dmg = calcDamage(player.atk, monster.def, ability.mult || 1, critChance);

  const shield = monster.statuses.find(s => s.key === "bouclier");
  if (shield) {
    const absorbed = Math.min(shield.amount, dmg);
    shield.amount -= absorbed;
    dmg -= absorbed;
    if (shield.amount <= 0) monster.statuses = monster.statuses.filter(s => s !== shield);
  }

  monster.hp = clamp(monster.hp - dmg, 0, monster.maxHp);
  monster.participants.add(player.id);
  logs.push(`${player.name} inflige ${dmg} dégâts à ${D.MONSTER_TEMPLATES[monster.templateId].name}.`);

  if (ability.poison) {
    monster.statuses = monster.statuses.filter(s => s.key !== "poison");
    monster.statuses.push({ key: "poison", amount: Math.round(player.atk * 0.4), ticksLeft: 3, nextTickAt: now + 1500 });
  }
  if (ability.freeze && Math.random() < 0.25) {
    monster.statuses = monster.statuses.filter(s => s.key !== "etourdi");
    monster.statuses.push({ key: "etourdi", expiresAt: now + 2500 });
    logs.push(`${D.MONSTER_TEMPLATES[monster.templateId].name} est gelé !`);
  }
  if (ability.selfHealPct) {
    const healAmt = Math.round(player.maxHp * ability.selfHealPct);
    player.hp = clamp(player.hp + healAmt, 0, player.maxHp);
  }

  let died = false;
  if (monster.hp <= 0) {
    died = true;
    monsterDies(monster, io);
  }

  return { logs, monsterUpdate: true, died };
}

/* ---------------------------------- NPC ------------------------------------ */

function questStatusFor(player, questId) {
  const quest = D.QUESTS[questId];
  const progress = player.questProgress[questId];
  if (progress && progress.turnedIn) return "turnedIn";
  if (progress && progress.done) return "readyToTurnIn";
  if (progress) return "inProgress";
  if (player.level < quest.minLevel) return "locked";
  return "available";
}

function npcDialog(player, npc) {
  if (npc.shop) {
    return {
      type: "shop", npcId: npc.id, name: npc.name,
      items: npc.shop.map(itemId => ({ ...D.ITEMS[itemId], canAfford: player.gold >= (D.ITEMS[itemId].price || 0) })),
    };
  }
  return {
    type: "quest", npcId: npc.id, name: npc.name,
    quests: (npc.quests || []).map(questId => {
      const quest = D.QUESTS[questId];
      const progress = player.questProgress[questId];
      return {
        id: questId, name: quest.name, desc: quest.desc,
        minLevel: quest.minLevel, count: quest.count,
        progress: progress ? progress.count : 0,
        status: questStatusFor(player, questId),
        rewardXp: quest.rewardXp, rewardGold: quest.rewardGold,
        rewardItem: quest.rewardItem ? D.ITEMS[quest.rewardItem].name : null,
      };
    }),
  };
}

/* -------------------------------- SOCKET.IO --------------------------------- */

io.on("connection", (socket) => {
  socket.on("login", (data, ack) => {
    try {
      const name = String((data && data.name) || "").trim().slice(0, 16);
      const classId = data && data.classId;

      if (!name) return ack({ ok: false, error: "Choisis un nom." });
      if (!D.CLASSES[classId]) return ack({ ok: false, error: "Classe invalide." });

      for (const p of players.values()) {
        if (p.name.toLowerCase() === name.toLowerCase()) {
          return ack({ ok: false, error: "Ce nom est déjà connecté." });
        }
      }

      const existingSave = saves[saveKeyFor(name)];
      const finalClassId = existingSave ? existingSave.classId : classId;

      if (!existingSave) {
        const takenClasses = new Set([...players.values()].map(p => p.classId));
        if (takenClasses.has(classId)) {
          return ack({ ok: false, error: "Cette classe est déjà prise par un autre joueur connecté." });
        }
        if (players.size >= MAX_PLAYERS) {
          return ack({ ok: false, error: "Le monde est complet (5/5 joueurs)." });
        }
      } else if (players.size >= MAX_PLAYERS) {
        return ack({ ok: false, error: "Le monde est complet (5/5 joueurs)." });
      }

      const zoneId = (existingSave && D.ZONES[existingSave.zone]) ? existingSave.zone : "racine_feuille";
      const spawn = D.ZONES[zoneId].spawn;

      const player = {
        id: socket.id, name, classId: finalClassId,
        level: existingSave ? existingSave.level : 1,
        xp: existingSave ? existingSave.xp : 0,
        gold: existingSave ? existingSave.gold : 0,
        equipment: existingSave ? existingSave.equipment : { tete: null, torse: null, jambes: null, pieds: null },
        inventory: existingSave ? existingSave.inventory : [],
        questProgress: existingSave ? existingSave.questProgress : {},
        zone: zoneId,
        x: existingSave ? existingSave.x : spawn.x,
        y: existingSave ? existingSave.y : spawn.y,
        inputDir: { dx: 0, dy: 0 },
        cooldowns: {},
        statuses: [],
        ko: false, koUntil: 0,
        hp: 0, mana: 0, maxHp: 0, maxMana: 0, atk: 0, def: 0,
      };
      refreshStats(player, { healFull: true });
      players.set(socket.id, player);
      socket.join(zoneRoom(zoneId));

      ack({
        ok: true,
        player: privatePlayerState(player),
        classes: D.CLASSES,
        items: D.ITEMS,
        zoneStatic: D.ZONES[zoneId],
        constants: { ZONE_W: D.ZONE_W, ZONE_H: D.ZONE_H, MOVE_SPEED: D.MOVE_SPEED },
      });

      socket.to(zoneRoom(zoneId)).emit("combat-log", `${player.name} (${D.CLASSES[finalClassId].name}) arrive à ${D.ZONES[zoneId].name}.`);
    } catch (e) {
      console.error(e);
      ack({ ok: false, error: "Erreur serveur." });
    }
  });

  socket.on("move-input", (data) => {
    const player = players.get(socket.id);
    if (!player || player.ko) return;
    let dx = Number(data && data.dx) || 0;
    let dy = Number(data && data.dy) || 0;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    player.inputDir = { dx, dy };
  });

  socket.on("talk-npc", (data, ack) => {
    const player = players.get(socket.id);
    if (!player || typeof ack !== "function") return;
    const zone = D.ZONES[player.zone];
    const npc = (zone.npcs || []).find(n => n.id === (data && data.npcId));
    if (!npc) return ack({ error: "PNJ introuvable." });
    if (dist(player.x, player.y, npc.x, npc.y) > D.NPC_RADIUS * 1.8) return ack({ error: "Trop loin." });
    ack(npcDialog(player, npc));
  });

  socket.on("accept-quest", (data, ack) => {
    const player = players.get(socket.id);
    if (!player || typeof ack !== "function") return;
    const quest = D.QUESTS[data && data.questId];
    if (!quest) return ack({ error: "Quête introuvable." });
    if (player.questProgress[quest.id]) return ack({ error: "Quête déjà acceptée." });
    if (player.level < quest.minLevel) return ack({ error: "Niveau insuffisant." });
    player.questProgress[quest.id] = { count: 0, done: false, turnedIn: false };
    ack({ ok: true, questProgress: player.questProgress });
  });

  socket.on("turn-in-quest", (data, ack) => {
    const player = players.get(socket.id);
    if (!player || typeof ack !== "function") return;
    const quest = D.QUESTS[data && data.questId];
    const progress = player.questProgress[quest && quest.id];
    if (!quest || !progress) return ack({ error: "Quête introuvable." });
    if (progress.turnedIn) return ack({ error: "Déjà récupérée." });
    if (!progress.done) return ack({ error: "Quête non terminée." });
    progress.turnedIn = true;
    const leveled = grantXp(player, quest.rewardXp);
    player.gold += quest.rewardGold;
    if (quest.rewardItem) player.inventory.push(quest.rewardItem);
    ack({ ok: true, player: privatePlayerState(player), leveled });
  });

  socket.on("buy-item", (data, ack) => {
    const player = players.get(socket.id);
    if (!player || typeof ack !== "function") return;
    const item = D.ITEMS[data && data.itemId];
    if (!item || !item.price) return ack({ error: "Objet indisponible." });
    if (player.gold < item.price) return ack({ error: "Or insuffisant." });
    player.gold -= item.price;
    player.inventory.push(item.id);
    ack({ ok: true, gold: player.gold, inventory: player.inventory });
  });

  socket.on("equip-item", (data, ack) => {
    const player = players.get(socket.id);
    if (!player || typeof ack !== "function") return;
    const itemId = data && data.itemId;
    const item = D.ITEMS[itemId];
    const idx = player.inventory.indexOf(itemId);
    if (!item || idx === -1) return ack({ error: "Objet introuvable dans l'inventaire." });
    player.inventory.splice(idx, 1);
    const previous = player.equipment[item.slot];
    if (previous) player.inventory.push(previous);
    player.equipment[item.slot] = itemId;
    refreshStats(player);
    ack({ ok: true, equipment: player.equipment, inventory: player.inventory, hp: Math.round(player.hp), maxHp: player.maxHp, atk: player.atk, def: player.def });
  });

  socket.on("unequip-item", (data, ack) => {
    const player = players.get(socket.id);
    if (!player || typeof ack !== "function") return;
    const slot = data && data.slot;
    const itemId = player.equipment[slot];
    if (!itemId) return ack({ error: "Rien à retirer." });
    player.equipment[slot] = null;
    player.inventory.push(itemId);
    refreshStats(player);
    ack({ ok: true, equipment: player.equipment, inventory: player.inventory, hp: Math.round(player.hp), maxHp: player.maxHp, atk: player.atk, def: player.def });
  });

  socket.on("action", (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    const monsterId = data && data.monsterId;
    const monster = monsterId ? monsters[player.zone].get(monsterId) : null;
    const result = applyAbility(player, monster, data && data.abilityId);
    if (result.error) {
      socket.emit("action-error", result.error);
      return;
    }
    (result.logs || []).forEach(msg => io.to(zoneRoom(player.zone)).emit("combat-log", msg));
    socket.emit("player-state", privatePlayerState(player));
  });

  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    if (!player) return;
    persistPlayer(player);
    players.delete(socket.id);
    for (const m of monsters[player.zone].values()) m.participants.delete(player.id);
    io.to(zoneRoom(player.zone)).emit("combat-log", `${player.name} quitte le monde.`);
  });
});

/* --------------------------------- BOUCLE ----------------------------------- */

let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // KO recovery
  for (const player of players.values()) {
    if (player.ko && now >= player.koUntil) {
      player.ko = false;
      const spawn = D.ZONES[player.zone].spawn;
      player.x = spawn.x; player.y = spawn.y;
      player.hp = Math.round(player.maxHp * 0.3);
      const sock = findSocket(player.id);
      if (sock) sock.emit("player-state", privatePlayerState(player));
    }
    player.statuses = player.statuses.filter(s => !s.expiresAt || s.expiresAt > now);
  }

  // mouvement + portails + régénération passive
  for (const player of players.values()) {
    if (player.ko) continue;
    if (player.classId === "priestess" && player.hp < player.maxHp) {
      player.hp = clamp(player.hp + 1.5 * dt, 0, player.maxHp);
    }
    if (player.classId === "bard" && player.mana < player.maxMana) {
      player.mana = clamp(player.mana + 1.5 * dt, 0, player.maxMana);
    }
    const { dx, dy } = player.inputDir;
    if (dx || dy) {
      player.x = clamp(player.x + dx * D.MOVE_SPEED * dt, 16, D.ZONE_W - 16);
      player.y = clamp(player.y + dy * D.MOVE_SPEED * dt, 16, D.ZONE_H - 16);
    }
    const zone = D.ZONES[player.zone];
    for (const portal of zone.portals || []) {
      if (dist(player.x, player.y, portal.x, portal.y) < D.PORTAL_RADIUS) {
        const sock = findSocket(player.id);
        if (sock) sock.leave(zoneRoom(player.zone));
        for (const m of monsters[player.zone].values()) m.participants.delete(player.id);
        player.zone = portal.toZone;
        player.x = portal.toX;
        player.y = portal.toY;
        if (sock) {
          sock.join(zoneRoom(player.zone));
          sock.emit("zone-changed", { zoneStatic: D.ZONES[player.zone] });
        }
        break;
      }
    }
  }

  // monstres : poison + regen légère + retaliation
  for (const zoneId of Object.keys(monsters)) {
    for (const monster of monsters[zoneId].values()) {
      if (!monster.alive) {
        if (monster.respawnAt && now >= monster.respawnAt) {
          monster.alive = true;
          monster.hp = monster.maxHp;
          monster.respawnAt = null;
          monster.x = monster.spawnX; monster.y = monster.spawnY;
        }
        continue;
      }

      monster.statuses = monster.statuses.filter(s => !s.expiresAt || s.expiresAt > now);

      for (const s of monster.statuses.slice()) {
        if (s.key === "poison" && s.nextTickAt <= now) {
          monster.hp = clamp(monster.hp - s.amount, 0, monster.maxHp);
          s.ticksLeft -= 1;
          s.nextTickAt = now + 1500;
          if (s.ticksLeft <= 0) monster.statuses = monster.statuses.filter(x => x !== s);
          if (monster.hp <= 0) monsterDies(monster, io);
        }
      }
      if (!monster.alive) continue;

      const stunned = monster.statuses.some(s => s.key === "etourdi" && s.expiresAt > now);
      if (stunned) continue;

      if (monster.participants.size > 0 && now - monster.lastRetaliateAt >= D.RETALIATE_MS) {
        monster.lastRetaliateAt = now;
        for (const pid of [...monster.participants]) {
          const p = players.get(pid);
          if (!p || p.zone !== zoneId || dist(p.x, p.y, monster.x, monster.y) > D.MONSTER_RADIUS * 3) {
            monster.participants.delete(pid);
          }
        }
        const candidates = [...monster.participants]
          .map(id => players.get(id))
          .filter(p => p && !p.ko);
        if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          const tpl = D.MONSTER_TEMPLATES[monster.templateId];
          let dmg = Math.max(1, Math.round(tpl.atk - target.def * 0.5));
          const shield = target.statuses.find(s => s.key === "bouclier");
          if (shield) {
            const absorbed = Math.min(shield.amount, dmg);
            shield.amount -= absorbed; dmg -= absorbed;
            if (shield.amount <= 0) target.statuses = target.statuses.filter(s => s !== shield);
          }
          target.hp = clamp(target.hp - dmg, 0, target.maxHp);
          if (tpl.poisonAtk && Math.random() < 0.35) {
            target.statuses = target.statuses.filter(s => s.key !== "poisoned");
            target.statuses.push({ key: "poisoned", amount: Math.round(tpl.atk * 0.3), ticksLeft: 3, nextTickAt: now + 1500 });
          }
          io.to(zoneRoom(zoneId)).emit("combat-log", `${tpl.emoji} ${tpl.name} attaque ${target.name} pour ${dmg} dégâts.`);
          if (target.hp <= 0 && !target.ko) {
            target.ko = true;
            target.koUntil = now + D.KO_MS;
            io.to(zoneRoom(zoneId)).emit("combat-log", `💀 ${target.name} est à terre.`);
          }
          const sock = findSocket(target.id);
          if (sock) sock.emit("player-state", privatePlayerState(target));
        } else {
          monster.participants.clear();
        }
      }
    }
  }

  // poison sur joueurs
  for (const player of players.values()) {
    for (const s of player.statuses.slice()) {
      if (s.key === "poisoned" && s.nextTickAt <= now) {
        player.hp = clamp(player.hp - s.amount, 0, player.maxHp);
        s.ticksLeft -= 1;
        s.nextTickAt = now + 1500;
        if (s.ticksLeft <= 0) player.statuses = player.statuses.filter(x => x !== s);
        if (player.hp <= 0 && !player.ko) {
          player.ko = true;
          player.koUntil = now + D.KO_MS;
        }
        const sock = findSocket(player.id);
        if (sock) sock.emit("player-state", privatePlayerState(player));
      }
    }
  }

  // diffusion par zone
  for (const zoneId of Object.keys(D.ZONES)) {
    const room = io.sockets.adapter.rooms.get(zoneRoom(zoneId));
    if (!room || room.size === 0) continue;
    const zonePlayers = [...players.values()].filter(p => p.zone === zoneId).map(publicPlayer);
    const zoneMonsters = [...monsters[zoneId].values()].filter(m => m.alive).map(m => ({
      instanceId: m.instanceId, templateId: m.templateId,
      name: D.MONSTER_TEMPLATES[m.templateId].name, emoji: D.MONSTER_TEMPLATES[m.templateId].emoji,
      x: Math.round(m.x), y: Math.round(m.y), hp: Math.round(m.hp), maxHp: m.maxHp,
      inCombat: m.participants.size > 0, boss: !!D.MONSTER_TEMPLATES[m.templateId].boss,
    }));
    io.to(zoneRoom(zoneId)).emit("zone-tick", { players: zonePlayers, monsters: zoneMonsters });
  }
}, D.TICK_MS);

setInterval(() => {
  for (const player of players.values()) persistPlayer(player);
}, 30000);

process.on("SIGINT", () => { for (const p of players.values()) persistPlayer(p); process.exit(0); });
process.on("SIGTERM", () => { for (const p of players.values()) persistPlayer(p); process.exit(0); });

server.listen(PORT, () => {
  console.log(`Les 5 Gardiens - serveur MMO en écoute sur le port ${PORT}`);
});
