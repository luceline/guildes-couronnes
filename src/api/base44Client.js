import PocketBase from 'pocketbase';

const PB_URL = 'http://178.104.201.139';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
pb.beforeSend = (url, options) => {
  const u = new URL(url);
  u.searchParams.delete('skipTotal');
  return { url: u.toString(), options };
};

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

// Collections qui stockent tout dans un champ JSON data
const DATA_FIELD_COLS = new Set([]); // Toutes les collections ont maintenant leurs vrais champs

function normalizeRecord(record, col) {
  if (!record) return null;
  const { collectionId, collectionName, created, updated, data, ...rest } = record;
  if (DATA_FIELD_COLS.has(col) && data && typeof data === 'object') {
    return { ...data, id: record.id, created_date: created, updated_date: updated };
  }
  return { ...rest, created_date: created, updated_date: updated };
}

function prepareData(data, col) {
  const { id, created_date, updated_date, collectionId, collectionName, ...rest } = data;
  if (DATA_FIELD_COLS.has(col)) return { data: rest };
  return rest;
}

function convertFilter(filterObj, col) {
  if (!filterObj || Object.keys(filterObj).length === 0) return '';
  if (DATA_FIELD_COLS.has(col)) return ''; // filtrage côté client
  return Object.entries(filterObj)
    .map(([key, val]) => {
      if (val === null || val === undefined) return `${key} = null`;
      if (typeof val === 'string') return `${key} = '${val.replace(/'/g, "\\'")}'`;
      if (typeof val === 'boolean') return `${key} = ${val}`;
      return `${key} = ${val}`;
    })
    .join(' && ');
}

class EntityProxy {
  constructor(col) { this.col = col; }

  async _fetch(filter, sort, limit) {
    // Remplacer created_date par created (nom PocketBase)
    if (sort) sort = sort.replace('created_date', 'id').replace('updated_date', 'updated').replace('-created', '-id').replace('+created', '+id');
    // Fetch direct pour éviter skipTotal incompatible avec PocketBase v0.23
    const params = new URLSearchParams({ page: '1', perPage: String(Math.min(limit, 500)) });
    if (sort) params.set('sort', sort);
    if (filter) params.set('filter', filter);
    const url = `${PB_URL}/api/collections/${this.col}/records?${params}`;
    const token = pb.authStore.token;
    const headers = token ? { 'Authorization': token } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`PocketBase ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.items || [];
  }

  async list(sort = '', limit = 500) {
    const items = await this._fetch('', sort, limit);
    return items.map(r => normalizeRecord(r, this.col));
  }

  async filter(filterObj = {}, sort = '', limit = 500) {
    const pbFilter = convertFilter(filterObj, this.col);
    const items = await this._fetch(pbFilter, sort, limit);
    const records = items;
    const normalized = records.map(r => normalizeRecord(r, this.col));
    if (DATA_FIELD_COLS.has(this.col) && Object.keys(filterObj).length > 0) {
      return normalized.filter(record =>
        Object.entries(filterObj).every(([key, val]) => record[key] === val)
      );
    }
    return normalized;
  }

  async get(id) {
    const record = await pb.collection(this.col).getOne(id);
    return normalizeRecord(record, this.col);
  }

  async create(data) {
    try {
      const record = await pb.collection(this.col).create(prepareData(data, this.col));
      console.log('[create] OK:', this.col, record.id);
      return normalizeRecord(record, this.col);
    } catch(e) {
      console.error('[create] ERREUR:', this.col, e.message, JSON.stringify(e.data || {}));
      throw e;
    }
  }

  async update(id, data) {
    if (DATA_FIELD_COLS.has(this.col)) {
      const existing = await pb.collection(this.col).getOne(id);
      const existingData = existing.data || {};
      const { id: _, created_date, updated_date, ...newFields } = data;
      const merged = { ...existingData, ...newFields };
      const record = await pb.collection(this.col).update(id, { data: merged });
      return normalizeRecord(record, this.col);
    }
    const record = await pb.collection(this.col).update(id, prepareData(data, this.col));
    return normalizeRecord(record, this.col);
  }

  async delete(id) {
    await pb.collection(this.col).delete(id);
    return { id };
  }

  async bulkCreate(dataArray) {
    const results = await Promise.all(
      dataArray.map(d => pb.collection(this.col).create(prepareData(d, this.col)))
    );
    return results.map(r => normalizeRecord(r, this.col));
  }

  subscribe(callback) {
    // SSE désactivé — PocketBase v0.23 incompatible avec ce client
    console.warn('[PocketBase] subscribe désactivé:', this.col);
    return () => {};
  }
}

const auth = {
  async me() {
    if (!pb.authStore.isValid) return null;
    try {
      await pb.collection('users').authRefresh();
      const user = pb.authStore.record || pb.authStore.model;
      console.log('[auth.me] user:', JSON.stringify(user));
      return { email: user.email, id: user.id, name: user.name || user.email };
    } catch {
      pb.authStore.clear();
      return null;
    }
  },
  logout() { pb.authStore.clear(); window.location.href = '/'; },
  redirectToLogin() { window.location.href = '/login'; },
  async signInWithEmail(email, password) {
    const r = await pb.collection('users').authWithPassword(email, password);
    return { email: r.record.email, id: r.record.id };
  },
  async signInWithGoogle() {
    const r = await pb.collection('users').authWithOAuth2({ provider: 'google' });
    return { email: r.record.email, id: r.record.id };
  },
  async signUp(email, password, name) {
    const user = await pb.collection('users').create({
      email, password, passwordConfirm: password, name: name || email,
    });
    await pb.collection('users').authWithPassword(email, password);
    return { email: user.email, id: user.id };
  },
  isAuthenticated() { return pb.authStore.isValid; },
};

const entitiesProxy = new Proxy({}, {
  get(_, entityName) {
    const col = COLLECTION_MAP[entityName];
    if (!col) { console.warn(`[PocketBase] Collection inconnue : ${entityName}`); return new EntityProxy(entityName.toLowerCase() + 's'); }
    return new EntityProxy(col);
  }
});

export const base44 = { entities: entitiesProxy, auth };
export default pb;
