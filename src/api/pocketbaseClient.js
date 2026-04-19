import PocketBase from 'pocketbase';

// ── Configuration ──────────────────────────────────────────────
// En développement : http://localhost:8090
// En production    : https://ton-domaine.com (PocketBase tourne derrière Nginx)
const PB_URL = 'http://178.104.201.139';

export const pb = new PocketBase(PB_URL);

// Auto-refresh du token en arrière-plan
pb.autoCancellation(false);

// ── Mapping noms d'entités → noms de collections PocketBase ────
// PocketBase utilise des noms en snake_case
const COLLECTION_MAP = {
  PlayerProfile:    'player_profiles',
  City:             'cities',
  PlayerObjective:  'player_objectives',
  TavernMessage:    'tavern_messages',
  GoldTransaction:  'gold_transactions',
  MarketListing:    'market_listings',
  CityArmy:         'city_armies',
  EconomySettings:  'economy_settings',
  TravelRoute:      'travel_routes',
  SystemMessage:    'system_messages',
  DailyReset:       'daily_resets',
  TaxHistory:       'tax_history',
  Music:            'music',
  MilitaryCampaign: 'military_campaigns',
  BuildingTypeDef:  'building_type_defs',
  ResourceStock:    'resource_stocks',
  ProfessionDef:    'profession_defs',
  CraftingRecipe:   'crafting_recipes',
  Biome:            'biomes',
  EconomySnapshot:  'economy_snapshots',
  Bounty:           'bounties',
  TradeHistory:     'trade_history',
  Territory:        'territories',
  ItemDef:          'item_defs',
  BankDeposit:      'bank_deposits',
};

// ── Conversion filtre base44 → filtre PocketBase ───────────────
// base44 :  { user_email: 'x@y.com', city_id: '123' }
// PocketBase: "user_email = 'x@y.com' && city_id = '123'"
function convertFilter(filterObj) {
  if (!filterObj || Object.keys(filterObj).length === 0) return '';
  return Object.entries(filterObj)
    .map(([key, val]) => {
      if (val === null || val === undefined) return `${key} = null`;
      if (typeof val === 'string')  return `${key} = '${val.replace(/'/g, "\\'")}'`;
      if (typeof val === 'boolean') return `${key} = ${val}`;
      return `${key} = ${val}`;
    })
    .join(' && ');
}

// ── Classe EntityProxy — reproduit l'API base44 ────────────────
class EntityProxy {
  constructor(collectionName) {
    this.col = collectionName;
  }

  // base44: entity.list(sort, limit)
  // ex: PlayerProfile.list('-created', 50)
  async list(sort = '-created', limit = 200) {
    const records = await pb.collection(this.col).getFullList({
      sort,
      batch: limit,
    });
    return records.map(normalizeRecord);
  }

  // base44: entity.filter({ field: value })
  async filter(filterObj = {}, sort = '-created', limit = 500) {
    const filter = convertFilter(filterObj);
    const records = await pb.collection(this.col).getFullList({
      filter: filter || undefined,
      sort,
      batch: limit,
    });
    return records.map(normalizeRecord);
  }

  // base44: entity.get(id)
  async get(id) {
    const record = await pb.collection(this.col).getOne(id);
    return normalizeRecord(record);
  }

  // base44: entity.create(data)
  async create(data) {
    const record = await pb.collection(this.col).create(prepareData(data));
    return normalizeRecord(record);
  }

  // base44: entity.update(id, data)
  async update(id, data) {
    const record = await pb.collection(this.col).update(id, prepareData(data));
    return normalizeRecord(record);
  }

  // base44: entity.delete(id)
  async delete(id) {
    await pb.collection(this.col).delete(id);
    return { id };
  }

  // base44: entity.bulkCreate(array)
  async bulkCreate(dataArray) {
    const results = await Promise.all(
      dataArray.map(data => pb.collection(this.col).create(prepareData(data)))
    );
    return results.map(normalizeRecord);
  }

  // base44: entity.subscribe(callback) — temps réel SSE
  subscribe(callback) {
    pb.collection(this.col).subscribe('*', (e) => {
      callback(normalizeRecord(e.record), e.action);
    });
    return () => pb.collection(this.col).unsubscribe('*');
  }
}

// ── Normalisation des enregistrements PocketBase ───────────────
// PocketBase retourne { id, collectionId, collectionName, created, updated, ...fields }
// base44 retourne { id, created_date, ...fields }
function normalizeRecord(record) {
  if (!record) return null;
  const { collectionId, collectionName, created, updated, ...rest } = record;
  return {
    ...rest,
    created_date: created,
    updated_date: updated,
  };
}

// ── Préparation des données pour PocketBase ────────────────────
// Supprimer les champs calculés ou non stockables
function prepareData(data) {
  const { id, created_date, updated_date, collectionId, collectionName, ...rest } = data;
  return rest;
}

// ── Objet auth — reproduit base44.auth ────────────────────────
const auth = {
  // base44: base44.auth.me()
  async me() {
    if (!pb.authStore.isValid) return null;
    try {
      // Rafraîchir le token si nécessaire
      await pb.collection('users').authRefresh();
      const user = pb.authStore.model;
      return {
        email: user.email,
        id: user.id,
        name: user.name || user.email,
      };
    } catch {
      pb.authStore.clear();
      return null;
    }
  },

  // base44: base44.auth.logout()
  logout() {
    pb.authStore.clear();
    window.location.href = '/';
  },

  // base44: base44.auth.redirectToLogin()
  redirectToLogin() {
    window.location.href = '/login';
  },

  // Connexion email/password
  async signInWithEmail(email, password) {
    const auth = await pb.collection('users').authWithPassword(email, password);
    return {
      email: auth.record.email,
      id: auth.record.id,
    };
  },

  // Connexion Google OAuth
  async signInWithGoogle() {
    const auth = await pb.collection('users').authWithOAuth2({ provider: 'google' });
    return {
      email: auth.record.email,
      id: auth.record.id,
    };
  },

  // Inscription
  async signUp(email, password, name) {
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name: name || email,
    });
    await pb.collection('users').authWithPassword(email, password);
    return { email: user.email, id: user.id };
  },

  // Reset mot de passe
  async requestPasswordReset(email) {
    await pb.collection('users').requestPasswordReset(email);
  },

  isAuthenticated() {
    return pb.authStore.isValid;
  },
};

// ── Proxy dynamique pour base44.entities.X ────────────────────
const entitiesProxy = new Proxy({}, {
  get(_, entityName) {
    const collectionName = COLLECTION_MAP[entityName];
    if (!collectionName) {
      console.warn(`[PocketBase] Collection inconnue : ${entityName}`);
      return new EntityProxy(entityName.toLowerCase() + 's');
    }
    return new EntityProxy(collectionName);
  }
});

// ── Export compatible base44 ───────────────────────────────────
// Dans tout le code existant : import { base44 } from '@/api/base44Client'
// → remplacer par      : import { base44 } from '@/api/pocketbaseClient'
// Ou changer base44Client.js pour qu'il réexporte depuis ici.
export const base44 = {
  entities: entitiesProxy,
  auth,
};

export default pb;
