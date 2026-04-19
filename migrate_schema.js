#!/usr/bin/env node
/**
 * Script de migration base44 → PocketBase
 * Crée toutes les collections avec leurs champs
 * 
 * Usage :
 *   1. Installer PocketBase : https://pocketbase.io/docs/
 *   2. Lancer PocketBase : ./pocketbase serve
 *   3. Créer un compte admin sur http://localhost:8090/_/
 *   4. Exécuter : ADMIN_EMAIL=admin@mail.com ADMIN_PASSWORD=motdepasse node migrate_schema.js
 */

const PB_URL   = process.env.PB_URL   || 'http://localhost:8090';
const EMAIL    = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Usage: ADMIN_EMAIL=x ADMIN_PASSWORD=y node migrate_schema.js');
  process.exit(1);
}

// ── Définition de toutes les collections ──────────────────────
const COLLECTIONS = [

  // ── Utilisateurs (gérée par PocketBase nativement) ──
  // La collection "users" existe déjà, on ajoute juste les champs custom
  {
    name: 'users',
    type: 'auth',
    fields: [
      { name: 'name',       type: 'text' },
      { name: 'avatar_url', type: 'url'  },
    ]
  },

  // ── PlayerProfile ──
  {
    name: 'player_profiles',
    type: 'base',
    fields: [
      { name: 'user_email',        type: 'email'  },
      { name: 'character_name',    type: 'text'   },
      { name: 'profession',        type: 'text'   },
      { name: 'city_id',           type: 'text'   },
      { name: 'home_city_id',      type: 'text'   },
      { name: 'gold',              type: 'number', options: { min: 0 } },
      { name: 'inventory',         type: 'json'   },
      { name: 'housing_level',     type: 'text'   },
      { name: 'hunger',            type: 'number' },
      { name: 'fatigue',           type: 'number' },
      { name: 'player_xp_total',   type: 'number' },
      { name: 'player_level',      type: 'number' },
      { name: 'login_streak',      type: 'number' },
      { name: 'last_login_date',   type: 'text'   },
      { name: 'production_cooldowns', type: 'json' },
      { name: 'tool_charges',      type: 'number' },
      { name: 'is_traveling',      type: 'bool'   },
      { name: 'travel_destination_id', type: 'text' },
      { name: 'travel_arrival_time',   type: 'date' },
      { name: 'visited_cities',    type: 'json'   },
      { name: 'daily_tax_paid',    type: 'text'   },
      { name: 'pending_market_tax',type: 'number' },
      { name: 'sceau_balance',     type: 'number' },
      { name: 'active_loans',      type: 'json'   },
      { name: 'active_deposits',   type: 'json'   },
      { name: 'debt_by_city',      type: 'json'   },
      { name: 'atelier_vitrine',   type: 'json'   },
      // Buffs temporaires
      { name: 'cooldown_bonus_expires_at',      type: 'text' },
      { name: 'cooldown_bonus_value',           type: 'number' },
      { name: 'energy_max_bonus_expires_at',    type: 'text' },
      { name: 'energy_max_bonus_value',         type: 'number' },
      { name: 'energy_regen_bonus_expires_at',  type: 'text' },
      { name: 'energy_regen_interval_min',      type: 'number' },
      { name: 'energy_regen_value',             type: 'number' },
      { name: 'attack_bonus_expires_at',        type: 'text' },
      { name: 'attack_bonus_value',             type: 'number' },
      { name: 'defense_bonus_expires_at',       type: 'text' },
      { name: 'defense_bonus_value',            type: 'number' },
      { name: 'hunger_regen_bonus_expires_at',  type: 'text' },
      { name: 'hunger_regen_interval_min',      type: 'number' },
      { name: 'hunger_regen_value',             type: 'number' },
      { name: 'inventory_bonus_expires_at',     type: 'text' },
      { name: 'inventory_bonus_value',          type: 'number' },
      { name: 'travel_discount',                type: 'number' },
      { name: 'meuble_expires_at',              type: 'text' },
      { name: 'meuble_discount',                type: 'number' },
      { name: 'double_prod_bonus',              type: 'number' },
      { name: 'double_prod_bonus_expires_at',   type: 'text' },
      { name: 'biome_cooldown_bonus_expires_at',type: 'text' },
      { name: 'biome_cooldown_bonus_value',     type: 'number' },
      { name: 'biome_double_prod_bonus',        type: 'number' },
      { name: 'biome_harvest_bonus_expires_at', type: 'text' },
      { name: 'biome_mastery',                  type: 'json' },
      { name: 'daily_combats_count',            type: 'number' },
      { name: 'daily_combats_date',             type: 'text' },
      { name: 'harvest_started_at',             type: 'text' },
      { name: 'harvest_biome_key',              type: 'text' },
      { name: 'harvest_gold_spent',             type: 'number' },
      { name: 'biome_combat_started_at',        type: 'text' },
      { name: 'biome_combat_monster_id',        type: 'text' },
      { name: 'biome_combat_duration',          type: 'number' },
      { name: 'biome_combat_resolved',          type: 'bool' },
      { name: 'biome_combat_result',            type: 'json' },
      { name: 'sex',                            type: 'text' },
      { name: 'height',                         type: 'number' },
      { name: 'avatar_url',                     type: 'text' },
      { name: 'last_active_at',                 type: 'text' },
      { name: 'inactivity_warned_at',           type: 'text' },
      { name: 'vacation_until',                 type: 'text' },
      { name: 'sceau_last_bought',              type: 'text' },
      { name: 'last_travel_route_id',           type: 'text' },
      { name: 'streak_rewarded_today',          type: 'bool' },
      { name: 'epidemie_malus_until',           type: 'text' },
      { name: 'cumul_ventes_or',                type: 'number' },
      { name: 'cumul_contributions_warehouse',  type: 'number' },
      { name: 'cumul_t5_envoyes',               type: 'number' },
      { name: 'warehouse_sold_today',           type: 'number' },
      { name: 'hunger_regen_at',                type: 'text' },
      { name: 'fatigue_regen_at',               type: 'text' },
      { name: 'fatigue_last_reset',             type: 'text' },
      { name: 'tavern_sleep_date',              type: 'text' },
      { name: 'active_parchemin_type',          type: 'text' },
      { name: 'bot_trade_cooldowns',            type: 'json' },
      { name: 'competitive_cooldowns',          type: 'json' },
      { name: 'convoi_expires_at',              type: 'text' },
      { name: 'daily_tax_collected_player',     type: 'number' },
      { name: 'banker_rates',                   type: 'json' },
      { name: 'loan_defaulted',                 type: 'bool' },
      { name: 'housing_obtained_free',          type: 'bool' },
      { name: 'biome_harvest_bonus',            type: 'number' },
    ]
  },

  // ── City ──
  {
    name: 'cities',
    type: 'base',
    fields: [
      { name: 'name',                   type: 'text'   },
      { name: 'gold_treasury',          type: 'number' },
      { name: 'treasury_cumulative',    type: 'number' },
      { name: 'tax_rate',               type: 'number' },
      { name: 'tax_rate_next',          type: 'number' },
      { name: 'daily_tax_per_player',   type: 'number' },
      { name: 'daily_tax_collected',    type: 'number' },
      { name: 'daily_mayor_cost',       type: 'number' },
      { name: 'mayor_id',               type: 'text'   },
      { name: 'mayor_name',             type: 'text'   },
      { name: 'mayor_until',            type: 'text'   },
      { name: 'mayor_message',          type: 'text'   },
      { name: 'election_candidates',    type: 'json'   },
      { name: 'election_votes',         type: 'json'   },
      { name: 'buildings',              type: 'json'   },
      { name: 'warehouse',              type: 'json'   },
      { name: 'warehouse_sales',        type: 'json'   },
      { name: 'resident_salary',        type: 'number' },
      { name: 'resident_salary_enabled',type: 'bool'   },
      { name: 'lingots_cumul',          type: 'number' },
      { name: 'pending_effects',        type: 'json'   },
      { name: 'contrat_noble_active',   type: 'bool'   },
      { name: 'sceaux_en_vente',        type: 'number' },
      { name: 'rachat_t1_offers',       type: 'json'   },
      { name: 'rachat_t2t3_offers',     type: 'json'   },
      { name: 'rachat_t1_bought_today', type: 'json'   },
      { name: 'rachat_t2t3_bought_today',type:'json'   },
      { name: 'warehouse_rachat_enabled',type:'bool'   },
      { name: 'army_food',              type: 'number' },
      { name: 'army_energy',            type: 'number' },
      { name: 'tax_last_updated',       type: 'text'   },
      { name: 'reset_date',             type: 'text'   },
      { name: 'bank_deposit_rate',      type: 'number' },
      { name: 'bank_loan_rate',         type: 'number' },
      { name: 'bank_max_loan',          type: 'number' },
      { name: 'bank_enabled',           type: 'bool'   },
    ]
  },

  // ── MarketListing ──
  {
    name: 'market_listings',
    type: 'base',
    fields: [
      { name: 'seller_email',      type: 'email'  },
      { name: 'seller_name',       type: 'text'   },
      { name: 'city_id',           type: 'text'   },
      { name: 'item_key',          type: 'text'   },
      { name: 'item_name',         type: 'text'   },
      { name: 'item_category',     type: 'text'   },
      { name: 'item_tier',         type: 'number' },
      { name: 'price_per_unit',    type: 'number' },
      { name: 'quantity',          type: 'number' },
      { name: 'quantity_initial',  type: 'number' },
      { name: 'status',            type: 'text'   },
      { name: 'created_date',      type: 'text'   },
      { name: 'expires_at',        type: 'text'   },
    ]
  },

  // ── PlayerObjective ──
  {
    name: 'player_objectives',
    type: 'base',
    fields: [
      { name: 'player_email',       type: 'email'  },
      { name: 'city_id',            type: 'text'   },
      { name: 'target_city_id',     type: 'text'   },
      { name: 'type',               type: 'text'   },
      { name: 'title',              type: 'text'   },
      { name: 'description',        type: 'text'   },
      { name: 'target_item',        type: 'text'   },
      { name: 'target_quantity',    type: 'number' },
      { name: 'current_quantity',   type: 'number' },
      { name: 'reward_gold',        type: 'number' },
      { name: 'status',             type: 'text'   },
      { name: 'created_date',       type: 'text'   },
      { name: 'completed_date',     type: 'text'   },
    ]
  },

  // ── GoldTransaction ──
  {
    name: 'gold_transactions',
    type: 'base',
    fields: [
      { name: 'player_email',    type: 'email'  },
      { name: 'character_name',  type: 'text'   },
      { name: 'city_id',         type: 'text'   },
      { name: 'city_name',       type: 'text'   },
      { name: 'amount',          type: 'number' },
      { name: 'type',            type: 'text'   },
      { name: 'description',     type: 'text'   },
      { name: 'date',            type: 'text'   },
    ]
  },

  // ── TavernMessage ──
  {
    name: 'tavern_messages',
    type: 'base',
    fields: [
      { name: 'city_id',      type: 'text'  },
      { name: 'author_email', type: 'email' },
      { name: 'author_name',  type: 'text'  },
      { name: 'profession',   type: 'text'  },
      { name: 'message',      type: 'text'  },
      { name: 'is_active',    type: 'bool'  },
    ]
  },

  // ── CityArmy ──
  {
    name: 'city_armies',
    type: 'base',
    fields: [
      { name: 'city_id',          type: 'text'   },
      { name: 'units',            type: 'json'   },
      { name: 'last_maintenance', type: 'text'   },
    ]
  },

  // ── MilitaryCampaign ──
  {
    name: 'military_campaigns',
    type: 'base',
    fields: [
      { name: 'attacker_city_id',    type: 'text'   },
      { name: 'defender_city_id',    type: 'text'   },
      { name: 'attacker_city_name',  type: 'text'   },
      { name: 'defender_city_name',  type: 'text'   },
      { name: 'status',              type: 'text'   },
      { name: 'units_committed',     type: 'json'   },
      { name: 'result',              type: 'json'   },
      { name: 'declaration_date',    type: 'text'   },
      { name: 'resolution_date',     type: 'text'   },
    ]
  },

  // ── TravelRoute ──
  {
    name: 'travel_routes',
    type: 'base',
    fields: [
      { name: 'city_from_id',   type: 'text'   },
      { name: 'city_to_id',     type: 'text'   },
      { name: 'road_type',      type: 'text'   },
      { name: 'duration_min',   type: 'number' },
      { name: 'is_active',      type: 'bool'   },
    ]
  },

  // ── EconomySettings ──
  {
    name: 'economy_settings',
    type: 'base',
    fields: [
      { name: 'setting_key',               type: 'text'   },
      { name: 'or_moyen_par_joueur',        type: 'number' },
      { name: 'dynamic_prices',             type: 'json'   },
      { name: 'world_events',               type: 'json'   },
      { name: 'objective_reward_multiplier',type: 'number' },
      { name: 'last_reset_date',            type: 'text'   },
      { name: 'market_tax_rate',            type: 'number' },
    ]
  },

  // ── DailyReset ──
  {
    name: 'daily_resets',
    type: 'base',
    fields: [
      { name: 'reset_date',    type: 'text' },
      { name: 'status',        type: 'text' },
      { name: 'completed_at',  type: 'text' },
      { name: 'errors',        type: 'json' },
    ]
  },

  // ── Bounty ──
  {
    name: 'bounties',
    type: 'base',
    fields: [
      { name: 'poster_email',   type: 'email'  },
      { name: 'poster_name',    type: 'text'   },
      { name: 'target_email',   type: 'email'  },
      { name: 'target_name',    type: 'text'   },
      { name: 'city_id',        type: 'text'   },
      { name: 'reward_gold',    type: 'number' },
      { name: 'reason',         type: 'text'   },
      { name: 'status',         type: 'text'   },
      { name: 'created_date',   type: 'text'   },
      { name: 'claimed_date',   type: 'text'   },
      { name: 'claimer_email',  type: 'email'  },
    ]
  },

  // ── BankDeposit ──
  {
    name: 'bank_deposits',
    type: 'base',
    fields: [
      { name: 'player_email',  type: 'email'  },
      { name: 'city_id',       type: 'text'   },
      { name: 'amount',        type: 'number' },
      { name: 'interest_rate', type: 'number' },
      { name: 'due_at',        type: 'text'   },
      { name: 'status',        type: 'text'   },
      { name: 'type',          type: 'text'   },
      { name: 'created_date',  type: 'text'   },
    ]
  },

  // ── SystemMessage ──
  {
    name: 'system_messages',
    type: 'base',
    fields: [
      { name: 'message',    type: 'text' },
      { name: 'is_active',  type: 'bool' },
      { name: 'type',       type: 'text' },
    ]
  },

  // ── Music ──
  {
    name: 'music',
    type: 'base',
    fields: [
      { name: 'title',      type: 'text' },
      { name: 'url',        type: 'url'  },
      { name: 'is_active',  type: 'bool' },
      { name: 'order',      type: 'number' },
    ]
  },

  // ── EconomySnapshot ──
  {
    name: 'economy_snapshots',
    type: 'base',
    fields: [
      { name: 'date',                type: 'text'   },
      { name: 'total_gold',          type: 'number' },
      { name: 'avg_gold_per_player', type: 'number' },
      { name: 'nb_players',          type: 'number' },
      { name: 'nb_transactions',     type: 'number' },
    ]
  },

  // ── TaxHistory ──
  {
    name: 'tax_history',
    type: 'base',
    fields: [
      { name: 'city_id',    type: 'text'   },
      { name: 'date',       type: 'text'   },
      { name: 'amount',     type: 'number' },
      { name: 'type',       type: 'text'   },
      { name: 'details',    type: 'json'   },
    ]
  },

  // ── TradeHistory ──
  {
    name: 'trade_history',
    type: 'base',
    fields: [
      { name: 'seller_email',  type: 'email'  },
      { name: 'buyer_email',   type: 'email'  },
      { name: 'item_key',      type: 'text'   },
      { name: 'quantity',      type: 'number' },
      { name: 'price_per_unit',type: 'number' },
      { name: 'city_id',       type: 'text'   },
      { name: 'date',          type: 'text'   },
      { name: 'tax_paid',      type: 'number' },
      { name: 'gold_net',      type: 'number' },
    ]
  },
];

// ── Création via l'API Admin PocketBase ───────────────────────
async function migrate() {
  console.log(`\n🏰 Migration Guildes & Couronnes → PocketBase\n`);
  console.log(`URL : ${PB_URL}`);

  // 1. Authentification admin
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  });
  const { token } = await authRes.json();
  if (!token) { console.error('❌ Auth admin échouée'); process.exit(1); }
  console.log('✅ Auth admin OK\n');

  const headers = { 'Content-Type': 'application/json', 'Authorization': token };

  // 2. Lister les collections existantes
  const listRes = await fetch(`${PB_URL}/api/collections?perPage=200`, { headers });
  const { items: existing } = await listRes.json();
  const existingNames = new Set(existing.map(c => c.name));

  // 3. Créer chaque collection
  let created = 0, skipped = 0, errors = 0;

  for (const col of COLLECTIONS) {
    if (existingNames.has(col.name)) {
      console.log(`⏭️  ${col.name} — existe déjà`);
      skipped++;
      continue;
    }

    const body = {
      name: col.name,
      type: col.type || 'base',
      schema: col.fields.map((f, i) => ({
        name: f.name,
        type: f.type,
        required: false,
        unique: false,
        options: f.options || {},
      })),
      indexes: [],
      listRule: col.type === 'auth' ? '' : '@request.auth.id != ""',
      viewRule: col.type === 'auth' ? '' : '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: null,
    };

    const res = await fetch(`${PB_URL}/api/collections`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      console.log(`✅ ${col.name} (${col.fields.length} champs)`);
      created++;
    } else {
      const err = await res.json();
      console.error(`❌ ${col.name} : ${JSON.stringify(err.message || err)}`);
      errors++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✅ Créées  : ${created}`);
  console.log(`⏭️  Ignorées : ${skipped}`);
  console.log(`❌ Erreurs  : ${errors}`);
  console.log(`\n🎉 Migration terminée !`);
  console.log(`\nProchaine étape :`);
  console.log(`  1. Copier pocketbaseClient.js → src/api/base44Client.js`);
  console.log(`  2. Copier AuthContextPB.jsx   → src/lib/AuthContext.jsx`);
  console.log(`  3. npm install pocketbase`);
  console.log(`  4. Ajouter VITE_PB_URL=https://ton-domaine.com dans .env`);
}

migrate().catch(console.error);
