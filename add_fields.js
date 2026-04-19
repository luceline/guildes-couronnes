/**
 * Ajoute les champs manquants dans PocketBase un par un
 * Usage : $env:PB_EMAIL="x"; $env:PB_PASS="y"; node add_fields.js
 */
const PB_URL   = 'http://178.104.201.139';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS  = process.env.PB_PASS  || '';

const FIELDS = {
  "player_profiles": [
    {
      "name": "user_email",
      "type": "email"
    },
    {
      "name": "character_name",
      "type": "text"
    },
    {
      "name": "sex",
      "type": "text"
    },
    {
      "name": "height",
      "type": "text"
    },
    {
      "name": "profession",
      "type": "text"
    },
    {
      "name": "city_id",
      "type": "text"
    },
    {
      "name": "home_city_id",
      "type": "text"
    },
    {
      "name": "gold",
      "type": "number"
    },
    {
      "name": "debt_by_city",
      "type": "json"
    },
    {
      "name": "inventory",
      "type": "json"
    },
    {
      "name": "housing_level",
      "type": "text"
    },
    {
      "name": "housing_obtained_free",
      "type": "bool"
    },
    {
      "name": "is_traveling",
      "type": "bool"
    },
    {
      "name": "travel_destination_id",
      "type": "text"
    },
    {
      "name": "travel_arrival_time",
      "type": "text"
    },
    {
      "name": "production_cooldowns",
      "type": "json"
    },
    {
      "name": "fatigue",
      "type": "number"
    },
    {
      "name": "fatigue_last_reset",
      "type": "text"
    },
    {
      "name": "tavern_sleep_date",
      "type": "text"
    },
    {
      "name": "banker_rates",
      "type": "json"
    },
    {
      "name": "avatar_url",
      "type": "text"
    },
    {
      "name": "hunger",
      "type": "number"
    },
    {
      "name": "hunger_regen_at",
      "type": "text"
    },
    {
      "name": "competitive_cooldowns",
      "type": "json"
    },
    {
      "name": "daily_tax_paid",
      "type": "text"
    },
    {
      "name": "tool_charges",
      "type": "number"
    },
    {
      "name": "visited_cities",
      "type": "json"
    },
    {
      "name": "convoi_expires_at",
      "type": "text"
    },
    {
      "name": "active_loans",
      "type": "json"
    },
    {
      "name": "active_deposits",
      "type": "json"
    },
    {
      "name": "bot_trade_cooldowns",
      "type": "json"
    },
    {
      "name": "warehouse_sold_today",
      "type": "json"
    },
    {
      "name": "loan_defaulted",
      "type": "bool"
    },
    {
      "name": "last_active_at",
      "type": "text"
    },
    {
      "name": "vacation_until",
      "type": "text"
    },
    {
      "name": "inactivity_warned_at",
      "type": "text"
    },
    {
      "name": "cumul_contributions_warehouse",
      "type": "number"
    },
    {
      "name": "cumul_ventes_or",
      "type": "number"
    },
    {
      "name": "cumul_t5_envoyes",
      "type": "number"
    },
    {
      "name": "pending_market_tax",
      "type": "json"
    },
    {
      "name": "sceau_balance",
      "type": "number"
    },
    {
      "name": "login_streak",
      "type": "number"
    },
    {
      "name": "last_login_date",
      "type": "text"
    },
    {
      "name": "streak_rewarded_today",
      "type": "bool"
    },
    {
      "name": "player_level",
      "type": "number"
    },
    {
      "name": "player_xp_total",
      "type": "number"
    },
    {
      "name": "biome_combat_started_at",
      "type": "text"
    },
    {
      "name": "biome_combat_monster_id",
      "type": "text"
    },
    {
      "name": "biome_combat_duration",
      "type": "number"
    },
    {
      "name": "biome_combat_resolved",
      "type": "bool"
    },
    {
      "name": "biome_combat_result",
      "type": "json"
    },
    {
      "name": "biome_cooldown_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "biome_cooldown_bonus_value",
      "type": "number"
    },
    {
      "name": "biome_double_prod_bonus",
      "type": "number"
    },
    {
      "name": "biome_mastery",
      "type": "json"
    },
    {
      "name": "daily_combats_count",
      "type": "number"
    },
    {
      "name": "daily_combats_date",
      "type": "text"
    },
    {
      "name": "attack_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "attack_bonus_value",
      "type": "number"
    },
    {
      "name": "defense_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "defense_bonus_value",
      "type": "number"
    },
    {
      "name": "cooldown_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "cooldown_bonus_value",
      "type": "number"
    },
    {
      "name": "energy_max_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "energy_max_bonus_value",
      "type": "number"
    },
    {
      "name": "energy_regen_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "energy_regen_interval_min",
      "type": "number"
    },
    {
      "name": "energy_regen_value",
      "type": "number"
    },
    {
      "name": "fatigue_regen_at",
      "type": "text"
    },
    {
      "name": "hunger_max_bonus",
      "type": "number"
    },
    {
      "name": "hunger_regen_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "hunger_regen_interval_min",
      "type": "number"
    },
    {
      "name": "hunger_regen_value",
      "type": "number"
    },
    {
      "name": "inventory_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "inventory_bonus_value",
      "type": "number"
    },
    {
      "name": "meuble_discount",
      "type": "number"
    },
    {
      "name": "meuble_expires_at",
      "type": "text"
    },
    {
      "name": "travel_discount",
      "type": "number"
    },
    {
      "name": "atelier_vitrine",
      "type": "json"
    },
    {
      "name": "harvest_started_at",
      "type": "text"
    },
    {
      "name": "harvest_biome_key",
      "type": "text"
    },
    {
      "name": "biome_harvest_bonus_expires_at",
      "type": "text"
    },
    {
      "name": "epidemie_malus_until",
      "type": "text"
    },
    {
      "name": "harvest_gold_spent",
      "type": "number"
    },
    {
      "name": "last_travel_route_id",
      "type": "text"
    },
    {
      "name": "sceau_last_bought",
      "type": "text"
    },
    {
      "name": "biome_harvest_bonus",
      "type": "number"
    },
    {
      "name": "double_prod_bonus",
      "type": "number"
    },
    {
      "name": "double_prod_bonus_expires_at",
      "type": "text"
    }
  ],
  "cities": [
    {
      "name": "name",
      "type": "text"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "territory_id",
      "type": "text"
    },
    {
      "name": "mayor_name",
      "type": "text"
    },
    {
      "name": "tax_rate",
      "type": "number"
    },
    {
      "name": "tax_last_updated",
      "type": "text"
    },
    {
      "name": "population",
      "type": "number"
    },
    {
      "name": "max_population",
      "type": "number"
    },
    {
      "name": "level",
      "type": "number"
    },
    {
      "name": "gold_treasury",
      "type": "number"
    },
    {
      "name": "buildings",
      "type": "json"
    },
    {
      "name": "warehouse",
      "type": "json"
    },
    {
      "name": "maintenance_last_run",
      "type": "text"
    },
    {
      "name": "resources",
      "type": "json"
    },
    {
      "name": "image_url",
      "type": "text"
    },
    {
      "name": "daily_mayor_cost",
      "type": "number"
    },
    {
      "name": "mayor_id",
      "type": "text"
    },
    {
      "name": "mayor_until",
      "type": "text"
    },
    {
      "name": "daily_tax_per_player",
      "type": "number"
    },
    {
      "name": "treasury_cumulative",
      "type": "number"
    },
    {
      "name": "is_bot_city",
      "type": "bool"
    },
    {
      "name": "warehouse_buyback_prices",
      "type": "json"
    },
    {
      "name": "buyback_price_date",
      "type": "text"
    },
    {
      "name": "loan_rate",
      "type": "number"
    },
    {
      "name": "deposit_rate",
      "type": "number"
    },
    {
      "name": "disabled_buildings",
      "type": "json"
    },
    {
      "name": "interests_last_run",
      "type": "text"
    },
    {
      "name": "warehouse_rachat_enabled",
      "type": "bool"
    },
    {
      "name": "warehouse_rachat_budget",
      "type": "number"
    },
    {
      "name": "warehouse_rachat_budget_used",
      "type": "number"
    },
    {
      "name": "building_likes",
      "type": "json"
    },
    {
      "name": "last_level",
      "type": "number"
    },
    {
      "name": "election_candidates",
      "type": "json"
    },
    {
      "name": "election_votes",
      "type": "json"
    },
    {
      "name": "mayor_satisfaction",
      "type": "json"
    },
    {
      "name": "rachat_t1_offers",
      "type": "json"
    },
    {
      "name": "rachat_t2t3_offers",
      "type": "json"
    },
    {
      "name": "rachat_t1_bought_today",
      "type": "json"
    },
    {
      "name": "rachat_t2t3_bought_today",
      "type": "json"
    },
    {
      "name": "resident_salary_enabled",
      "type": "bool"
    },
    {
      "name": "resident_salary",
      "type": "number"
    },
    {
      "name": "lingots_cumul",
      "type": "number"
    },
    {
      "name": "tax_rate_next",
      "type": "number"
    },
    {
      "name": "daily_tax_collected",
      "type": "number"
    },
    {
      "name": "pending_effects",
      "type": "json"
    },
    {
      "name": "contrat_noble_active",
      "type": "bool"
    },
    {
      "name": "sceaux_en_vente",
      "type": "number"
    },
    {
      "name": "maintenance_daily",
      "type": "json"
    },
    {
      "name": "mayor_message",
      "type": "text"
    },
    {
      "name": "army_food",
      "type": "number"
    },
    {
      "name": "army_energy",
      "type": "number"
    }
  ],
  "city_armies": [
    {
      "name": "city_id",
      "type": "text"
    },
    {
      "name": "units",
      "type": "json"
    },
    {
      "name": "last_updated",
      "type": "text"
    }
  ],
  "military_campaigns": [
    {
      "name": "attacker_city_id",
      "type": "text"
    },
    {
      "name": "defender_city_id",
      "type": "text"
    },
    {
      "name": "status",
      "type": "text"
    },
    {
      "name": "declared_at",
      "type": "text"
    },
    {
      "name": "departure_at",
      "type": "text"
    },
    {
      "name": "arrival_at",
      "type": "text"
    },
    {
      "name": "return_at",
      "type": "text"
    },
    {
      "name": "units_committed",
      "type": "json"
    },
    {
      "name": "contributors",
      "type": "json"
    },
    {
      "name": "result",
      "type": "json"
    },
    {
      "name": "loot",
      "type": "json"
    }
  ],
  "economy_settings": [
    {
      "name": "setting_key",
      "type": "text"
    },
    {
      "name": "economy_zone",
      "type": "text"
    },
    {
      "name": "or_moyen_par_joueur",
      "type": "number"
    },
    {
      "name": "inflation_daily_rate",
      "type": "number"
    },
    {
      "name": "objective_reward_base",
      "type": "number"
    },
    {
      "name": "travel_cost_multiplier",
      "type": "number"
    },
    {
      "name": "tax_bonus",
      "type": "number"
    },
    {
      "name": "objective_reward_multiplier",
      "type": "number"
    },
    {
      "name": "mayor_cost_multiplier",
      "type": "number"
    },
    {
      "name": "last_updated",
      "type": "text"
    },
    {
      "name": "world_events",
      "type": "json"
    },
    {
      "name": "dynamic_prices",
      "type": "json"
    }
  ],
  "daily_resets": [
    {
      "name": "reset_date",
      "type": "text"
    },
    {
      "name": "reset_time",
      "type": "text"
    },
    {
      "name": "triggered_by",
      "type": "text"
    },
    {
      "name": "status",
      "type": "text"
    }
  ],
  "tax_history": [
    {
      "name": "city_id",
      "type": "text"
    },
    {
      "name": "city_name",
      "type": "text"
    },
    {
      "name": "tax_rate",
      "type": "number"
    },
    {
      "name": "date",
      "type": "text"
    },
    {
      "name": "reason",
      "type": "text"
    }
  ]
};

async function main() {
  console.log('\n📋 Ajout des champs dans PocketBase\n');

  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const { token } = await authRes.json();
  if (!token) { console.error('Auth échouée'); process.exit(1); }
  console.log('✅ Auth OK\n');

  const headers = { 'Content-Type': 'application/json', 'Authorization': token };

  // Récupérer les collections existantes
  const colsRes = await fetch(`${PB_URL}/api/collections?perPage=200`, { headers });
  const { items: cols } = await colsRes.json();
  const colMap = {};
  for (const c of cols) colMap[c.name] = c;

  for (const [colName, fields] of Object.entries(FIELDS)) {
    const col = colMap[colName];
    if (!col) { console.log(`❌ ${colName} introuvable`); continue; }

    console.log(`\n📦 ${colName} (${fields.length} champs)`);
    const existingFields = new Set(col.schema.map(f => f.name));
    existingFields.add('data'); // champ déjà là

    let added = 0, skipped = 0, errors = 0;

    for (const field of fields) {
      if (existingFields.has(field.name)) { skipped++; continue; }

      // Ajouter le champ en mettant à jour le schéma complet
      const newSchema = [
        ...col.schema,
        { name: field.name, type: field.type, required: false, unique: false, options: {} }
      ];

      const res = await fetch(`${PB_URL}/api/collections/${col.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ schema: newSchema }),
      });

      if (res.ok) {
        const updated = await res.json();
        // Mettre à jour le schéma local pour les prochains champs
        col.schema = updated.schema;
        added++;
        process.stdout.write('.');
      } else {
        errors++;
        process.stdout.write('x');
      }
    }
    console.log(`\n   ✅ ${added} ajoutés · ⏭️ ${skipped} ignorés · ❌ ${errors} erreurs`);
  }

  console.log('\n\n🎉 Terminé !');
  console.log('Relance migrate_data.js pour réimporter les données avec les vrais champs.');
}

main().catch(console.error);
