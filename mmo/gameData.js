"use strict";

/* =========================================================================
   LES 5 GARDIENS — MMORPG léger (données du monde)
   Aucune personnalisation esthétique : chaque classe a un sprite fixe.
   ========================================================================= */

const MAX_LEVEL = 20;
const TICK_MS = 100;
const MOVE_SPEED = 90; // px / seconde
const ZONE_W = 320;
const ZONE_H = 440;
const PORTAL_RADIUS = 26;
const NPC_RADIUS = 34;
const MONSTER_RADIUS = 30;
const RETALIATE_MS = 2500;
const RESPAWN_MS = 35000;
const KO_MS = 7000;

const CLASSES = {
  samurai: {
    id: "samurai", emoji: "🐗", name: "Samurai Sanglier", className: "Guerrier",
    baseHp: 130, baseMana: 25, baseAtk: 14, baseDef: 11,
    abilities: [
      { id: "charge", name: "Charge Enragée", cost: 18, cooldownMs: 5000, mult: 1.8, desc: "Dégâts x1.8, 30% chance d'étourdir." },
      { id: "tranchant", name: "Tranchant du Sanglier", cost: 22, cooldownMs: 7000, mult: 1.0, desc: "Coup puissant, ignore une partie de la défense." },
    ],
    passiveDesc: "ATQ +40% sous 30% PV.",
  },
  priestess: {
    id: "priestess", emoji: "🦌", name: "Prêtresse Biche", className: "Soigneuse",
    baseHp: 85, baseMana: 55, baseAtk: 8, baseDef: 7,
    abilities: [
      { id: "soin", name: "Bénédiction de la Forêt", cost: 16, cooldownMs: 4000, heal: true, mult: 2.4, desc: "Se soigne (ou l'objectif) pour ATQ x2.4 + 15." },
      { id: "sceau", name: "Sceau Purificateur", cost: 20, cooldownMs: 8000, shield: true, desc: "Pose un bouclier sur soi (absorbe les dégâts)." },
    ],
    passiveDesc: "Régénère un peu de PV à chaque tick.",
  },
  ninja: {
    id: "ninja", emoji: "🦊", name: "Renard Ninja", className: "Assassin",
    baseHp: 78, baseMana: 35, baseAtk: 17, baseDef: 5,
    abilities: [
      { id: "furtive", name: "Frappe Furtive", cost: 15, cooldownMs: 4000, mult: 2.0, desc: "Dégâts x2, critique bonus." },
      { id: "poison", name: "Lame Empoisonnée", cost: 16, cooldownMs: 6000, mult: 0.8, poison: true, desc: "Dégâts + poison sur la durée." },
    ],
    passiveDesc: "+20% de chance de coup critique.",
  },
  mage: {
    id: "mage", emoji: "🦦", name: "Loutre Mage", className: "Élémentaliste",
    baseHp: 72, baseMana: 70, baseAtk: 15, baseDef: 5,
    abilities: [
      { id: "vague", name: "Vague Glaciale", cost: 20, cooldownMs: 5000, mult: 1.3, freeze: true, desc: "Dégâts + chance de geler." },
      { id: "jet", name: "Jet d'Eau Vive", cost: 16, cooldownMs: 4000, mult: 1.7, desc: "Dégâts x1.7 sur la cible." },
    ],
    passiveDesc: "15% de chance de lancer un sort gratuitement.",
  },
  bard: {
    id: "bard", emoji: "🐉", name: "Dragon Barde", className: "Soutien",
    baseHp: 95, baseMana: 60, baseAtk: 12, baseDef: 8,
    abilities: [
      { id: "bravoure", name: "Chant de Bravoure", cost: 20, cooldownMs: 8000, buff: true, desc: "ATQ +30% pour soi (10s)." },
      { id: "souffle", name: "Souffle Doré", cost: 22, cooldownMs: 5000, mult: 1.3, selfHealPct: 0.08, desc: "Dégâts + se soigne un peu." },
    ],
    passiveDesc: "Régénère un peu de mana à chaque tick.",
  },
};

const MONSTER_TEMPLATES = {
  loup: { name: "Loup des Ombres", emoji: "🐺", hp: 42, atk: 6, def: 2, xp: 14, gold: 3 },
  corbeau: { name: "Corbeau Maudit", emoji: "🐦", hp: 32, atk: 5, def: 1, xp: 11, gold: 2, poisonAtk: true },
  araignee: { name: "Araignée Venimeuse", emoji: "🕷️", hp: 95, atk: 10, def: 4, xp: 30, gold: 6, poisonAtk: true },
  golem: { name: "Golem de Pierre", emoji: "🗿", hp: 155, atk: 13, def: 8, xp: 42, gold: 10 },
  vase: { name: "Vase Visqueuse", emoji: "🟢", hp: 115, atk: 9, def: 5, xp: 34, gold: 8 },
  spectre: { name: "Spectre des Cimes", emoji: "👻", hp: 185, atk: 16, def: 7, xp: 62, gold: 15 },
  oni: { name: "Oni Ancestral", emoji: "👹", hp: 950, atk: 24, def: 12, xp: 550, gold: 150, boss: true },
};

const ITEMS = {
  bottes_cuir: { id: "bottes_cuir", name: "Bottes de Cuir", slot: "pieds", def: 2, hp: 8, price: 15 },
  plastron_toile: { id: "plastron_toile", name: "Plastron de Toile", slot: "torse", def: 3, hp: 10, price: 20 },
  casque_cuir: { id: "casque_cuir", name: "Casque de Cuir", slot: "tete", def: 3, hp: 10 },
  plastron_fer: { id: "plastron_fer", name: "Plastron de Fer", slot: "torse", def: 6, hp: 25 },
  jambieres_dorees: { id: "jambieres_dorees", name: "Jambières Dorées", slot: "jambes", def: 5, hp: 20, atk: 2 },
  couronne_pic_dore: { id: "couronne_pic_dore", name: "Couronne du Pic-Doré", slot: "tete", def: 10, hp: 50, atk: 5 },
};

const QUESTS = {
  q1_loups: {
    id: "q1_loups", giver: "ancien_chene", name: "Menace dans les bois",
    desc: "Éliminez 3 Loups des Ombres.", type: "kill", monster: "loup", count: 3,
    minLevel: 1, rewardXp: 40, rewardGold: 10,
  },
  q2_corbeaux: {
    id: "q2_corbeaux", giver: "ancien_chene", name: "Corbeaux malfaisants",
    desc: "Éliminez 4 Corbeaux Maudits.", type: "kill", monster: "corbeau", count: 4,
    minLevel: 2, rewardXp: 60, rewardGold: 15, rewardItem: "casque_cuir",
  },
  q3_brumes: {
    id: "q3_brumes", giver: "ancien_chene", name: "Vers les Brumes",
    desc: "Prouvez votre valeur : éliminez 6 créatures de la Sente des Loups.",
    type: "kill-any", monsters: ["loup", "corbeau"], count: 6,
    minLevel: 5, rewardXp: 110, rewardGold: 20,
  },
  q4_araignees: {
    id: "q4_araignees", giver: "sage_brumes", name: "Nettoyage du marais",
    desc: "Éliminez 5 Araignées Venimeuses.", type: "kill", monster: "araignee", count: 5,
    minLevel: 6, rewardXp: 160, rewardGold: 30,
  },
  q5_golems: {
    id: "q5_golems", giver: "sage_brumes", name: "Cœur de pierre",
    desc: "Éliminez 3 Golems de Pierre.", type: "kill", monster: "golem", count: 3,
    minLevel: 8, rewardXp: 230, rewardGold: 35, rewardItem: "plastron_fer",
  },
  q6_vases: {
    id: "q6_vases", giver: "sage_brumes", name: "Vases corrosives",
    desc: "Éliminez 6 Vases Visqueuses.", type: "kill", monster: "vase", count: 6,
    minLevel: 11, rewardXp: 300, rewardGold: 50,
  },
  q7_spectres: {
    id: "q7_spectres", giver: "gardien_pic", name: "Spectres des Crêtes",
    desc: "Éliminez 5 Spectres des Cimes.", type: "kill", monster: "spectre", count: 5,
    minLevel: 14, rewardXp: 400, rewardGold: 60, rewardItem: "jambieres_dorees",
  },
  q8_oni: {
    id: "q8_oni", giver: "gardien_pic", name: "L'Oni Ancestral",
    desc: "Vainquez le terrible Oni Ancestral.", type: "kill", monster: "oni", count: 1,
    minLevel: 18, rewardXp: 900, rewardGold: 200, rewardItem: "couronne_pic_dore",
  },
};

const ZONES = {
  racine_feuille: {
    id: "racine_feuille", name: "Racine-Feuille", type: "village", recommendedLevel: "1+",
    spawn: { x: 160, y: 380 },
    npcs: [
      { id: "ancien_chene", name: "Ancien Chêne", emoji: "🌳", x: 90, y: 150, quests: ["q1_loups", "q2_corbeaux", "q3_brumes"] },
      { id: "forgeron_1", name: "Forgeron", emoji: "🔨", x: 230, y: 150, shop: ["bottes_cuir", "plastron_toile"] },
    ],
    portals: [{ x: 160, y: 40, toZone: "sente_loups", toX: 160, toY: 400, label: "Sente des Loups →" }],
  },
  sente_loups: {
    id: "sente_loups", name: "Sente des Loups", type: "wild", recommendedLevel: "1-5",
    spawn: { x: 160, y: 400 },
    npcs: [],
    monsters: [
      { templateId: "loup", x: 80, y: 260 }, { templateId: "loup", x: 220, y: 300 },
      { templateId: "corbeau", x: 140, y: 180 }, { templateId: "corbeau", x: 240, y: 150 },
      { templateId: "loup", x: 60, y: 120 },
    ],
    portals: [
      { x: 160, y: 430, toZone: "racine_feuille", toX: 160, toY: 60, label: "← Racine-Feuille" },
      { x: 160, y: 30, toZone: "hameau_brumes", toX: 160, toY: 400, label: "Hameau des Brumes →" },
    ],
  },
  hameau_brumes: {
    id: "hameau_brumes", name: "Hameau des Brumes", type: "village", recommendedLevel: "6+",
    spawn: { x: 160, y: 380 },
    npcs: [
      { id: "sage_brumes", name: "Sage des Brumes", emoji: "🧙", x: 160, y: 150, quests: ["q4_araignees", "q5_golems", "q6_vases"] },
      { id: "forgeron_2", name: "Forgeron", emoji: "🔨", x: 240, y: 200, shop: ["plastron_toile", "bottes_cuir"] },
    ],
    portals: [
      { x: 160, y: 430, toZone: "sente_loups", toX: 160, toY: 60, label: "← Sente des Loups" },
      { x: 160, y: 40, toZone: "marais_hurlant", toX: 160, toY: 400, label: "Marais Hurlant →" },
    ],
  },
  marais_hurlant: {
    id: "marais_hurlant", name: "Marais Hurlant", type: "wild", recommendedLevel: "6-12",
    spawn: { x: 160, y: 400 },
    npcs: [],
    monsters: [
      { templateId: "araignee", x: 90, y: 280 }, { templateId: "araignee", x: 220, y: 250 },
      { templateId: "golem", x: 160, y: 180 }, { templateId: "vase", x: 60, y: 130 },
      { templateId: "vase", x: 250, y: 140 }, { templateId: "araignee", x: 160, y: 320 },
    ],
    portals: [
      { x: 160, y: 430, toZone: "hameau_brumes", toX: 160, toY: 60, label: "← Hameau des Brumes" },
      { x: 160, y: 30, toZone: "citadelle_pic", toX: 160, toY: 400, label: "Citadelle du Pic-Doré →" },
    ],
  },
  citadelle_pic: {
    id: "citadelle_pic", name: "Citadelle du Pic-Doré", type: "village", recommendedLevel: "13+",
    spawn: { x: 160, y: 380 },
    npcs: [
      { id: "gardien_pic", name: "Gardien du Pic", emoji: "🛡️", x: 160, y: 150, quests: ["q7_spectres", "q8_oni"] },
    ],
    portals: [
      { x: 160, y: 430, toZone: "marais_hurlant", toX: 160, toY: 60, label: "← Marais Hurlant" },
      { x: 160, y: 40, toZone: "cretes_oni", toX: 160, toY: 400, label: "Crêtes de l'Oni →" },
    ],
  },
  cretes_oni: {
    id: "cretes_oni", name: "Crêtes de l'Oni", type: "wild", recommendedLevel: "13-20",
    spawn: { x: 160, y: 400 },
    npcs: [],
    monsters: [
      { templateId: "spectre", x: 90, y: 300 }, { templateId: "spectre", x: 230, y: 280 },
      { templateId: "golem", x: 160, y: 220 }, { templateId: "spectre", x: 60, y: 150 },
      { templateId: "oni", x: 160, y: 90 },
    ],
    portals: [{ x: 160, y: 430, toZone: "citadelle_pic", toX: 160, toY: 60, label: "← Citadelle du Pic-Doré" }],
  },
};

function xpToNextLevel(level) {
  return 35 + level * 22;
}

function statsForLevel(classId, level) {
  const tpl = CLASSES[classId];
  const lv = level - 1;
  return {
    maxHp: Math.round(tpl.baseHp + lv * 9),
    maxMana: Math.round(tpl.baseMana + lv * 4),
    atk: Math.round((tpl.baseAtk + lv * 1.4) * 10) / 10,
    def: Math.round((tpl.baseDef + lv * 1.1) * 10) / 10,
  };
}

module.exports = {
  MAX_LEVEL, TICK_MS, MOVE_SPEED, ZONE_W, ZONE_H, PORTAL_RADIUS, NPC_RADIUS, MONSTER_RADIUS,
  RETALIATE_MS, RESPAWN_MS, KO_MS,
  CLASSES, MONSTER_TEMPLATES, ITEMS, QUESTS, ZONES,
  xpToNextLevel, statsForLevel,
};
