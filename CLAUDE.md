# Guildes & Couronnes — Contexte projet

## 👋 Vue d'ensemble

Jeu web médiéval-fantastique de gestion de cité multi-joueurs développé par Lucas. Frontend React + Vite, backend PocketBase v0.23.4 hébergé sur VPS Hetzner.

## 🏗️ Architecture

### Stack technique
- **Frontend** : React + Vite (JSX, pas TS)
- **UI** : Tailwind + shadcn/ui (dossier `@/components/ui/...`)
- **Toast** : sonner (`import { toast } from "sonner"`)
- **Icônes** : lucide-react (souvent juste des emojis dans les textes)
- **API client** : `@/api/base44Client` qui mappe les noms d'entités vers les collections PocketBase
- **Backend** : PocketBase v0.23.4 (auth, collections, JSON fields)
- **Cron serveur** : Node.js dans `/opt/guildes/server_reset_v2/` (reset journalier à 6h UTC)

### Infra
- **VPS** : Hetzner — IP `178.104.201.139`
- **Connexion SSH** : `ssh root@178.104.201.139`
- **PocketBase** : `http://127.0.0.1:8090` (admin web : http://178.104.201.139:8090/_/)
- **Frontend déployé** : `/var/www/guildes/dist/` (servi par nginx ou similaire)
- **Cron** : `/opt/guildes/server_reset_v2/server_reset_v2.js`

### Identifiants admin (à protéger)
- Email : `lucas.brunet51@gmail.com`
- Pass : `H4457w9Q7dNzjnF`

## 🗂️ Mapping collections (`src/api/base44Client.js`)

| Nom JS | Collection PocketBase |
|---|---|
| `PlayerProfile` | `player_profiles` |
| `City` | `cities` |
| `MarketListing` | `market_listings` |
| `TradeHistory` | `trade_history` (singulier !) |
| `Bounty` | `bounties` |
| `CombatChallenge` | `combat_challenges` |
| `TavernMessage` | `tavern_messages` |
| `GoldTransaction` | `gold_transactions` |
| `EconomySettings` | `economy_settings` |
| `DailyReset` | `daily_resets` |

Convention : noms de collections en **snake_case minuscules**, généralement au pluriel sauf `trade_history`.

## 🔧 Workflow de déploiement

### Frontend (Windows local → serveur)

```cmd
cd C:\GuildesCouronnes\check_zip
npm run build
scp -r dist/* root@178.104.201.139:/var/www/guildes/dist/
```

Puis Ctrl+F5 dans le navigateur.

### Migration / script serveur

```bash
# Depuis Windows local
scp "C:\Users\conta\Downloads\migration_NAME.mjs" root@178.104.201.139:/opt/guildes/server_reset_v2/

# Puis SSH
ssh root@178.104.201.139
cd /opt/guildes/server_reset_v2/
PB_URL=http://127.0.0.1:8090 PB_EMAIL=lucas.brunet51@gmail.com PB_PASS=H4457w9Q7dNzjnF \
  node migration_NAME.mjs --dry-run
# puis sans flag si OK
```

### Modif cron serveur

Le fichier `/opt/guildes/server_reset_v2/server_reset_v2.js` doit être édité directement sur le serveur (ou via scp).

## 🎮 Mécaniques de jeu importantes

### Économie
- 7 ressources T1 : `bois_brut`, `minerai_fer`, `ble`, `laine_brute`, `herbes`, `quartz_brut`, `pierre`
- Catalogue : 52 items dans `src/lib/craftingData.js` + 6 drops rares biome (`essence_foret`, `poussiere_moisson`, `fragment_cristal`, `fil_enchante`, `cendre_forge`, `piece_ancienne`) en catégorie `ressources_rares`

### Combat (refonte v5)
- **PvE** : épopée biomes via `CombatEpic.jsx`, max HP avec maîtrise = 14 (BDD clampée à 10)
- **PvP zoné** : challenges via `ChallengeForm.jsx` → résolution via `ChallengeDefenseForm.jsx` ou `Combat.jsx` (timeout)
- **PvP localisé** : on ne peut défier que les joueurs présents dans la même ville
- `gold_stolen` si l'attaquant gagne, dégâts par zone d'attaque

### Marché unifié (v1.9)
- Toutes les annonces de toutes les villes visibles partout
- Taxe = celle de la ville du **vendeur** (`listing.city_id`)
- Achat instantané, livraison physique différée si achat à distance
- `pending_packages` (JSON sur PlayerProfile) : colis en attente
- Retrait : voyager dans la ville du colis OU utiliser un Relais postal local (5💰 or détruit)

### Bounties (v5)
- Posées par n'importe quel joueur (or débité immédiatement)
- Globales, suivent la cible (peu importe la ville)
- Déclenchées si attaquant gagne le combat (`result === "attacker_won"`)
- Premier gagnant prend toute la prime (status passe à `claimed`)
- Anti-self-claim : poster ne peut pas toucher sa propre prime
- Helper : `src/lib/bountyResolver.js` — `claimBountiesIfApplicable()`

### Bâtiments (refonte récente)
- **Uniques** sauf `maison` et `quartier` (population). Le `level` (1-5) détermine la puissance
- Production scalée : `+1 à +5` par niveau pour scierie, mine, moulin, bergerie, laboratoire, fonderie
- Bibliothèque : `+30/+40/+50/+60/+70` selon niveau
- Église : `10%` chance action gratuite (random, plus de compteur 1/2)
- Moulin/laboratoire : ne réduisent **plus** le coût d'action
- Fonderie : ne réduit **plus** le cooldown forgeron, ne donne **plus** +20% craft

## 🐛 Pièges connus

### Champs BDD mal nommés
**TOUJOURS vérifier** que les champs utilisés en code existent en BDD avec exactement le même nom. Bug récent : champ `pending_packages_` (avec underscore final) au lieu de `pending_packages` → updates silencieusement ignorés par PocketBase, items perdus.

### PocketBase update silencieux
Si un champ n'existe pas en BDD, l'update est **silencieux** (pas d'erreur). Toujours tester en lisant le profil après update.

### Catégorie corrompue
Bug historique : la catégorie `item_category` peut être corrompue dans l'inventaire (ex: `pierre` rangée en `fer`). Migration v3 à `migration_fix_inventories_v3.mjs`. Le matching d'items doit ignorer `item_category` et utiliser uniquement `item_key`.

### Items à instance vs stack
- Items "à instance" : équipements de combat (`armes_combat`, `armures_combat`), outils utilitaires (`epee_courte`, `outils`, `epee_longue`), bourse_protection
- Pour ces items, **chaque exemplaire = une ligne séparée** dans l'inventaire (préserve grade/durabilité)
- Items normaux : stack par `item_key` uniquement

### Vente d'items à charges
Un item non-full (équipement, bourse, outil utilitaire) ne peut **pas** être vendu. Champ `item_grade` et `item_durability` sur MarketListing pour transmettre l'état à l'acheteur.

## 📁 Fichiers principaux

### Logique métier
- `src/lib/gameData.js` — bâtiments, recettes, helpers économiques (HP, weight, regen)
- `src/lib/craftingData.js` — 52 items + recettes
- `src/lib/combatPvE.js` — épopée biomes, getPlayerMaxHP, ZONE_ARTICLE_FR
- `src/lib/combatPvP.js` — résolution combat zoné, tie-breaker
- `src/lib/bountyResolver.js` — claim bounties après combat
- `src/lib/transactionTypes.js` — types de transactions or, dashboard mairie
- `src/lib/biomeData.js` — 6 biomes
- `src/lib/pricingData.js` — prix dynamiques T2-T5

### Composants
- `src/components/combat/CombatEpic.jsx` — épopée biomes
- `src/components/combat/CombatScreen.jsx` — wizard combat
- `src/components/BiomeHub.jsx` — hub biomes (BIOME_RARES définis ici)
- `src/components/ChallengeForm.jsx` / `ChallengeDefenseForm.jsx` — PvP
- `src/components/MarketInsights.jsx` — tendances marché (global)
- `src/components/BountyBoard.jsx` — primes
- `src/components/MaireDashboard.jsx` — dashboard mairie
- `src/components/PatchnoteModal.jsx` — modale patchnote (CURRENT_VERSION="1.9")
- `src/components/PlayerStatusBar.jsx` — barre status joueur

### Pages
- `src/pages/Market.jsx` — marché unifié (~1230 lignes)
- `src/pages/Production.jsx` — actions de production
- `src/pages/Combat.jsx` — page combats
- `src/pages/Travel.jsx` — voyages
- `src/pages/CityView.jsx` — vue ville
- `src/pages/CityPage.jsx` — page ville (entrée)

## 🚧 En cours / Pending

- [ ] **Système T5 SUSPENDU le 01/05/2026** — à redesigner avec vision "guerre ouverte", spam autorisé si ressources. T5AttackPanel commenté dans CityView, 6 bâtiments défensifs (tour_guet, caserne, coffre_fort, scriptorium, entrepot_fortifie, guilde_marchands) en "À venir" dans gameData.js. Recettes T5 et items en inventaire conservés.
- [ ] **Grande Place** : actuellement +20 capacité inv... à clarifier
- [ ] **Patchnote v1.10 à rédiger** (cumul des changements bâtiments + livraison physique + relais postal + bounties v5)

## 💼 Convention de code

- Pas de TypeScript, JSX uniquement
- Tirets cadratins (`—`) interdits dans les textes UI/patchnotes (préférer `:` ou `-`)
- Toast en français médiéval-fantastique narratif
- Fichiers en français pour les textes UI, anglais pour les noms techniques
- Pas de mode dark spécifique (utiliser les classes Tailwind responsives)

## 🎨 Patchnote style

Voir `src/components/PatchnoteModal.jsx` pour le format. Chaque note :
```js
{ icon: "🌍", title: "Titre concis", text: "Description narrative..." }
```
Tone narratif, médiéval-fantastique, descriptif (pas de "feature update" sec).
