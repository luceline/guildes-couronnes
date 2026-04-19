#!/usr/bin/env node
/**
 * server_reset.js — Reset quotidien autonome pour Guildes & Couronnes
 * Tourne via cron job sur le VPS : 0 6 * * * node /opt/guildes/server_reset.js
 * 
 * Usage manuel : 
 *   PB_URL=http://178.104.201.139 PB_EMAIL=admin@mail.com PB_PASS=mdp node server_reset.js
 */

const PB_URL   = process.env.PB_URL   || 'http://127.0.0.1:8090';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS  = process.env.PB_PASS  || '';

// ── Constantes issues de gameData.js ──────────────────────────
const MAX_HUNGER = 10;

const HOUSING_MAINTENANCE = { tente: 2, cabane: 3, maison: 12, manoir: 45 };

const HOUSING = {
  tente:  { cost: 0    },
  cabane: { cost: 200  },
  maison: { cost: 800  },
  manoir: { cost: 3000 },
};

const TREASURY_DECAY_RATE  = 0.02;
const TREASURY_DECAY_FLOOR = 200;

const MAINTENANCE_FULL_RESIDENTS = 20;
const MAINTENANCE_COST_FLOOR     = 0.25;

function generateDailyTax() {
  return [5, 8, 10, 12, 15, 18, 20][Math.floor(Math.random() * 7)];
}
function generateDailyTaxPerPlayer() {
  return [0, 5, 5, 5, 10, 10, 15, 20, 25, 30][Math.floor(Math.random() * 10)];
}
function generateMayorCost() { return 20; }

// ── Client PocketBase léger ────────────────────────────────────
let _token = null;

async function pbAuth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth PB échouée: ' + JSON.stringify(d));
  _token = d.token;
  return _token;
}

async function pbGet(col, id) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records/${id}`, {
    headers: { Authorization: _token }
  });
  if (!res.ok) return null;
  return res.json();
}

async function pbList(col, filter = '', sort = '', limit = 500) {
  const params = new URLSearchParams({ perPage: String(Math.min(limit, 500)) });
  if (filter) params.set('filter', filter);
  if (sort) params.set('sort', sort.replace('created_date','id'));
  const res = await fetch(`${PB_URL}/api/collections/${col}/records?${params}`, {
    headers: { Authorization: _token }
  });
  if (!res.ok) return [];
  return (await res.json()).items || [];
}

async function pbCreate(col, data) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: _token },
    body: JSON.stringify(data),
  });
  if (!res.ok) { console.error(`pbCreate ${col}:`, await res.text()); return null; }
  return res.json();
}

async function pbUpdate(col, id, data) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: _token },
    body: JSON.stringify(data),
  });
  if (!res.ok) { console.error(`pbUpdate ${col} ${id}:`, await res.text()); return null; }
  return res.json();
}

// ── Générateur d'objectifs simplifié ──────────────────────────
const OBJECTIVE_TYPES = [
  { type: 'produce', items: ['bois_brut','minerai_fer','ble','herbes','pierre','laine_brute'], qty: [5,10,15,20], reward: 5 },
  { type: 'craft',   items: ['planches','farine','fil','charbon','extrait','pierre_brute'],   qty: [3,5,8],      reward: 10 },
  { type: 'sell',    items: ['bois_brut','planches','farine','fil'],                          qty: [3,5,10],     reward: 8  },
];

function generateObjectivesForPlayer(playerEmail, cityId) {
  const objectives = [];
  const shuffled = [...OBJECTIVE_TYPES].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const tmpl of shuffled) {
    const item = tmpl.items[Math.floor(Math.random() * tmpl.items.length)];
    const qty  = tmpl.qty[Math.floor(Math.random() * tmpl.qty.length)];
    objectives.push({
      player_email:     playerEmail,
      city_id:          cityId,
      type:             tmpl.type,
      target_item:      item,
      target_quantity:  qty,
      current_quantity: 0,
      reward_gold:      tmpl.reward + Math.floor(Math.random() * 5),
      status:           'active',
    });
  }
  return objectives;
}

// ── Reset quotidien ────────────────────────────────────────────
async function runDailyReset() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n🌅 Reset quotidien — ${today}\n`);

  // 1. Vérifier si déjà fait aujourd'hui
  const existing = await pbList('daily_resets', `reset_date='${today}'`);
  if (existing.length > 0 && existing[0].status === 'done') {
    console.log('✅ Reset déjà effectué aujourd\'hui.');
    return;
  }

  // Créer/mettre à jour le verrou
  let lock;
  if (existing.length > 0) {
    lock = await pbUpdate('daily_resets', existing[0].id, { status: 'running' });
  } else {
    lock = await pbCreate('daily_resets', { reset_date: today, status: 'running' });
  }
  if (!lock) { console.error('❌ Impossible de créer le verrou'); return; }

  try {
    const [cities, players] = await Promise.all([
      pbList('cities'),
      pbList('player_profiles'),
    ]);

    console.log(`📊 ${cities.length} villes, ${players.length} joueurs`);

    // ── 2. Reset par joueur ──
    let playersReset = 0;
    for (const player of players) {
      const updates = {};

      // Expirer les buffs temporaires
      const now = new Date();
      const checkExpiry = (field) => {
        if (player[field] && new Date(player[field]) < now) {
          updates[field] = '';
        }
      };
      checkExpiry('cooldown_bonus_expires_at');
      checkExpiry('energy_max_bonus_expires_at');
      checkExpiry('attack_bonus_expires_at');
      checkExpiry('defense_bonus_expires_at');
      checkExpiry('double_prod_bonus_expires_at');
      checkExpiry('biome_cooldown_bonus_expires_at');
      checkExpiry('meuble_expires_at');
      checkExpiry('travel_discount');
      
      if (player.double_prod_bonus_expires_at && new Date(player.double_prod_bonus_expires_at) < now) {
        updates.double_prod_bonus = 0;
      }

      // Maintenance logement
      const housingLevel = player.housing_level || 'tente';
      const housingCost  = HOUSING_MAINTENANCE[housingLevel] || 0;
      const meubleActive = player.meuble_expires_at && player.meuble_expires_at >= today;
      const meubleDiscount = meubleActive ? (player.meuble_discount || 0.5) : 0;
      const finalHousingCost = Math.max(0, Math.round(housingCost * (1 - meubleDiscount)));

      const currentGold = player.gold || 0;
      if (finalHousingCost > 0 && currentGold >= finalHousingCost) {
        updates.gold = currentGold - finalHousingCost;
      } else if (finalHousingCost > 0 && currentGold < finalHousingCost) {
        // Pas assez d'or → rétrograder logement
        if (housingLevel === 'manoir') updates.housing_level = 'maison';
        else if (housingLevel === 'maison') updates.housing_level = 'cabane';
        else if (housingLevel === 'cabane') updates.housing_level = 'tente';
      }

      // Reset streak si pas connecté hier
      const lastLogin = player.last_login_date;
      if (lastLogin) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (lastLogin < yesterdayStr) {
          updates.login_streak = 0;
        }
      }

      // Reset flags journaliers
      updates.daily_tax_paid = '';
      updates.warehouse_sold_today = 0;
      updates.streak_rewarded_today = false;

      if (Object.keys(updates).length > 0) {
        await pbUpdate('player_profiles', player.id, updates);
        playersReset++;
      }

      // Générer les objectifs du jour
      const existingObjectives = await pbList('player_objectives',
        `player_email='${player.user_email}'&&status='active'`);
      const activeToday = existingObjectives.filter(o => o.created_date?.startsWith(today));
      
      if (activeToday.length === 0 && player.city_id) {
        const newObjectives = generateObjectivesForPlayer(player.user_email, player.city_id);
        for (const obj of newObjectives) {
          await pbCreate('player_objectives', obj);
        }
      }
    }
    console.log(`✅ ${playersReset} joueurs mis à jour`);

    // ── 3. Reset par ville ──
    let citiesReset = 0;
    for (const city of cities) {
      const cityUpdates = {};
      const currentTreasury = city.gold_treasury || 0;

      // Déclin trésorerie
      if (currentTreasury > TREASURY_DECAY_FLOOR) {
        const decay = Math.floor(currentTreasury * TREASURY_DECAY_RATE);
        cityUpdates.gold_treasury = currentTreasury - decay;
      }

      // Nouveaux taux
      cityUpdates.tax_rate             = generateDailyTax();
      cityUpdates.daily_tax_per_player = generateDailyTaxPerPlayer();
      cityUpdates.daily_mayor_cost     = generateMayorCost();
      cityUpdates.daily_tax_collected  = 0;

      // Impôt journalier des résidents
      const residents = players.filter(p => p.city_id === city.id);
      const taxPerPlayer = city.daily_tax_per_player || 0;
      
      if (taxPerPlayer > 0) {
        for (const resident of residents) {
          const gold = resident.gold || 0;
          if (gold >= taxPerPlayer) {
            await pbUpdate('player_profiles', resident.id, { gold: gold - taxPerPlayer, daily_tax_paid: today });
            cityUpdates.gold_treasury = (cityUpdates.gold_treasury || currentTreasury) + taxPerPlayer;
            cityUpdates.daily_tax_collected = (cityUpdates.daily_tax_collected || 0) + taxPerPlayer;
            await pbCreate('gold_transactions', {
              player_email: resident.user_email,
              character_name: resident.character_name,
              city_id: city.id,
              amount: -taxPerPlayer,
              type: 'tax',
              description: `Impôt journalier`,
              date: today,
            });
          }
        }
      }

      // Reset achats rachat
      cityUpdates.rachat_t1_bought_today   = {};
      cityUpdates.rachat_t2t3_bought_today = {};

      await pbUpdate('cities', city.id, cityUpdates);
      citiesReset++;

      // Message taverne reset
      await pbCreate('tavern_messages', {
        city_id: city.id,
        author_email: 'system@guildes.fr',
        author_name: '📜 Héraut royal',
        profession: 'Système',
        message: `🌅 Une nouvelle journée commence dans ${city.name}. Taxes : ${cityUpdates.tax_rate}%. Impôt : ${cityUpdates.daily_tax_per_player}💰/habitant.`,
        is_active: true,
      });
    }
    console.log(`✅ ${citiesReset} villes mises à jour`);

    // ── 4. Nettoyer les vieilles annonces taverne (> 7 jours) ──
    const allMessages = await pbList('tavern_messages');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    let deleted = 0;
    for (const msg of allMessages) {
      if (msg.created && new Date(msg.created) < cutoff) {
        await fetch(`${PB_URL}/api/collections/tavern_messages/records/${msg.id}`, {
          method: 'DELETE', headers: { Authorization: _token }
        });
        deleted++;
      }
    }
    if (deleted > 0) console.log(`🗑️ ${deleted} anciens messages taverne supprimés`);

    // ── 5. Marquer le reset comme terminé ──
    await pbUpdate('daily_resets', lock.id, { status: 'done', completed_at: new Date().toISOString() });
    console.log('\n🎉 Reset quotidien terminé !');

  } catch (e) {
    console.error('❌ Erreur reset:', e);
    await pbUpdate('daily_resets', lock.id, { status: 'error', errors: [e.message] });
  }
}

// ── Point d'entrée ─────────────────────────────────────────────
if (!PB_EMAIL || !PB_PASS) {
  console.error('Usage: PB_EMAIL=x PB_PASS=y node server_reset.js');
  process.exit(1);
}

pbAuth().then(runDailyReset).catch(console.error);
