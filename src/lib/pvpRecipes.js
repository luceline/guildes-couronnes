// ═══════════════════════════════════════════════════════════════
// pvpRecipes.js : Système de recettes PvP T1.5 dynamiques quotidiens
// Inputs T1/T2 aléatoires basés sur la date du jour (seed)
// ═══════════════════════════════════════════════════════════════

import { ITEMS } from './craftingData.js';
import { COMPETITIVE_ITEMS } from './gameData.js';

// Hash string → entier déterministe
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

// Renvoie un élément du tableau déterministe selon la clé
function pickFrom(arr, key) {
  return arr[hashStr(key) % arr.length];
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

// Pool de ressources T1 et T2 pour inputs dynamiques
const T1_POOL = ["bois_brut", "minerai_fer", "ble", "laine_brute", "herbes", "quartz_brut"];
const T2_POOL = ["planches", "pierre_brute", "fil", "charbon", "extrait", "quartz_poli", "encre", "farine"];

export function getTodayPvpRecipes() {
  const today = getTodayStr();

  const allProfessions = ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"];
  const recipes = [];

  // Recettes T1.5 : tous les items sont craftables par toutes les professions avec inputs dynamiques
  const pvpItems = [
    { name: "Camouflage", icon: "👻", output: "camouflage" },
    { name: "Tracts de Grève", icon: "⚡", output: "tracts_greve" },
    { name: "Bourse de protection", icon: "👜", output: "bourse_protection" },
  ];

  // Crée une recette par profession et par item
  pvpItems.forEach((item, idx) => {
    allProfessions.forEach((profession) => {
      const itemDef = ITEMS[item.output] || COMPETITIVE_ITEMS[item.output];
      const description = itemDef?.use || itemDef?.description || `Effet du ${item.name}`;
      recipes.push({
        id: `craft_${item.output}_${profession.toLowerCase()}`,
        name: item.name,
        icon: item.icon,
        profession: profession,
        tier: 1.5,
        inputs: (() => {
          const t1a = pickFrom(T1_POOL, `${today}_${idx}_${profession}_a`);
          const t1bPool = T1_POOL.filter(x => x !== t1a);
          const t1b = pickFrom(t1bPool, `${today}_${idx}_${profession}_b`);
          const t2 = pickFrom(T2_POOL, `${today}_${idx}_${profession}_c`);
          return [
            { key: t1a, quantity: 2 },
            { key: t1b, quantity: 2 },
            { key: t2, quantity: 1 },
          ];
        })(),
        output: { key: item.output, quantity: 1 },
        costGold: 0,
        cooldown: 600,
        description,
      });
    });
  });

  return recipes;
}