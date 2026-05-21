# Notes — Combat.jsx archivé pour futur tournoi

**Date archivage** : 15/05/2026
**Renommé en** : `Combat.jsx.future-tournoi-15052026` (dans `src/pages/`)
**Raison** : remplacé par CombatPage à 3 onglets (Combat/Boss/Tournoi). Le PvP
zoné disparaît temporairement, sera repris pour faire le tournoi saisonnier.

## Ce qui était dans Combat.jsx (720 lignes)

### Imports clés
- `base44.entities.CombatChallenge.filter(...)` — collection PocketBase des défis
- `resolveCombat` from `@/lib/combatPvP` — moteur combat (à refactorer en mécanique miroir comme bossCombat)
- `claimBountiesIfApplicable` from `@/lib/bountyResolver` — résolution primes
- `ChallengeForm`, `ChallengeDefenseForm` — formulaires défi/défense
- `CombatEquipmentPanel` — affichage équipement combat
- `CombatReplayButton, useCombatReplay` — système de replay
- `notifyTavern` — notif auto à la taverne
- `useWakeLock` — empêche écran de s'éteindre pendant combat
- Constants from `gameData` : COMBAT_PARRY_TIMER_HOURS, COMBAT_KO_DURATION_HOURS,
  COMBAT_STEAL_MAX_GOLD, COMBAT_MAX_HP, COMBAT_SLOT_INFO, EQUIPMENT_MAX_DURABILITY
- Helpers : `isPlayerKO`, `getPlayerHP`

### 3 sous-onglets internes (Tabs shadcn)
1. **mine** (ligne 552-593) — Mes défis : défis en cours, en attente de parade
2. **history** (ligne 594-608) — 📜 Historique : combats passés du joueur
3. **public** (ligne 609-...) — 🌐 Combats publics : feed global des combats récents

### Logique auto-résolution
- Combat.jsx avait un mécanisme de résolution automatique des défis expirés
  côté client (best-effort) — voir commentaire ligne ~25 ("Auto-résolution d'un
  défi en pending_defense dont expires_at est dépassé")

## Ce qu'il faudra faire pour le tournoi (estimation)

### Backend
- Nouvelle collection PocketBase `tournament_match` (au lieu de CombatChallenge)
- Hook PB `tournament.pb.js` (similar à boss_combat.pb.js) pour valider les
  combats avec rejeu serveur (B Strict)
- Cron weekly pour gérer rotation des pools et brackets

### Frontend
- Refactor `combatPvP.js` avec mécanique miroir (cf bossCombat.js)
  - Parade arme, attaque -1 dura, blocage armure+bouclier, drain/regen gemmes
  - Différences vs Boss : pas de heal, pas de plancher dura, destab 1 tour
- Cap 15 tours par match (vs 30 pour boss)
- Saison de 4 semaines = 4 pools en format Suisse 4 rounds
- Async : 1 semaine max par match, forfait auto après 3 jours d'inactivité

### Réutilisable depuis Combat.jsx archivé
- Structure des 3 sous-onglets (mine/history/public) → l'onglet "Tournoi"
  de CombatPage pourra reprendre cette structure
- ChallengeForm / ChallengeDefenseForm (UI déjà faite)
- CombatEquipmentPanel
- CombatReplayButton + useCombatReplay
- useWakeLock pendant combat

### À adapter
- `resolveCombat` actuel → refaire en miroir comme bossCombat
- Bounties → garder ou supprimer selon design tournoi
- Système de KO 24h → probablement supprimer dans le tournoi

## Fichiers à conserver IMPÉRATIVEMENT (utilisés ailleurs)

- `src/lib/combatPvP.js` — moteur combat actuel (encore référencé pour le moment)
- `src/components/ChallengeForm.jsx`
- `src/components/ChallengeDefenseForm.jsx`
- `src/components/CombatEquipmentPanel.jsx`
- `src/components/CombatReplay.jsx`

Vérifier avant de toucher à ces fichiers que rien d'autre que `Combat.jsx`
ne les importait. Si oui, supprimer / archiver aussi.
