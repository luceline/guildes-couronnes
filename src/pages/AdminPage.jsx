import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { runMayorTick, mayerTryBuild, rotateResources, runWealthTax, runMaintenanceCosts, distributeTreasury, runBuildingMaintenance, runTreasuryInterests } from "../lib/mayorAI";
import { BUILDING_TYPES, generateDailyTax, getTodayDateStr, PROFESSIONS, ADMIN_EMAILS } from "../lib/gameData";
const BUILDING_TYPE_MAP = BUILDING_TYPES;
import { CRAFTING_RECIPES, ITEMS, PROFESSION_PRODUCTION } from "../lib/craftingData";
import { toast } from "sonner";
import GameDataManager from "../components/admin/GameDataManager";
import BuildingTypeManager from "../components/admin/BuildingTypeManager";
import EconomySettingsManager from "../components/admin/EconomySettingsManager";
import TravelRouteManager from "../components/admin/TravelRouteManager";
import MarketModerator from "../components/admin/MarketModerator";
import TaxAuditPanel from "../components/admin/TaxAuditPanel";
import DailyResetManager from "../components/admin/DailyResetManager";
import SystemMessageManager from "../components/admin/SystemMessageManager";
import InflationMonitor from "../components/admin/InflationMonitor";
import MusicManager from "../components/admin/MusicManager";

// ── MigrationPanel ──────────────────────────────────────────────────────────
function MigrationPanel({ players, onRefresh }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);

  const MIGRATIONS = [
    {
      id: "purge_obsolete_items",
      label: "🗑️ Purger les items obsolètes de tous les inventaires",
      description: "Retire des inventaires joueurs tout item dont la clé n'existe plus dans le référentiel actuel (craftingData.js). Affiche un rapport détaillé avant de modifier. Les items retirés sont listés par joueur.",
      run: async (profiles, addLog) => {
        const VALID_KEYS = new Set([
          "armure","autorisation_marche","besace","ble","bois_brut",
          "charbon","cle_forgee","contrat_artisan","contrat_noble",
          "elixir_discorde","encre","epee_courte","epee_longue","extrait","farine",
          "faux_contrat","festin_empoisonne","fil","herbes","huile_inflammable","laine_brute",
          "lettre_desinformation","lingot_raffine","lingot_royal","lingots_fer","lingots_or",
          "meuble","minerai_fer","outils","pain","parchemin","pierre","pierre_brute",
          "planches","potion_endur","potion_soin","poudre_corrosive","quartz_brut",
          "quartz_poli","ragout","tissu","sceau_royal",
          // Items spéciaux
          "camouflage","tracts_greve","bombe_fumigene",
        ]);
        let totalPurged = 0;
        let playersAffected = 0;
        for (const profile of profiles) {
          const inventory = profile.inventory || [];
          const obsolete = inventory.filter(i => i.item_key && !VALID_KEYS.has(i.item_key));
          if (obsolete.length === 0) continue;
          const newInventory = inventory.filter(i => !i.item_key || VALID_KEYS.has(i.item_key));
          await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });
          playersAffected++;
          totalPurged += obsolete.length;
          for (const obs of obsolete) {
            addLog(`🗑️ ${profile.character_name} — retiré : "${obs.item_key || obs.item_name}" ×${obs.quantity}`);
          }
        }
        if (totalPurged === 0) addLog("✅ Aucun item obsolète trouvé dans les inventaires.");
        else addLog(`✔ Purge terminée — ${totalPurged} entrée(s) retirée(s) chez ${playersAffected} joueur(s).`);
      },
    },
    {
      id: "scan_obsolete_dry_run",
      label: "🔍 Scanner (sans modifier) les items obsolètes",
      description: "Analyse tous les inventaires et liste les items inconnus, sans rien modifier. Utile pour vérifier avant la purge.",
      run: async (profiles, addLog) => {
        const VALID_KEYS = new Set([
          "armure","autorisation_marche","besace","ble","bois_brut",
          "charbon","cle_forgee","contrat_artisan","contrat_noble",
          "elixir_discorde","encre","epee_courte","epee_longue","extrait","farine",
          "faux_contrat","festin_empoisonne","fil","herbes","huile_inflammable","laine_brute",
          "lettre_desinformation","lingot_raffine","lingot_royal","lingots_fer","lingots_or",
          "meuble","minerai_fer","outils","pain","parchemin","pierre","pierre_brute",
          "planches","potion_endur","potion_soin","poudre_corrosive","quartz_brut",
          "quartz_poli","ragout","tissu","sceau_royal",
          // Items spéciaux
          "camouflage","tracts_greve","bombe_fumigene",
        ]);
        let totalFound = 0;
        const unknown = {};
        for (const profile of profiles) {
          const inventory = profile.inventory || [];
          for (const item of inventory) {
            if (item.item_key && !VALID_KEYS.has(item.item_key)) {
              totalFound++;
              const key = item.item_key;
              unknown[key] = (unknown[key] || 0) + item.quantity;
              addLog(`⚠️ ${profile.character_name} — "${key}" (${item.item_name}) ×${item.quantity}`);
            }
          }
        }
        if (totalFound === 0) {
          addLog("✅ Aucun item obsolète détecté.");
        } else {
          addLog(`\n📊 Résumé — ${totalFound} entrée(s) obsolète(s) :`);
          for (const [k, qty] of Object.entries(unknown)) {
            addLog(`  • "${k}" : ${qty} exemplaire(s) au total`);
          }
          addLog(`\n⚠️ Lance "Purger les items obsolètes" pour les retirer.`);
        }
      },
    },
    {
      id: "fix_autorisation_item_key",
      label: "Réparer item_key manquant — Autorisation de marché",
      description: "Corrige les inventaires où l'Autorisation de marché a été achetée sans item_key (apparaît dans l'inventaire mais ne débloque pas la vente).",
      run: async (profiles, addLog) => {
        let fixed = 0;
        for (const profile of profiles) {
          const inventory = profile.inventory || [];
          let dirty = false;
          const newInventory = inventory.map(item => {
            if (
              (!item.item_key || item.item_key === "") &&
              item.item_name === "Autorisation de marché"
            ) {
              dirty = true;
              return { ...item, item_key: "autorisation_marche", item_category: item.item_category || "parchemins" };
            }
            return item;
          });
          if (dirty) {
            await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });
            fixed++;
            addLog(`✅ ${profile.character_name} — item_key corrigé (×${newInventory.filter(i => i.item_key === "autorisation_marche").reduce((s, i) => s + i.quantity, 0)})`);
          }
        }
        if (fixed === 0) addLog("ℹ️ Aucun profil à corriger.");
        else addLog(`✔ Migration terminée — ${fixed} profil(s) mis à jour.`);
      },
    },
    {
      id: "normalize_all_item_keys",
      label: "🔑 Normaliser item_key sur tous les inventaires",
      description: "Parcourt tous les profils et ajoute item_key aux items qui n'en ont pas, via correspondance par item_name. Fusionne aussi les doublons (même item_key). Ne supprime rien. Inclut également les listings de marché actifs sans item_key.",
      run: async (profiles, addLog) => {
        // Table de correspondance nom → item_key
        const NAME_TO_KEY = {
          "Bois brut": "bois_brut", "Blé": "ble", "Laine brute": "laine_brute",
          "Herbes": "herbes", "Minerai de fer": "minerai_fer", "Quartz brut": "quartz_brut",
          "Pierre": "pierre", "Autorisation de marché": "autorisation_marche",
          "Autorisation de mise sur le marché": "autorisation_marche",
          "Planches": "planches", "Pierre brute": "pierre_brute", "Fil": "fil",
          "Charbon": "charbon", "Extrait": "extrait", "Quartz poli": "quartz_poli",
          "Encre": "encre", "Farine": "farine",
          "Meuble": "meuble", "Lingots de fer": "lingots_fer", "Tissu": "tissu",
          "Épée courte": "epee_courte", "Potion de soin": "potion_soin",
          "Lingot d'or": "lingots_or", "Parchemin": "parchemin",
          "Contrat artisan": "contrat_artisan", "Pain": "pain",
          "Armure": "armure", "Outils": "outils", "Ragoût": "ragout",
          "Besace": "besace", "Épée longue": "epee_longue",
          "Potion d'endurance": "potion_endur", "Lingot raffiné": "lingot_raffine",
          "Huile inflammable": "huile_inflammable", "Poudre corrosive": "poudre_corrosive",
          "Festin empoisonné": "festin_empoisonne", "Faux contrat": "faux_contrat",
          "Clé forgée": "cle_forgee", "Élixir de discorde": "elixir_discorde",
          "Lingot royal": "lingot_royal", "Lettre de désinformation": "lettre_desinformation",
          "Contrat noble": "contrat_noble", "Sceau royal": "sceau_royal",
          "Camouflage": "camouflage", "Tracts de Grève": "tracts_greve",
          "Bombe Fumigène": "bombe_fumigene",
        };

        let profilesFixed = 0;
        let itemsFixed = 0;
        let merged = 0;

        for (const profile of profiles) {
          const inventory = profile.inventory || [];
          let dirty = false;

          // 1. Ajouter item_key manquant
          let newInventory = inventory.map(item => {
            if (!item.item_key || item.item_key === "") {
              const resolvedKey = NAME_TO_KEY[item.item_name];
              if (resolvedKey) {
                dirty = true;
                itemsFixed++;
                return { ...item, item_key: resolvedKey };
              }
            }
            return item;
          });

          // 2. Fusionner les doublons (même item_key)
          const merged_inv = [];
          for (const item of newInventory) {
            const existing = merged_inv.find(i =>
              i.item_key && i.item_key === item.item_key &&
              !(item.durability !== undefined) // ne pas fusionner les équipements avec durabilité
            );
            if (existing) {
              existing.quantity += item.quantity;
              dirty = true;
              merged++;
            } else {
              merged_inv.push({ ...item });
            }
          }
          newInventory = merged_inv;

          if (dirty) {
            await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });
            profilesFixed++;
            addLog(`✅ ${profile.character_name} — inventaire normalisé (${newInventory.length} items)`);
          }
        }

        // 3. Normaliser les listings de marché actifs sans item_key
        addLog(`\n📦 Normalisation des listings de marché...`);
        let listingsFixed = 0;
        try {
          const listings = await base44.entities.MarketListing.filter({ status: "active" });
          for (const listing of listings) {
            if (!listing.item_key || listing.item_key === "") {
              const resolvedKey = NAME_TO_KEY[listing.item_name];
              if (resolvedKey) {
                await base44.entities.MarketListing.update(listing.id, { item_key: resolvedKey });
                listingsFixed++;
                addLog(`  📋 Listing corrigé : "${listing.item_name}" → ${resolvedKey} (vendeur: ${listing.seller_name})`);
              } else {
                addLog(`  ⚠️ Listing non résolu : "${listing.item_name}" — clé inconnue`);
              }
            }
          }
        } catch(e) { addLog(`  ⚠️ Erreur listings : ${e.message}`); }

        addLog(`\n✔ Migration terminée :`);
        addLog(`  • ${profilesFixed} profil(s) mis à jour`);
        addLog(`  • ${itemsFixed} item_key ajoutés`);
        addLog(`  • ${merged} doublon(s) fusionnés`);
        addLog(`  • ${listingsFixed} listing(s) de marché corrigés`);
      },
    },
  ];

  const runMigration = async (migration) => {
    setRunning(true);
    setLog([]);
    const addLog = (msg) => setLog(prev => [...prev, msg]);
    addLog(`▶ Démarrage : ${migration.label}`);
    addLog(`📋 ${players.length} profil(s) à analyser...`);
    try {
      await migration.run(players, addLog);
      onRefresh?.();
    } catch (e) {
      addLog(`❌ Erreur : ${e.message}`);
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">🔧 Migrations de données</CardTitle>
          <p className="text-sm text-muted-foreground font-body">Corrections rétroactives sur les profils existants. Irréversible — vérifiez avant de lancer.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {MIGRATIONS.map(m => (
            <div key={m.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-heading font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground font-body mt-1">{m.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="font-heading shrink-0"
                  disabled={running}
                  onClick={() => runMigration(m)}
                >
                  {running ? "En cours..." : "Lancer"}
                </Button>
              </div>
              {log.length > 0 && (
                <div className="bg-muted rounded p-3 space-y-1 max-h-48 overflow-y-auto">
                  {log.map((line, i) => (
                    <p key={i} className="text-xs font-mono text-muted-foreground">{line}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const [cities, setCities] = useState([]);
  const [taxHistory, setTaxHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [economyData, setEconomyData] = useState(null);
  const [economyHistory, setEconomyHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null);

  // Forms
  const [newCity, setNewCity] = useState({ name: "", description: "", mayor_name: "", max_population: 6, tax_rate: 10 });
  const [editCity, setEditCity] = useState(null);
  const [forceTaxCity, setForceTaxCity] = useState("");
  const [forceTaxRate, setForceTaxRate] = useState(10);
  const [distCity, setDistCity] = useState("");
  const [distAmount, setDistAmount] = useState(100);

  useEffect(() => {
    base44.auth.me().then(user => {
      setIsAdmin(ADMIN_EMAILS.includes(user?.email || ""));
    }).catch(() => setIsAdmin(false));
    loadAll();
  }, []);

  const [dynamicPrices, setDynamicPrices] = useState(null);
  const [ecoSettings, setEcoSettings] = useState([]);

  async function loadAll() {
    const [c, th, p, economySnaps, ecoSettings] = await Promise.all([
      base44.entities.City.list(),
      base44.entities.TaxHistory.list("-created_date", 30),
      base44.entities.PlayerProfile.list(),
      base44.entities.EconomySnapshot?.list?.("-created_date", 30).catch(() => []) || Promise.resolve([]),
      base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []),
    ]);
    setCities(c);
    setTaxHistory(th);
    setPlayers(p);
    setEconomyHistory(economySnaps || []);
    if (ecoSettings.length > 0) {
      setDynamicPrices(ecoSettings[0].dynamic_prices);
      setEcoSettings(ecoSettings);
    }
    const totalPlayersGold = p.reduce((s, pl) => s + (pl.gold || 0), 0);
    const totalCitiesGold  = c.reduce((s, ct) => s + (ct.gold_treasury || 0), 0);
    setEconomyData({
      totalPlayersGold,
      totalCitiesGold,
      totalCirculation: totalPlayersGold + totalCitiesGold,
      playerCount: p.length,
      richestPlayers: [...p].sort((a,b) => (b.gold||0)-(a.gold||0)).slice(0,5),
      richestCities:  [...c].sort((a,b) => (b.gold_treasury||0)-(a.gold_treasury||0)).slice(0,5),
    });
    setLoading(false);
  }

  // ── IA Controls ──
  const runDailyTick = async () => {
    setRunning(true);
    for (const city of cities) {
      const result = await runMayorTick(city);
      if (result) toast.success(`${city.name} → Taxe: ${result.newTax}% — ${result.reason}`);
    }
    await loadAll();
    setRunning(false);
  };

  // runMayorBuilding et runResourceRotation supprimés (désactivés/obsolètes)

  const runWealthTaxAll = async () => {
    setRunning(true);
    let total = 0;
    for (const city of cities) {
      const result = await runWealthTax(players, city);
      total += result.totalCollected;
    }
    toast.success(`💰 Taxe sur la richesse : ${total} or collecté au total.`);
    await loadAll();
    setRunning(false);
  };

  const runMaintenanceAll = async () => {
    setRunning(true);
    const results = await runMaintenanceCosts(players);
    toast.success(`🏠 Coûts d'entretien prélevés pour ${results.length} joueur(s).`);
    await loadAll();
    setRunning(false);
  };

  const runTreasuryInterestsAll = async () => {
    setRunning(true);
    const results = await runTreasuryInterests(cities, players);
    if (results.length === 0) {
      toast("Aucun intérêt à distribuer (trésoreries vides ou déjà distribués aujourd'hui).");
    } else {
      for (const r of results) {
        toast.success(`🏦 ${r.city} : +${r.perPlayer} or/joueur (${r.players} hab., tréso ${r.treasury} or)`);
      }
    }
    await loadAll();
    setRunning(false);
  };

  const runBuildingMaintenanceAll = async () => {
    setRunning(true);
    let totalDegraded = 0;
    let totalDestroyed = 0;
    for (const city of cities) {
      const result = await runBuildingMaintenance(city);
      if (result.skipped) continue;
      totalDegraded += (result.degraded || []).length;
      totalDestroyed += (result.destroyed || []).length;
      if ((result.destroyed || []).length > 0) {
        toast.error(`💥 ${city.name} : ${result.destroyed.join(", ")} détruits faute d'entretien !`);
      } else if ((result.degraded || []).length > 0) {
        toast(`⬇️ ${city.name} : ${result.degraded.join(", ")} dégradés.`);
      }
    }
    if (totalDegraded === 0 && totalDestroyed === 0) {
      toast.success("✅ Entretien des bâtiments effectué — aucune dégradation.");
    }
    await loadAll();
    setRunning(false);
  };

  // ── Construction admin manuelle ──
  const [adminBuildCity, setAdminBuildCity] = React.useState("");
  const [adminBuildType, setAdminBuildType] = React.useState("");

  const handleAdminBuild = async () => {
    if (!adminBuildCity || !adminBuildType) { toast.error("Choisissez une ville et un bâtiment."); return; }
    const city = cities.find(c => c.id === adminBuildCity);
    if (!city) return;
    const BUILDING_TYPES_KEYS = Object.keys(BUILDING_TYPE_MAP);
    const bType = BUILDING_TYPE_MAP[adminBuildType];
    if (!bType) { toast.error("Bâtiment inconnu."); return; }
    const alreadyHas = (city.buildings || []).some(b => b.building_type === adminBuildType);
    if (alreadyHas && bType.unique) { toast.error(`${bType.name} existe déjà dans cette ville.`); return; }
    const newBuildings = [...(city.buildings || []), {
      building_type: adminBuildType,
      name: bType.name,
      level: 1,
      built_date: new Date().toISOString().split("T")[0],
    }];
    const newMaxPop = bType.popBonus > 0
      ? (city.max_population || 3) + bType.popBonus
      : (city.max_population || 3);
    await base44.entities.City.update(city.id, {
      buildings: newBuildings,
      max_population: newMaxPop,
    });
    toast.success(`🏗️ ${bType.name} construite dans ${city.name} !`);
    await loadAll();
    setAdminBuildType("");
  };

  const handleAdminDestroyBuilding = async (cityId, buildingIdx) => {
    const city = cities.find(c => c.id === cityId);
    if (!city) return;
    const building = (city.buildings || [])[buildingIdx];
    if (!window.confirm(`Supprimer "${building?.name || building?.building_type}" de ${city.name} ?`)) return;
    const newBuildings = (city.buildings || []).filter((_, i) => i !== buildingIdx);
    await base44.entities.City.update(cityId, { buildings: newBuildings });
    toast.success(`🗑️ Bâtiment supprimé.`);
    await loadAll();
  };

  const handleDistribute = async () => {
    if (!distCity || !distAmount) return;
    const city = cities.find(c => c.id === distCity);
    if ((city?.gold_treasury || 0) < distAmount) { toast.error("Trésorerie insuffisante."); return; }
    const share = await distributeTreasury(city, players, distAmount);
    toast.success(`🎉 ${distAmount} or distribués depuis la trésorerie de ${city.name} (${share} or/joueur).`);
    await loadAll();
  };

  const forceTaxForCity = async () => {
    if (!forceTaxCity) return;
    const city = cities.find(c => c.id === forceTaxCity);
    const today = getTodayDateStr();
    await base44.entities.City.update(forceTaxCity, { tax_rate: forceTaxRate, tax_last_updated: today });
    await base44.entities.TaxHistory.create({
      city_id: forceTaxCity, city_name: city?.name,
      tax_rate: forceTaxRate, date: today, reason: "Décision manuelle de l'administrateur",
    });
    toast.success(`Taxe forcée à ${forceTaxRate}% pour ${city?.name}`);
    await loadAll();
  };

  const forceRandomTaxAll = async () => {
    setRunning(true);
    const today = getTodayDateStr();
    for (const city of cities) {
      const newTax = generateDailyTax();
      await base44.entities.City.update(city.id, { tax_rate: newTax, tax_last_updated: today });
      await base44.entities.TaxHistory.create({
        city_id: city.id, city_name: city.name,
        tax_rate: newTax, date: today, reason: "Reset forcé par l'administrateur",
      });
    }
    toast.success("Taxes régénérées pour toutes les villes !");
    await loadAll();
    setRunning(false);
  };

  // ── Cities ──
  const createCity = async () => {
    if (!newCity.name || !newCity.mayor_name) { toast.error("Nom et maire requis"); return; }
    await base44.entities.City.create({
      ...newCity,
      population: 0, level: 1, gold_treasury: 50, buildings: [],
      resources: { bois: 0, pierre: 0, fer: 0, nourriture: 0, tissu: 0, or: 0 },
      tax_last_updated: getTodayDateStr(),
    });
    const cityData = await base44.entities.City.list();
    const created = cityData.find(c => c.name === newCity.name);
    if (created) {
      const resourceTypes = [
        { resource_type: "bois", quantity: 30, max_quantity: 100, base_price: 4 },
        { resource_type: "pierre", quantity: 20, max_quantity: 80, base_price: 5 },
        { resource_type: "fer", quantity: 15, max_quantity: 60, base_price: 8 },
        { resource_type: "nourriture", quantity: 40, max_quantity: 120, base_price: 3 },
        { resource_type: "tissu", quantity: 20, max_quantity: 80, base_price: 6 },
      ];
      for (const r of resourceTypes) {
        await base44.entities.ResourceStock.create({ city_id: created.id, ...r });
      }

    }
    toast.success(`Ville "${newCity.name}" créée !`);
    setNewCity({ name: "", description: "", mayor_name: "", max_population: 6, tax_rate: 10 });
    await loadAll();
  };

  const saveCity = async () => {
    if (!editCity) return;
    await base44.entities.City.update(editCity.id, {
      name: editCity.name, description: editCity.description,
      mayor_name: editCity.mayor_name, max_population: editCity.max_population,
      tax_rate: editCity.tax_rate, gold_treasury: editCity.gold_treasury, level: editCity.level,
    });
    toast.success("Ville mise à jour !");
    setEditCity(null);
    await loadAll();
  };

  const deleteCity = async (city) => {
    if (!window.confirm(`Supprimer "${city.name}" ? Irréversible.`)) return;
    await base44.entities.City.delete(city.id);
    toast.success(`${city.name} supprimée.`);
    await loadAll();
  };

  // ── Players ──
  const resetPlayerGold = async (player, amount) => {
    await base44.entities.PlayerProfile.update(player.id, { gold: amount });
    toast.success(`Or de ${player.character_name} mis à ${amount}`);
    await loadAll();
  };

  const teleportPlayer = async (player, cityId) => {
    await base44.entities.PlayerProfile.update(player.id, {
      city_id: cityId, is_traveling: false,
      travel_destination_id: "", travel_arrival_time: "",
    });
    toast.success(`${player.character_name} téléporté !`);
    await loadAll();
  };

  const deletePlayer = async (player) => {
    if (!window.confirm(`Supprimer le joueur "${player.character_name}" ?`)) return;
    await base44.entities.PlayerProfile.delete(player.id);
    toast.success("Joueur supprimé.");
    await loadAll();
  };

  const giveMarketPermit = async (player) => {
    const inv = [...(player.inventory || [])];
    const existing = inv.find(i => i.item_key === "autorisation_marche");
    if (existing) {
      existing.quantity += 1;
    } else {
      inv.push({ item_key: "autorisation_marche", item_name: "Autorisation de mise sur le marché", item_category: "parchemins", quantity: 1 });
    }
    await base44.entities.PlayerProfile.update(player.id, { inventory: inv });
    toast.success(`📜 Permis marché T1 donné à ${player.character_name}`);
    await loadAll();
  };

  if (isAdmin === null || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="text-6xl">🚫</div>
        <h2 className="font-heading text-2xl font-bold heading-medieval">Accès refusé</h2>
        <p className="text-muted-foreground font-body">Vous n'avez pas les droits administrateur.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold heading-medieval">⚙️ Panneau Administrateur</h2>
          <p className="text-muted-foreground font-body text-sm">Contrôle total sur le jeu.</p>
        </div>
        <Badge className="bg-red-100 text-red-800 border-red-200">Admin</Badge>
      </div>

      <Tabs defaultValue="ia">
        <TabsList className="font-heading flex-wrap h-auto gap-1">
          <TabsTrigger value="ia">🤖 IA & Taxes</TabsTrigger>
          <TabsTrigger value="economie">📊 Économie</TabsTrigger>
          <TabsTrigger value="cities">🏘️ Villes ({cities.length})</TabsTrigger>
          <TabsTrigger value="players">👥 Joueurs ({players.length})</TabsTrigger>
          <TabsTrigger value="message">📢 Message Système</TabsTrigger>
          <TabsTrigger value="gamedata">⚙️ Données Jeu</TabsTrigger>
          <TabsTrigger value="buildings">🏗️ Bâtiments</TabsTrigger>
          <TabsTrigger value="economy">💹 Économie</TabsTrigger>
          <TabsTrigger value="routes">🗺️ Routes</TabsTrigger>
          <TabsTrigger value="market">🛒 Marché</TabsTrigger>
          <TabsTrigger value="taxes">📊 Taxes</TabsTrigger>
          <TabsTrigger value="reset">🔄 Reset</TabsTrigger>
          <TabsTrigger value="inflation">💹 Inflation</TabsTrigger>
          <TabsTrigger value="music">🎵 Musique</TabsTrigger>
          <TabsTrigger value="schemas">📋 Schémas</TabsTrigger>
          <TabsTrigger value="history">📜 Historique</TabsTrigger>
          <TabsTrigger value="migration">🔧 Migration</TabsTrigger>
        </TabsList>

        {/* ── IA & Taxes ── */}
        <TabsContent value="ia" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Actions globales IA</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={runDailyTick} disabled={running} className="font-heading">
                📅 Simuler journée (taxes IA)
              </Button>
              <Button onClick={forceRandomTaxAll} disabled={running} variant="secondary" className="font-heading">
                🎲 Régénérer toutes les taxes
              </Button>
              <Button onClick={runWealthTaxAll} disabled={running} variant="secondary" className="font-heading">
                💰 Prélever taxe richesse
              </Button>
              <Button onClick={runMaintenanceAll} disabled={running} variant="secondary" className="font-heading">
                🏠 Prélever entretien logements
              </Button>
              <Button onClick={runBuildingMaintenanceAll} disabled={running} variant="secondary" className="font-heading">
                🏗️ Entretien bâtiments (entrepôts)
              </Button>
              <Button onClick={runTreasuryInterestsAll} disabled={running} variant="secondary" className="font-heading">
                🏦 Intérêts trésorerie (1%/jour)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">🏗️ Construction manuelle</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground font-body">Construire ou supprimer un bâtiment dans une ville sans coût de ressources — utile pour corriger un bug.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="font-body">Ville</Label>
                  <Select value={adminBuildCity} onValueChange={setAdminBuildCity}>
                    <SelectTrigger><SelectValue placeholder="Choisir une ville" /></SelectTrigger>
                    <SelectContent>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Bâtiment</Label>
                  <Select value={adminBuildType} onValueChange={setAdminBuildType}>
                    <SelectTrigger><SelectValue placeholder="Choisir un bâtiment" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BUILDING_TYPE_MAP).map(([key, b]) => (
                        <SelectItem key={key} value={key}>{b.icon} {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdminBuild} disabled={!adminBuildCity || !adminBuildType} className="font-heading">
                  🏗️ Construire
                </Button>
              </div>
              {adminBuildCity && (() => {
                const city = cities.find(c => c.id === adminBuildCity);
                if (!city || !(city.buildings || []).length) return null;
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-body font-semibold text-muted-foreground">Bâtiments existants :</p>
                    <div className="flex flex-wrap gap-2">
                      {(city.buildings || []).map((b, i) => (
                        <div key={i} className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1 text-xs font-body">
                          <span>{BUILDING_TYPE_MAP[b.building_type]?.icon || "🏗️"} {b.name || b.building_type}</span>
                          <button onClick={() => handleAdminDestroyBuilding(city.id, i)} className="text-red-500 hover:text-red-700 ml-1 font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">🏹 Dépenser la trésorerie</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="font-body">Ville</Label>
                  <Select value={distCity} onValueChange={setDistCity}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name} (💰 {c.gold_treasury || 0} or)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Montant à distribuer</Label>
                  <Input type="number" min={1} value={distAmount} onChange={e => setDistAmount(Number(e.target.value))} />
                </div>
                <Button onClick={handleDistribute} disabled={!distCity} className="font-heading">
                  🎉 Distribuer aux joueurs
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cities.map(c => (
                  <div key={c.id} className="bg-muted/40 rounded-lg p-3 font-body text-sm flex justify-between">
                    <span>🏹 {c.name}</span>
                    <span className="font-semibold">💰 {c.gold_treasury || 0} or en caisse</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Forcer une taxe sur une ville</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="font-body">Ville</Label>
                  <Select value={forceTaxCity} onValueChange={setForceTaxCity}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Taux (%)</Label>
                  <Input type="number" min={0} max={100} value={forceTaxRate} onChange={e => setForceTaxRate(Number(e.target.value))} />
                </div>
                <Button onClick={forceTaxForCity} disabled={!forceTaxCity} className="font-heading">
                  Appliquer la taxe
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Actions par ville</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cities.map(city => (
                <div key={city.id} className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
                  <div>
                    <span className="font-body font-semibold">{city.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 font-body">Taxe actuelle: {city.tax_rate}%</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="font-body text-xs"
                      onClick={async () => {
                        const r = await runMayorTick({ ...city, tax_last_updated: "" });
                        if (r) toast.success(`${city.name} → ${r.newTax}% — ${r.reason}`);
                        await loadAll();
                      }}>
                      📅 Tick
                    </Button>
                    <Button size="sm" variant="outline" className="font-body text-xs"
                      onClick={async () => {
                        const r = await mayerTryBuild(city);
                        if (r) toast.success(`${city.name} → ${r.building}`);
                        else toast(`Ressources insuffisantes.`);
                        await loadAll();
                      }}>
                      🏗️ Construire
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cities ── */}
        <TabsContent value="cities" className="space-y-4 mt-4">
          <Card className="border-primary/20">
            <CardHeader><CardTitle className="font-heading text-lg">➕ Créer une nouvelle ville</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-body">Nom *</Label>
                  <Input value={newCity.name} onChange={e => setNewCity({ ...newCity, name: e.target.value })} placeholder="Ex: Château-Neuf" />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Nom du maire *</Label>
                  <Input value={newCity.mayor_name} onChange={e => setNewCity({ ...newCity, mayor_name: e.target.value })} placeholder="Ex: Bertrand le Sage" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="font-body">Description</Label>
                  <Textarea value={newCity.description} onChange={e => setNewCity({ ...newCity, description: e.target.value })} placeholder="Description de la ville..." rows={2} />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Population max</Label>
                  <Input type="number" min={2} value={newCity.max_population} onChange={e => setNewCity({ ...newCity, max_population: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Taxe initiale (%)</Label>
                  <Input type="number" min={0} max={100} value={newCity.tax_rate} onChange={e => setNewCity({ ...newCity, tax_rate: Number(e.target.value) })} />
                </div>
              </div>
              <Button onClick={createCity} className="font-heading">Créer la ville</Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {cities.map(city => (
              <Card key={city.id}>
                <CardContent className="p-4">
                  {editCity?.id === city.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="font-body">Nom</Label>
                          <Input value={editCity.name} onChange={e => setEditCity({ ...editCity, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body">Maire</Label>
                          <Input value={editCity.mayor_name} onChange={e => setEditCity({ ...editCity, mayor_name: e.target.value })} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label className="font-body">Description</Label>
                          <Textarea value={editCity.description || ""} onChange={e => setEditCity({ ...editCity, description: e.target.value })} rows={2} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body">Pop. max</Label>
                          <Input type="number" value={editCity.max_population} onChange={e => setEditCity({ ...editCity, max_population: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body">Taxe (%)</Label>
                          <Input type="number" value={editCity.tax_rate} onChange={e => setEditCity({ ...editCity, tax_rate: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body">Trésorerie (or)</Label>
                          <Input type="number" value={editCity.gold_treasury || 0} onChange={e => setEditCity({ ...editCity, gold_treasury: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body">Niveau</Label>
                          <Input type="number" value={editCity.level || 1} onChange={e => setEditCity({ ...editCity, level: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={saveCity} className="font-heading">Sauvegarder</Button>
                        <Button variant="outline" onClick={() => setEditCity(null)} className="font-body">Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-heading font-bold">{city.name}</h3>
                        <p className="text-xs text-muted-foreground font-body">
                          👑 {city.mayor_name} · 💰 {city.tax_rate}% · 👥 {city.population || 0}/{city.max_population} · Niv.{city.level || 1}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditCity({ ...city })} className="font-body text-xs">Modifier</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteCity(city)} className="font-body text-xs">Supprimer</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Players ── */}
        <TabsContent value="players" className="space-y-3 mt-4">
          {players.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground font-body">Aucun joueur.</CardContent></Card>
          ) : players.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold font-body">{p.character_name}</div>
                    <div className="text-xs text-muted-foreground font-body">{p.profession} · {p.user_email}</div>
                    <div className="text-xs font-body mt-0.5">
                      💰 {p.gold || 0} or · ⚡ {p.fatigue ?? 100}/100 · {p.is_traveling ? "🐴 En voyage" : "🏘️ " + (cities.find(c => c.id === p.city_id)?.name || "?")}
                    </div>
                  </div>
                  <Badge variant={p.is_traveling ? "default" : "secondary"} className="text-xs">
                    {p.housing_level || "tente"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <Input type="number" className="w-24 h-7 text-xs" defaultValue={p.gold || 0} id={`gold-${p.id}`} />
                    <Button size="sm" variant="outline" className="h-7 text-xs font-body"
                      onClick={() => {
                        const val = Number(document.getElementById(`gold-${p.id}`).value);
                        resetPlayerGold(p, val);
                      }}>
                      Modifier or
                    </Button>
                  </div>
                  <Select onValueChange={cityId => teleportPlayer(p, cityId)}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Téléporter..." /></SelectTrigger>
                    <SelectContent>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-7 text-xs font-body border-amber-300 text-amber-800 hover:bg-amber-50" onClick={() => giveMarketPermit(p)}>
                    📜 Donner permis
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs font-body" onClick={() => deletePlayer(p)}>
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Schemas ── */}
        <TabsContent value="schemas" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">🏗️ Coûts de construction des bâtiments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(BUILDING_TYPES).map(([key, b]) => (
                <div key={key} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{b.icon}</span>
                    <span className="font-heading font-semibold">{b.name}</span>
                    <Badge variant="secondary" className="font-body text-xs ml-auto">+{b.popBonus} pop</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(b.cost || {}).map(([res, qty]) => (
                      <span key={res} className="text-xs bg-muted border border-border rounded px-2 py-1 font-body">
                        {res} ×{qty}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">⚒️ Recettes de fabrication</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {CRAFTING_RECIPES.map(recipe => {
                const outItem = ITEMS[recipe.output.key];
                return (
                  <div key={recipe.id} className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-2">
                    <span className="text-lg">{recipe.icon}</span>
                    <span className="font-body font-semibold text-sm">{recipe.name}</span>
                    <Badge variant="outline" className="text-xs font-body">Tier {outItem?.tier}</Badge>
                    <div className="flex flex-wrap gap-1.5 ml-2 items-center">
                      {recipe.inputs.map((inp, i) => {
                        const inItem = ITEMS[inp.key];
                        return (
                          <span key={inp.key} className="flex items-center gap-1 text-xs font-body">
                            {i > 0 && <span className="text-muted-foreground">+</span>}
                            <span className="bg-muted border border-border rounded px-1.5 py-0.5">
                              {inItem?.icon} {inItem?.name} ×{inp.quantity}
                            </span>
                          </span>
                        );
                      })}
                      <span className="text-muted-foreground text-xs">→</span>
                      <span className="bg-green-50 border border-green-200 text-green-800 rounded px-1.5 py-0.5 text-xs font-body">
                        {outItem?.icon} {outItem?.name} ×{recipe.output.quantity}
                      </span>
                      {outItem?.use && (
                        <span className="text-xs text-muted-foreground font-body italic ml-1">{outItem.use}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">🌾 Production par métier</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(PROFESSION_PRODUCTION).map(([prof, recipes]) => {
                const profData = PROFESSIONS[prof];
                return (
                  <div key={prof} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{profData?.icon || "👤"}</span>
                      <span className="font-heading font-semibold">{prof}</span>
                    </div>
                    <div className="space-y-1.5">
                      {recipes.map(r => {
                        const outItem = ITEMS[r.outputKey];
                        return (
                          <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs font-body bg-muted/50 rounded px-2 py-1.5">
                            <span>{r.icon} {r.name}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-semibold">{outItem?.icon} ×{r.quantity} {outItem?.name}</span>
                            <span className="text-muted-foreground ml-auto">
                              ⏱️ {r.cooldown}s
                              {r.costGold > 0 && <span className="ml-2">💰{r.costGold}</span>}
                            </span>
                            {r.requiresItems && (
                              <div className="w-full flex gap-1 flex-wrap mt-0.5">
                                <span className="text-muted-foreground">Nécessite :</span>
                                {r.requiresItems.map(req => {
                                  const reqItem = ITEMS[req.key];
                                  return (
                                    <span key={req.key} className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-1.5 py-0.5">
                                      {reqItem?.icon} {reqItem?.name} ×{req.quantity}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">⚡ Nourriture & Récupération d'énergie</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(ITEMS)
                  .filter(([, v]) => v.fatigue_restore && v.category === "nourriture")
                  .map(([key, item]) => (
                    <div key={key} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2 text-sm font-body">
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-semibold">{item.name}</span>
                      <Badge variant="outline" className="text-xs">Tier {item.tier}</Badge>
                      <span className="ml-auto text-green-700 font-semibold">+{item.fatigue_restore} ⚡</span>
                    </div>
                  ))}
                <div className="flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-sm font-body">
                  <span className="text-xl">🛌</span>
                  <span className="font-semibold text-amber-900">Nuit à la taverne</span>
                  <span className="text-xs text-amber-700 ml-2">Prix IA quotidien variable</span>
                  <span className="ml-auto text-green-700 font-semibold">+20 à +60 ⚡</span>
                </div>
                <p className="text-xs text-muted-foreground font-body pt-1">
                  ℹ️ Chaque action (récolte, fabrication) coûte 1⚡. La jauge maximale est de 100⚡. Récupération quotidienne : +50⚡ automatique chaque jour.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Message Système ── */}
        <TabsContent value="message" className="mt-4">
          <SystemMessageManager />
        </TabsContent>

        {/* ── Données Jeu ── */}
        <TabsContent value="gamedata" className="mt-4">
          <GameDataManager />
        </TabsContent>

        {/* ── Bâtiments ── */}
        <TabsContent value="buildings" className="mt-4">
          <BuildingTypeManager />
        </TabsContent>

        {/* ── Économie ── */}
        <TabsContent value="economy" className="mt-4">
          <EconomySettingsManager />
        </TabsContent>

        {/* ── Routes ── */}
        <TabsContent value="routes" className="mt-4">
          <TravelRouteManager />
        </TabsContent>

        {/* ── Marché ── */}
        <TabsContent value="market" className="mt-4">
          <MarketModerator />
        </TabsContent>

        <TabsContent value="taxes" className="mt-4">
          <TaxAuditPanel />
        </TabsContent>

        {/* ── Reset ── */}
        <TabsContent value="reset" className="mt-4">
          <DailyResetManager />
        </TabsContent>

        {/* ── Inflation Monitor ── */}
        <TabsContent value="inflation" className="mt-4">
          <InflationMonitor />
        </TabsContent>

        {/* ── Musique ── */}
        <TabsContent value="music" className="mt-4">
          <MusicManager />

          {/* ── Gestion Sceau royal ── */}
          <Card className="mt-4 border-amber-200">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                🏵️ Sceau royal — Événement monétaire
              </CardTitle>
              <p className="text-sm text-muted-foreground font-body">
                Quand l'or moyen dépasse le seuil (~400💰/joueur), mettez des Sceaux en vente dans les mairies.
                L'or d'achat est détruit (sink). La valeur du Sceau (110💰) absorbe taxes et impôts.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats économiques */}
              {ecoSettings.length > 0 && (() => {
                const eco = ecoSettings[0];
                const avg = eco.or_moyen_par_joueur || 0;
                const threshold = 400;
                const excess = Math.max(0, avg - threshold);
                return (
                  <div className={`rounded-lg border p-3 text-sm font-body ${avg > threshold ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
                    <div className="flex items-center justify-between">
                      <span>Or moyen par joueur :</span>
                      <span className={`font-bold ${avg > threshold ? "text-red-700" : "text-green-700"}`}>{avg}💰</span>
                    </div>
                    {avg > threshold && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Seuil dépassé de {excess}💰/joueur — recommandé : lancer l'événement Sceau royal.</p>
                    )}
                    {avg <= threshold && (
                      <p className="text-xs text-green-600 mt-1">✅ Économie dans les limites normales.</p>
                    )}
                  </div>
                );
              })()}

              {/* Mise en vente globale dans toutes les villes */}
              <div className="space-y-2">
                <p className="text-sm font-heading font-semibold">Mettre en vente dans toutes les villes :</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="number" min={0} max={100} defaultValue={10}
                    id="sceau-qty-input"
                    className="w-20 h-8 text-sm text-center border border-amber-300 rounded font-body"
                  />
                  <span className="text-sm font-body text-muted-foreground">sceaux par ville</span>
                  <Button size="sm" className="font-heading bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={async () => {
                      const qty = parseInt(document.getElementById("sceau-qty-input")?.value) || 0;
                      if (qty <= 0) { toast.error("Entrez une quantité > 0"); return; }
                      const allCities = await base44.entities.City.list().catch(() => []);
                      const realCities = allCities.filter(c => !c.is_bot_city);
                      let updated = 0;
                      for (const city of realCities) {
                        await base44.entities.City.update(city.id, { sceaux_en_vente: qty }).catch(() => {});
                        updated++;
                      }
                      toast.success(`🏵️ ${qty} Sceau(x) mis en vente dans ${updated} ville(s) !`);
                      loadAll();
                    }}>
                    🏵️ Lancer l'événement
                  </Button>
                  <Button size="sm" variant="outline" className="font-heading"
                    onClick={async () => {
                      const allCities = await base44.entities.City.list().catch(() => []);
                      for (const city of allCities.filter(c => !c.is_bot_city)) {
                        await base44.entities.City.update(city.id, { sceaux_en_vente: 0 }).catch(() => {});
                      }
                      toast.success("Événement Sceau royal terminé — plus de sceaux en vente.");
                      loadAll();
                    }}>
                    Terminer l'événement
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-body italic">
                  Prix : 100💰 (détruit) → valeur : 110💰 absorbés sur taxes/impôts.
                </p>
              </div>

              {/* État actuel par ville */}
              <div className="space-y-1">
                <p className="text-sm font-heading font-semibold">Stock actuel par ville :</p>
                {cities.filter(c => !c.is_bot_city).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs font-body border border-border rounded px-3 py-1.5">
                    <span>{c.name}</span>
                    <span className={`font-semibold ${(c.sceaux_en_vente || 0) > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {c.sceaux_en_vente || 0} sceau(x)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tax History ── */}
        <TabsContent value="history" className="space-y-2 mt-4">
          {taxHistory.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground font-body">Aucun historique. Lancez une simulation.</CardContent></Card>
          ) : taxHistory.map(t => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold font-body text-sm">{t.city_name}</div>
                  <div className="text-xs text-muted-foreground font-body">{t.reason}</div>
                </div>
                <div className="text-right text-sm font-body">
                  <div className="font-semibold">{t.tax_rate}%</div>
                  <div className="text-muted-foreground text-xs">{t.date}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        {/* ── ÉCONOMIE ── */}
        <TabsContent value="economie" className="space-y-4 mt-4">
          {economyData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground font-body">Or joueurs</div>
                  <div className="font-heading font-bold text-green-700 text-lg">{economyData.totalPlayersGold.toLocaleString()} 💰</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground font-body">Or villes</div>
                  <div className="font-heading font-bold text-blue-700 text-lg">{economyData.totalCitiesGold.toLocaleString()} 💰</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground font-body">Total circulation</div>
                  <div className="font-heading font-bold text-amber-700 text-lg">{economyData.totalCirculation.toLocaleString()} 💰</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground font-body">Joueurs actifs</div>
                  <div className="font-heading font-bold text-lg">{economyData.playerCount}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="font-heading text-sm">🏆 Top 5 joueurs (or)</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {economyData.richestPlayers.map((pl, i) => (
                      <div key={pl.id} className="flex justify-between text-sm font-body">
                        <span>{i+1}. {pl.character_name} ({pl.profession})</span>
                        <span className="font-semibold">{(pl.gold||0).toLocaleString()} 💰</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="font-heading text-sm">🏙️ Top 5 villes (trésorerie)</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {economyData.richestCities.map((ct, i) => (
                      <div key={ct.id} className="flex justify-between text-sm font-body">
                        <span>{i+1}. {ct.name}</span>
                        <span className="font-semibold">{(ct.gold_treasury||0).toLocaleString()} 💰</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {economyHistory.length > 0 && (
               <Card>
                 <CardHeader><CardTitle className="font-heading text-sm">📈 Historique 30 jours</CardTitle></CardHeader>
                 <CardContent>
                   <div className="space-y-1 max-h-64 overflow-y-auto">
                     {economyHistory.map((snap, i) => (
                       <div key={i} className="flex justify-between text-xs font-body border-b pb-1">
                         <span className="text-muted-foreground">{snap.date}</span>
                         <span>Joueurs: {(snap.total_players_gold||0).toLocaleString()}💰</span>
                         <span>Villes: {(snap.total_cities_gold||0).toLocaleString()}💰</span>
                         <span className="font-semibold">Total: {(snap.total_circulation||0).toLocaleString()}💰</span>
                       </div>
                     ))}
                   </div>
                 </CardContent>
               </Card>
              )}

              {dynamicPrices && (
               <Card>
                 <CardHeader><CardTitle className="font-heading text-sm">🏷️ Prix dynamiques (T2-T5) - Cachés aux joueurs</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                   {Object.entries(dynamicPrices).map(([tier, items]) => (
                     <div key={tier} className="border border-border rounded-lg p-3">
                       <h4 className="font-heading font-semibold text-sm mb-2">{tier.toUpperCase()}</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                         {Object.entries(items).map(([itemKey, prices]) => (
                           <div key={itemKey} className="text-xs font-body bg-muted/50 rounded p-2">
                             <span className="font-semibold">{itemKey}</span>
                             <span className="text-muted-foreground ml-2">Min: {prices.min}💰 — Max: {prices.max}💰</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   ))}
                   <p className="text-xs text-muted-foreground font-body italic mt-2">💡 Les métiers secondaires rendront ces prix visibles aux joueurs</p>
                 </CardContent>
               </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Migration ── */}
        <TabsContent value="migration" className="mt-4">
          <MigrationPanel players={players} onRefresh={loadAll} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

