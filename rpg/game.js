"use strict";

/* =========================================================================
   LES 5 GARDIENS — RPG fantastique tour par tour, à jouer à 5 sur un mobile
   ========================================================================= */

/* ----------------------------- DONNEES CLASSES -------------------------- */

const HERO_TEMPLATES = [
  {
    id: "samurai",
    emoji: "🐗",
    name: "Samurai Sanglier",
    className: "Guerrier",
    baseHp: 150, baseAtk: 17, baseDef: 13, baseSpd: 8, baseMana: 30,
    passive: {
      name: "Rage du Sanglier",
      desc: "ATQ +40% quand les PV passent sous 30%.",
    },
    abilities: [
      { id: "charge", name: "Charge Enragée", cost: 25, target: "enemy",
        desc: "Dégâts x1.8, 30% de chance d'étourdir.",
        exec(user, target, ctx) {
          const dmg = calcDamage(user, target, 1.8);
          const stunned = dealDamage(target, dmg, ctx);
          ctx.log(`${user.name} charge ${target.name} pour ${dmg} dégâts !`, true);
          if (!stunned && Math.random() < 0.3) {
            addStatus(target, "etourdi", 1);
            ctx.log(`${target.name} est étourdi !`);
          }
        } },
      { id: "garde", name: "Garde Inébranlable", cost: 20, target: "self",
        desc: "DEF +50% (2 tours) et provoque les ennemis.",
        exec(user, target, ctx) {
          addStatus(user, "defup", 2, { mult: 1.5 });
          addStatus(user, "provocation", 1);
          ctx.log(`${user.name} hausse sa garde et provoque l'ennemi !`, true);
        } },
      { id: "tranchant", name: "Tranchant du Sanglier", cost: 30, target: "all-enemies",
        desc: "Dégâts x0.9 à tous les ennemis.",
        exec(user, targets, ctx) {
          targets.forEach(t => {
            const dmg = calcDamage(user, t, 0.9);
            dealDamage(t, dmg, ctx);
            ctx.log(`${user.name} fauche ${t.name} pour ${dmg} dégâts.`);
          });
        } },
    ],
  },
  {
    id: "priestess",
    emoji: "🦌",
    name: "Prêtresse Biche",
    className: "Soigneuse",
    baseHp: 95, baseAtk: 9, baseDef: 8, baseSpd: 10, baseMana: 65,
    passive: {
      name: "Grâce Sylvestre",
      desc: "Soigne légèrement l'allié le plus faible à chaque tour.",
    },
    abilities: [
      { id: "benediction", name: "Bénédiction de la Forêt", cost: 20, target: "ally",
        desc: "Soigne un allié (ATQ x2 + 20).",
        exec(user, target, ctx) {
          const heal = Math.round(user.atk * 2 + 20);
          applyHeal(target, heal, ctx);
          ctx.log(`${user.name} bénit ${target.name}, +${heal} PV.`, true);
        } },
      { id: "soin_celeste", name: "Soin Céleste", cost: 38, target: "all-allies",
        desc: "Soigne tout le groupe (ATQ + 15).",
        exec(user, targets, ctx) {
          const heal = Math.round(user.atk + 15);
          targets.forEach(t => applyHeal(t, heal, ctx));
          ctx.log(`${user.name} invoque une lumière céleste, +${heal} PV au groupe.`, true);
        } },
      { id: "sceau", name: "Sceau Purificateur", cost: 25, target: "ally",
        desc: "Purifie les malus et pose un bouclier.",
        exec(user, target, ctx) {
          clearDebuffs(target);
          addStatus(target, "bouclier", 2, { amount: Math.round(user.def * 3 + 20) });
          ctx.log(`${user.name} purifie et protège ${target.name}.`, true);
        } },
    ],
  },
  {
    id: "ninja",
    emoji: "🦊",
    name: "Renard Ninja",
    className: "Assassin",
    baseHp: 88, baseAtk: 20, baseDef: 6, baseSpd: 17, baseMana: 40,
    passive: {
      name: "Instinct Vif",
      desc: "+20% de chance de coup critique (x1.5 dégâts) et agit tôt.",
    },
    abilities: [
      { id: "furtive", name: "Frappe Furtive", cost: 20, target: "enemy",
        desc: "Dégâts x2, critique garanti si la cible est à PV pleins.",
        exec(user, target, ctx) {
          const guaranteedCrit = target.hp >= target.maxHp;
          let dmg = calcDamage(user, target, 2, guaranteedCrit ? 1 : 0);
          dealDamage(target, dmg, ctx);
          ctx.log(`${user.name} frappe furtivement ${target.name} pour ${dmg} dégâts${guaranteedCrit ? " (CRITIQUE)" : ""} !`, true);
        } },
      { id: "ombre", name: "Ombre Multiple", cost: 15, target: "self",
        desc: "Esquive la prochaine attaque.",
        exec(user, target, ctx) {
          addStatus(user, "esquive", 2);
          ctx.log(`${user.name} se fond dans les ombres.`, true);
        } },
      { id: "poison", name: "Lame Empoisonnée", cost: 20, target: "enemy",
        desc: "Dégâts x0.8 + poison (dégâts sur 3 tours).",
        exec(user, target, ctx) {
          const dmg = calcDamage(user, target, 0.8);
          dealDamage(target, dmg, ctx);
          addStatus(target, "poison", 3, { amount: Math.round(user.atk * 0.5) });
          ctx.log(`${user.name} empoisonne ${target.name} (${dmg} dégâts).`, true);
        } },
    ],
  },
  {
    id: "mage",
    emoji: "🦦",
    name: "Loutre Mage",
    className: "Élémentaliste",
    baseHp: 82, baseAtk: 16, baseDef: 6, baseSpd: 9, baseMana: 75,
    passive: {
      name: "Affinité Aquatique",
      desc: "15% de chance qu'un sort ne coûte pas de mana.",
    },
    abilities: [
      { id: "vague", name: "Vague Glaciale", cost: 30, target: "all-enemies",
        desc: "Dégâts x1.1 à tous, 25% de chance de geler chacun.",
        exec(user, targets, ctx) {
          targets.forEach(t => {
            const dmg = calcDamage(user, t, 1.1);
            const dead = dealDamage(t, dmg, ctx);
            ctx.log(`${user.name} glace ${t.name} pour ${dmg} dégâts.`);
            if (!dead && Math.random() < 0.25) {
              addStatus(t, "etourdi", 1);
              ctx.log(`${t.name} est gelé sur place !`);
            }
          });
        } },
      { id: "jet", name: "Jet d'Eau Vive", cost: 20, target: "enemy",
        desc: "Dégâts x1.7 et retire le bouclier ennemi.",
        exec(user, target, ctx) {
          removeStatus(target, "bouclier");
          const dmg = calcDamage(user, target, 1.7);
          dealDamage(target, dmg, ctx);
          ctx.log(`${user.name} percute ${target.name} d'un jet d'eau (${dmg} dégâts).`, true);
        } },
      { id: "bulle", name: "Bulle Protectrice", cost: 20, target: "ally",
        desc: "Pose un bouclier absorbant les dégâts.",
        exec(user, target, ctx) {
          addStatus(target, "bouclier", 2, { amount: Math.round(user.atk * 2 + 15) });
          ctx.log(`${user.name} entoure ${target.name} d'une bulle protectrice.`, true);
        } },
    ],
  },
  {
    id: "bard",
    emoji: "🐉",
    name: "Dragon Barde",
    className: "Soutien",
    baseHp: 105, baseAtk: 14, baseDef: 9, baseSpd: 11, baseMana: 60,
    passive: {
      name: "Harmonie Draconique",
      desc: "Le groupe régénère un peu de mana à chacun de ses tours.",
    },
    abilities: [
      { id: "bravoure", name: "Chant de Bravoure", cost: 25, target: "all-allies",
        desc: "ATQ +30% pour tout le groupe (3 tours).",
        exec(user, targets, ctx) {
          targets.forEach(t => addStatus(t, "atkup", 3, { mult: 1.3 }));
          ctx.log(`${user.name} entonne un chant de bravoure !`, true);
        } },
      { id: "souffle", name: "Souffle Doré", cost: 30, target: "all-enemies",
        desc: "Dégâts x1.3 à tous, soigne le Barde de 10% PV max.",
        exec(user, targets, ctx) {
          targets.forEach(t => {
            const dmg = calcDamage(user, t, 1.3);
            dealDamage(t, dmg, ctx);
            ctx.log(`${user.name} embrase ${t.name} pour ${dmg} dégâts.`);
          });
          applyHeal(user, Math.round(user.maxHp * 0.1), ctx);
        } },
      { id: "melodie", name: "Mélodie Envoûtante", cost: 25, target: "enemy",
        desc: "Étourdit un ennemi pendant 1 tour.",
        exec(user, target, ctx) {
          addStatus(target, "etourdi", 1);
          ctx.log(`${user.name} envoûte ${target.name} !`, true);
        } },
    ],
  },
];

const ENEMY_TEMPLATES = [
  { id: "wolf", emoji: "🐺", name: "Loup des Ombres", hp: 55, atk: 12, def: 4, spd: 12 },
  { id: "crow", emoji: "🐦‍⬛", name: "Corbeau Maudit", hp: 40, atk: 10, def: 2, spd: 14, poisonAtk: true },
  { id: "golem", emoji: "🗿", name: "Golem de Pierre", hp: 100, atk: 16, def: 10, spd: 4 },
  { id: "spider", emoji: "🕷️", name: "Araignée Venimeuse", hp: 48, atk: 11, def: 3, spd: 11, poisonAtk: true },
];
const BOSS_TEMPLATE = { id: "oni", emoji: "👹", name: "Oni des Cimes", hp: 260, atk: 22, def: 12, spd: 9, boss: true };

/* ------------------------------- ETAT JEU -------------------------------- */

const state = {
  players: [],
  heroes: [],
  enemies: [],
  wave: 1,
  round: 1,
  turnQueue: [],
  battleOver: false,
};

const DEFAULT_NAMES = ["Joueur 1", "Joueur 2", "Joueur 3", "Joueur 4", "Joueur 5"];

/* ------------------------------ UTILITAIRES ------------------------------ */

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function uid() { return Math.random().toString(36).slice(2, 10); }

function getStatus(entity, key) {
  return entity.statuses.find(s => s.key === key);
}
function addStatus(entity, key, turns, data) {
  removeStatus(entity, key);
  entity.statuses.push(Object.assign({ key, turns }, data || {}));
}
function removeStatus(entity, key) {
  entity.statuses = entity.statuses.filter(s => s.key !== key);
}
function clearDebuffs(entity) {
  entity.statuses = entity.statuses.filter(s => !["poison", "etourdi", "atkdown"].includes(s.key));
}
function tickStatuses(entity, ctx) {
  entity.statuses.forEach(s => {
    if (s.key === "poison") {
      dealDamage(entity, s.amount, ctx, true);
      ctx.log(`${entity.name} souffre du poison (${s.amount} dégâts).`);
    }
  });
  entity.statuses.forEach(s => { s.turns -= 1; });
  entity.statuses = entity.statuses.filter(s => s.turns > 0);
}

function currentAtk(entity) {
  let atk = entity.atk;
  const up = getStatus(entity, "atkup");
  if (up) atk *= up.mult;
  const down = getStatus(entity, "atkdown");
  if (down) atk *= down.mult;
  if (entity.isHero && entity.templateId === "samurai" && entity.hp / entity.maxHp < 0.3) {
    atk *= 1.4;
  }
  return atk;
}
function currentDef(entity) {
  let def = entity.def;
  const up = getStatus(entity, "defup");
  if (up) def *= up.mult;
  return def;
}

function calcDamage(user, target, mult, forceCritChance) {
  const atk = currentAtk(user);
  const def = currentDef(target);
  let dmg = Math.max(1, Math.round(atk * mult - def * 0.5));
  let critChance = forceCritChance !== undefined ? forceCritChance : (user.templateId === "ninja" ? 0.2 : 0);
  if (forceCritChance === 1 || Math.random() < critChance) {
    dmg = Math.round(dmg * 1.5);
  }
  return dmg;
}

function dealDamage(target, amount, ctx, bypassShield) {
  if (!bypassShield) {
    const shield = getStatus(target, "bouclier");
    if (shield) {
      const absorbed = Math.min(shield.amount, amount);
      shield.amount -= absorbed;
      amount -= absorbed;
      if (shield.amount <= 0) removeStatus(target, "bouclier");
      if (absorbed > 0) ctx.log(`Le bouclier de ${target.name} absorbe ${absorbed} dégâts.`);
    }
  }
  target.hp = clamp(target.hp - amount, 0, target.maxHp);
  if (target.hp <= 0 && !target.dead) {
    target.dead = true;
    ctx.log(`💀 ${target.name} tombe au combat.`, true);
  }
  return target.dead;
}

function applyHeal(target, amount, ctx) {
  if (target.dead) return;
  target.hp = clamp(target.hp + amount, 0, target.maxHp);
}

/* ------------------------------ CREATION -------------------------------- */

function makeHeroes(waveScale) {
  return HERO_TEMPLATES.map((tpl, i) => ({
    uidKey: uid(),
    isHero: true,
    templateId: tpl.id,
    tpl,
    emoji: tpl.emoji,
    name: tpl.name,
    className: tpl.className,
    playerName: state.players[i] || DEFAULT_NAMES[i],
    maxHp: tpl.baseHp,
    hp: tpl.baseHp,
    maxMana: tpl.baseMana,
    mana: tpl.baseMana,
    atk: tpl.baseAtk,
    def: tpl.baseDef,
    spd: tpl.baseSpd,
    statuses: [],
    dead: false,
  }));
}

function makeEnemiesForWave(wave) {
  const scale = 1 + (wave - 1) * 0.18;
  const enemies = [];
  if (wave % 5 === 0) {
    enemies.push(scaleEnemy(BOSS_TEMPLATE, scale));
    const extra = ENEMY_TEMPLATES[Math.floor(Math.random() * ENEMY_TEMPLATES.length)];
    enemies.push(scaleEnemy(extra, scale * 0.8));
  } else {
    const count = Math.min(4, 2 + Math.floor(wave / 3));
    for (let i = 0; i < count; i++) {
      const tpl = ENEMY_TEMPLATES[Math.floor(Math.random() * ENEMY_TEMPLATES.length)];
      enemies.push(scaleEnemy(tpl, scale));
    }
  }
  return enemies;
}

function scaleEnemy(tpl, scale) {
  return {
    uidKey: uid(),
    isHero: false,
    templateId: tpl.id,
    emoji: tpl.emoji,
    name: tpl.name,
    boss: !!tpl.boss,
    poisonAtk: !!tpl.poisonAtk,
    maxHp: Math.round(tpl.hp * scale),
    hp: Math.round(tpl.hp * scale),
    atk: Math.round(tpl.atk * (1 + (scale - 1) * 0.6)),
    def: Math.round(tpl.def * (1 + (scale - 1) * 0.5)),
    spd: tpl.spd,
    statuses: [],
    dead: false,
  };
}

/* ------------------------------ NAVIGATION ------------------------------- */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ------------------------------- LOG UI ---------------------------------- */

function addLog(msg, important) {
  const logEl = document.getElementById("battle-log");
  const p = document.createElement("p");
  if (important) p.className = "important";
  p.textContent = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
}

function clearLog() {
  document.getElementById("battle-log").innerHTML = "";
}

/* ------------------------------ RENDU COMBAT ------------------------------ */

function renderBattle() {
  document.getElementById("wave-label").textContent = `Vague ${state.wave}`;
  const current = state.turnQueue[0];
  document.getElementById("turn-label").textContent = current
    ? (current.isHero ? `Tour de ${current.name}` : `Tour de ${current.name}`)
    : "";

  renderRow("enemies-row", state.enemies, current);
  renderRow("heroes-row", state.heroes, current);
}

function renderRow(rowId, entities, current) {
  const row = document.getElementById(rowId);
  row.innerHTML = "";
  entities.forEach(e => {
    const card = document.createElement("div");
    card.className = "entity-card" + (e.dead ? " dead" : "") + (current === e ? " active-turn" : "");
    card.dataset.uid = e.uidKey;

    const hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
    const hpLow = hpPct <= 30 ? " low" : "";

    let statusIcons = "";
    e.statuses.forEach(s => {
      const map = { poison: "☠️", etourdi: "💫", bouclier: "🛡️", atkup: "⚔️", defup: "🧱", esquive: "👻", provocation: "🎯", atkdown: "⬇️" };
      if (map[s.key]) statusIcons += map[s.key];
    });

    card.innerHTML = `
      <div class="status-icons">${statusIcons}</div>
      <div class="emoji">${e.emoji}</div>
      <div class="name">${e.name}${e.isHero ? `<br><span style="color:var(--muted);font-weight:400;">${e.playerName}</span>` : ""}</div>
      <div class="bar-bg"><div class="bar-fill hp${hpLow}" style="width:${hpPct}%"></div></div>
      <div class="stat-text">${e.hp}/${e.maxHp} PV</div>
      ${e.isHero ? `<div class="bar-bg"><div class="bar-fill mp" style="width:${(e.mana/e.maxMana)*100}%"></div></div><div class="stat-text">${e.mana}/${e.maxMana} PM</div>` : ""}
    `;
    row.appendChild(card);
  });
}

/* ------------------------------ MOTEUR COMBAT ------------------------------ */

function buildTurnQueue() {
  const all = [...state.heroes, ...state.enemies].filter(e => !e.dead);
  all.sort((a, b) => (b.spd + Math.random() * 4) - (a.spd + Math.random() * 4));
  state.turnQueue = all;
}

function ctxLog(msg, important) { addLog(msg, important); }
const ctx = { log: ctxLog };

async function runBattle() {
  state.battleOver = false;
  buildTurnQueue();
  renderBattle();

  while (!state.battleOver) {
    if (state.turnQueue.length === 0) {
      buildTurnQueue();
      if (state.turnQueue.length === 0) break;
    }
    const actor = state.turnQueue.shift();
    if (actor.dead) continue;

    if (checkEnd()) break;

    if (actor.isHero) {
      await heroTurn(actor);
    } else {
      await enemyTurn(actor);
    }
    if (checkEnd()) break;
    renderBattle();
    await sleep(150);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function checkEnd() {
  if (state.heroes.every(h => h.dead)) { state.battleOver = true; endBattle(false); return true; }
  if (state.enemies.every(e => e.dead)) { state.battleOver = true; endBattle(true); return true; }
  return false;
}

/* --------------------------- TOUR DES HEROS -------------------------------- */

function passDeviceScreen(hero) {
  return new Promise(resolve => {
    document.getElementById("pass-icon").textContent = hero.emoji;
    document.getElementById("pass-player").textContent = hero.playerName;
    document.getElementById("pass-hero").textContent = `${hero.name} — ${hero.className}`;
    showScreen("screen-pass");
    const btn = document.getElementById("btn-pass-ready");
    const handler = () => {
      btn.removeEventListener("click", handler);
      showScreen("screen-battle");
      resolve();
    };
    btn.addEventListener("click", handler);
  });
}

async function heroTurn(hero) {
  if (hero.dead) return;

  // passives déclenchées en début de tour
  if (hero.templateId === "priestess") {
    const alive = state.heroes.filter(h => !h.dead);
    const weakest = alive.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b), alive[0]);
    if (weakest && weakest.hp < weakest.maxHp) {
      applyHeal(weakest, Math.round(weakest.maxHp * 0.05), ctx);
    }
  }
  if (hero.templateId === "bard") {
    state.heroes.filter(h => !h.dead).forEach(h => { h.mana = clamp(h.mana + 2, 0, h.maxMana); });
  }
  hero.mana = clamp(hero.mana + 4, 0, hero.maxMana);

  await passDeviceScreen(hero);

  // étourdi ?
  if (getStatus(hero, "etourdi")) {
    addLog(`${hero.name} est étourdi et ne peut pas agir !`, true);
    tickStatuses(hero, ctx);
    return;
  }

  renderBattle();
  await chooseAndExecuteAction(hero);
  tickStatuses(hero, ctx);
  renderBattle();
}

function chooseAndExecuteAction(hero) {
  return new Promise(resolve => {
    const panel = document.getElementById("action-panel");

    function renderActions() {
      panel.innerHTML = "";
      const hint = document.createElement("div");
      hint.className = "action-hint";
      hint.textContent = `${hero.name} — choisis une action`;
      panel.appendChild(hint);

      const grid = document.createElement("div");
      grid.className = "action-grid";

      const basic = { id: "attack", name: "Attaque", cost: 0, target: "enemy", desc: "Coup basique." };
      const actions = [basic, ...hero.tpl.abilities];

      actions.forEach(ab => {
        const btn = document.createElement("button");
        btn.className = "action-btn";
        const canAfford = hero.mana >= ab.cost;
        btn.disabled = !canAfford;
        btn.innerHTML = `<span class="ab-name">${ab.name}</span><span class="ab-cost">${ab.cost > 0 ? ab.cost + " PM" : "Gratuit"}</span><span class="ab-desc">${ab.desc}</span>`;
        btn.addEventListener("click", () => selectTargetFor(ab));
        grid.appendChild(btn);
      });
      panel.appendChild(grid);
    }

    function selectTargetFor(ability) {
      if (ability.id === "attack") {
        startTargeting("enemy", (target) => {
          const dmg = calcDamage(hero, target, 1);
          dealDamage(target, dmg, ctx);
          addLog(`${hero.name} attaque ${target.name} pour ${dmg} dégâts.`, true);
          finish();
        });
        return;
      }

      const applyMana = () => {
        const freeCast = hero.templateId === "mage" && Math.random() < 0.15;
        if (!freeCast) hero.mana -= ability.cost;
        else addLog(`${hero.name} lance le sort gratuitement (affinité aquatique) !`);
      };

      if (ability.target === "self") {
        applyMana();
        ability.exec(hero, hero, ctx);
        finish();
      } else if (ability.target === "all-enemies") {
        applyMana();
        ability.exec(hero, state.enemies.filter(e => !e.dead), ctx);
        finish();
      } else if (ability.target === "all-allies") {
        applyMana();
        ability.exec(hero, state.heroes.filter(h => !h.dead), ctx);
        finish();
      } else if (ability.target === "enemy") {
        startTargeting("enemy", (target) => {
          applyMana();
          ability.exec(hero, target, ctx);
          finish();
        });
      } else if (ability.target === "ally") {
        startTargeting("ally", (target) => {
          applyMana();
          ability.exec(hero, target, ctx);
          finish();
        });
      }
    }

    function startTargeting(kind, onPick) {
      panel.innerHTML = "";
      const hint = document.createElement("div");
      hint.className = "action-hint";
      hint.textContent = kind === "enemy" ? "Choisis une cible ennemie" : "Choisis un allié";
      panel.appendChild(hint);

      const cancel = document.createElement("button");
      cancel.className = "btn btn-cancel-target";
      cancel.textContent = "Annuler";
      panel.appendChild(cancel);

      const pool = kind === "enemy" ? state.enemies : state.heroes;
      const cards = document.querySelectorAll(kind === "enemy" ? "#enemies-row .entity-card" : "#heroes-row .entity-card");
      cards.forEach(card => {
        const entity = pool.find(p => p.uidKey === card.dataset.uid);
        if (entity && !entity.dead) {
          card.classList.add("targetable");
          card.addEventListener("click", clickHandler);
        }
      });

      function clickHandler(e) {
        const uidKey = e.currentTarget.dataset.uid;
        const entity = pool.find(p => p.uidKey === uidKey);
        cleanup();
        onPick(entity);
      }
      function cleanup() {
        cards.forEach(card => {
          card.classList.remove("targetable");
          card.removeEventListener("click", clickHandler);
        });
        cancel.removeEventListener("click", onCancel);
      }
      function onCancel() {
        cleanup();
        renderActions();
      }
      cancel.addEventListener("click", onCancel);
    }

    function finish() {
      panel.innerHTML = "";
      resolve();
    }

    renderActions();
  });
}

/* --------------------------- TOUR DES ENNEMIS ------------------------------ */

async function enemyTurn(enemy) {
  if (enemy.dead) return;
  await sleep(400);

  if (getStatus(enemy, "etourdi")) {
    addLog(`${enemy.name} est étourdi et ne peut pas agir !`, true);
    tickStatuses(enemy, ctx);
    return;
  }

  const alive = state.heroes.filter(h => !h.dead);
  if (alive.length === 0) return;

  const taunter = alive.find(h => getStatus(h, "provocation"));
  let target = taunter || pickWeightedTarget(alive);

  if (getStatus(target, "esquive")) {
    removeStatus(target, "esquive");
    addLog(`${target.name} esquive l'attaque de ${enemy.name} !`, true);
    tickStatuses(enemy, ctx);
    return;
  }

  if (enemy.boss && Math.random() < 0.35) {
    alive.forEach(h => {
      if (getStatus(h, "esquive")) { removeStatus(h, "esquive"); addLog(`${h.name} esquive !`); return; }
      const dmg = Math.max(1, Math.round(enemy.atk * 0.7 - currentDef(h) * 0.5));
      dealDamage(h, dmg, ctx);
      addLog(`${enemy.name} déchaîne une onde de choc sur ${h.name} (${dmg} dégâts).`);
    });
  } else {
    const dmg = Math.max(1, Math.round(enemy.atk - currentDef(target) * 0.5));
    dealDamage(target, dmg, ctx);
    addLog(`${enemy.name} attaque ${target.name} pour ${dmg} dégâts.`, true);
    if (enemy.poisonAtk && !target.dead && Math.random() < 0.4) {
      addStatus(target, "poison", 2, { amount: Math.round(enemy.atk * 0.3) });
      addLog(`${target.name} est empoisonné !`);
    }
  }

  tickStatuses(enemy, ctx);
}

function pickWeightedTarget(alive) {
  const weights = alive.map(h => 1 / (h.hp / h.maxHp + 0.15));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < alive.length; i++) {
    r -= weights[i];
    if (r <= 0) return alive[i];
  }
  return alive[alive.length - 1];
}

/* ------------------------------- FIN DE VAGUE ------------------------------ */

function endBattle(victory) {
  if (victory) {
    if (state.wave % 5 === 0) {
      addLog("🏆 Le boss est vaincu !", true);
    }
    state.heroes.forEach(h => {
      if (!h.dead) {
        h.hp = clamp(h.hp + Math.round(h.maxHp * 0.25), 0, h.maxHp);
        h.mana = clamp(h.mana + Math.round(h.maxMana * 0.4), 0, h.maxMana);
      }
    });
    const best = parseInt(localStorage.getItem("rpg5_bestWave") || "0", 10);
    if (state.wave > best) localStorage.setItem("rpg5_bestWave", String(state.wave));

    setTimeout(() => {
      state.wave += 1;
      state.enemies = makeEnemiesForWave(state.wave);
      clearLog();
      addLog(`Vague ${state.wave} approche...`, true);
      runBattle();
    }, 1400);
  } else {
    const best = parseInt(localStorage.getItem("rpg5_bestWave") || "0", 10);
    if (state.wave > best) localStorage.setItem("rpg5_bestWave", String(state.wave));
    setTimeout(() => showEnd(false), 900);
  }
}

function showEnd(victory) {
  document.getElementById("end-title").textContent = victory ? "Victoire !" : "Défaite...";
  document.getElementById("end-text").textContent = victory
    ? "Le groupe des 5 Gardiens a triomphé !"
    : "Le groupe est tombé au combat. Regroupez vos forces et retentez l'aventure !";
  document.getElementById("end-wave").textContent = `Vague atteinte : ${state.wave}`;
  showScreen("screen-end");
}

/* -------------------------------- SETUP UI --------------------------------- */

function renderSetup() {
  const list = document.getElementById("setup-list");
  list.innerHTML = "";
  HERO_TEMPLATES.forEach((tpl, i) => {
    const row = document.createElement("div");
    row.className = "setup-row";
    row.innerHTML = `
      <div class="emoji">${tpl.emoji}</div>
      <div class="who">
        <div class="class-name">${tpl.name} · ${tpl.className}</div>
        <input type="text" maxlength="16" value="${state.players[i] || DEFAULT_NAMES[i]}" data-index="${i}">
      </div>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      state.players[idx] = e.target.value.trim() || DEFAULT_NAMES[idx];
    });
  });
}

/* --------------------------------- INIT ------------------------------------ */

function initBestWaveLabel() {
  const best = parseInt(localStorage.getItem("rpg5_bestWave") || "0", 10);
  const label = document.getElementById("best-wave-label");
  label.textContent = best > 0 ? `Meilleure vague atteinte : ${best}` : "";
}

function startNewAdventure() {
  state.players = DEFAULT_NAMES.slice();
  renderSetup();
  showScreen("screen-setup");
}

function beginBattleFromSetup() {
  state.wave = 1;
  state.heroes = makeHeroes();
  state.enemies = makeEnemiesForWave(state.wave);
  clearLog();
  showScreen("screen-battle");
  addLog("L'aventure commence !", true);
  runBattle();
}

window.addEventListener("DOMContentLoaded", () => {
  initBestWaveLabel();

  document.getElementById("btn-goto-setup").addEventListener("click", startNewAdventure);
  document.getElementById("btn-how-to-play").addEventListener("click", () => showScreen("screen-rules"));
  document.getElementById("btn-close-rules").addEventListener("click", () => showScreen("screen-title"));
  document.getElementById("btn-back-title").addEventListener("click", () => showScreen("screen-title"));
  document.getElementById("btn-start-battle").addEventListener("click", beginBattleFromSetup);
  document.getElementById("btn-restart").addEventListener("click", () => {
    initBestWaveLabel();
    showScreen("screen-title");
  });
});
