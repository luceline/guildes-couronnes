// ═══════════════════════════════════════════════════════════════════════════
// gameData.js — Barrel : ré-exporte tout depuis ./game/*
// ═══════════════════════════════════════════════════════════════════════════
// Refacto 14/05/2026 : le mono-fichier gameData.js (1624 lignes, 120 exports)
// a été éclaté en modules thématiques sous ./game/. Ce barrel est conservé
// pour que tous les imports existants continuent de fonctionner sans
// modification (57 fichiers consommateurs).
//
// Pour le code NOUVEAU : importer directement depuis le sous-module concerné,
// par exemple :
//   import { BUILDING_TYPES } from "@/lib/game/buildings";
//   import { getMaxHunger } from "@/lib/game/survival";
//
// Pour les anciennes import lignes : continuent de fonctionner, ex :
//   import { BUILDING_TYPES, getMaxHunger } from "@/lib/gameData";
//
// ── Carte de répartition ──
//   admins.js      : ADMIN_EMAILS
//   professions.js : PROFESSIONS, ITEM_CATEGORIES
//   housing.js     : HOUSING, HOUSING_MAINTENANCE
//   combat.js      : COMBAT_*, getCombat*, EQUIPMENT_*, scores attaque/défense
//   survival.js    : MAX_HUNGER/FATIGUE, HUNGER_FOOD_ITEMS, getMax*, capacity, applyRandomActionCost
//   buffs.js       : getPassive*, getTemporary*, tax discount, bourse
//   cityTiers.js   : CITY_LEVELS, getCityTier, getCityBonuses, isCategoryUnlocked, getMaxBuildingLevel
//   buildings.js   : BUILDING_TYPES, BUILDING_CATEGORIES, getBuilding*, canBuildMore, isBuildingTypeAvailable
//   mayor.js       : MAYOR_*, MAINTENANCE_*, getCityDailyMaintenance, PROFESSION_CHANGE_COST
//   travel.js      : ROAD_TYPES, ROAD_COLORS, computeTravelCost, computeWallToll, getDailyRouteCost, getRouteType
//   taxes.js       : generateDailyTax*, PARCHEMIN_REWARDS, SCEAU_*, TIER_ACTION_COST
//   rankings.js    : STREAK_REWARDS, getStreakReward, getVendeurRank, getContributeurRank, getPvpRank, RARE_RESOURCE_XP
//   warehouse.js   : WAREHOUSE_BUYBACK_PRICES, WAREHOUSE_DAILY_SELL_CAP, generateWarehouseBuybackPrices
//   competitive.js : COMPETITIVE_ITEMS
//   time.js        : getTodayDateStr
// ═══════════════════════════════════════════════════════════════════════════

export * from "./game/admins.js";
export * from "./game/professions.js";
export * from "./game/housing.js";
export * from "./game/combat.js";
export * from "./game/survival.js";
export * from "./game/buffs.js";
export * from "./game/cityTiers.js";
export * from "./game/buildings.js";
export * from "./game/mayor.js";
export * from "./game/travel.js";
export * from "./game/taxes.js";
export * from "./game/rankings.js";
export * from "./game/warehouse.js";
export * from "./game/competitive.js";
export * from "./game/time.js";
