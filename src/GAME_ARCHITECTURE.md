# 🏗️ Architecture du Jeu — Dépendances et Ramifications

> Document de référence pour visualiser les interconnexions du système de craft T1→T5 et des mécaniques du jeu.

---

## 📊 Vue Globale: Chaîne de Production T1→T5

```
T1 (Brut)
  ↓ (Chaque profession récolte son T1)
T2 (Transformations simples)
  ↓ (Croisement inter-professions)
T3 (Objets utiles + contrats)
  ↓
T4 (Objets puissants + outils)
  ↓
T5 (Items JCJ + Lingots royaux)
```

---

## 🔗 Dépendances par Profession

### **BÛCHERON** 🌲
**T1 Produit:**
- Bois brut (ferme_bois)

**T2 Crée:**
- Planches (bois_brut ×2 + **charbon Forgeron**)

**T3 Crée:**
- Meuble (planches ×2 + **fil Tisserand** + **farine Fermier**)
  - **Effet passif:** −30% entretien logement

**T4 Crée:**
- Armure (meuble + **lingots_fer Mineur** ×2 + **potion_soin Alchimiste**)
- Bouclier (planches ×3 + **lingots_fer Mineur** ×2 + **tissu Tisserand**)

**T5 Crée:**
- Huile inflammable (armure + **épée_longue Forgeron** + **besace Tisserand** + **potion_endur Alchimiste**)
  - 🏙️ Désactive 1 bâtiment ennemi / 1 jour

**Dépendances Entrantes:**
- Charbon (Forgeron T2)
- Fil (Tisserand T2)
- Farine (Fermier T3)
- Lingots de fer (Mineur T3)
- Tissu (Tisserand T3)
- Potion de soin (Alchimiste T3)
- Potion d'endurance (Alchimiste T4)
- Épée longue (Forgeron T4)
- Besace (Tisserand T4)

---

### **MINEUR** ⛏️
**T1 Produit:**
- Minerai de fer (ferme_minerai)
- Quartz brut (ferme_quartz)

**T2 Crée:**
- Pierre brute (de minerai)

**T3 Crée:**
- Lingots de fer (pierre_brute + **tissu Tisserand** + **ragoût Fermier**)
- Outils (lingots_fer + **tissu Tisserand** + **potion_soin Alchimiste** + **lingots_or Orfèvre**)
  - ⚒️ +3 actions bonus avant cooldown

**T4 Crée:**
- (Dépend d'autres T4)

**T5 Crée:**
- Poudre corrosive (outils + **épée_longue Forgeron** + **lingot_raffine Orfèvre** + **besace Tisserand**)
  - 📦 Détruit 15 unités ressource aléatoire entrepôt ennemi

**Dépendances Entrantes:**
- Tissu (Tisserand T3)
- Ragoût (Fermier T4)
- Potion de soin (Alchimiste T3)
- Lingots d'or (Orfèvre T3)
- Épée longue (Forgeron T4)
- Lingot raffiné (Orfèvre T4)
- Besace (Tisserand T4)

---

### **FERMIER** 🌾
**T1 Produit:**
- Blé (ferme_ble) → Consommable: +1 faim
- Laine brute (ferme_laine)
- Herbes (ferme_herbes)

**T2 Produit:**
- Chanvre

**T3 Crée:**
- Farine (blé ×2 + **quartz_poli Orfèvre**)
  - Consommable: +3 faim
- Pain (farine ×2 + **potion_soin Alchimiste**)
  - Consommable: +4 faim
- Ragoût (farine ×2 + **tissu Tisserand** + **épée_courte Forgeron**)
  - Consommable: +7 faim

**T4 Crée:**
- (Dépend d'autres T4)

**T5 Crée:**
- Festin empoisonné (ragoût + **potion_endur Alchimiste** + **lingot_raffine Orfèvre** + **contrat_artisan Marchand**)
  - ☠️ −3 faim max résidents ville ennemie / 2 jours

**Dépendances Entrantes:**
- Quartz poli (Orfèvre T2)
- Potion de soin (Alchimiste T3)
- Tissu (Tisserand T3)
- Épée courte (Forgeron T3)
- Potion d'endurance (Alchimiste T4)
- Lingot raffiné (Orfèvre T4)
- Contrat artisan (Marchand T3)

---

### **TISSERAND** 🧵
**T1 Produit:**
- Laine brute (ferme_laine)

**T2 Crée:**
- Fil (laine_brute)

**T3 Crée:**
- Tissu (fil ×2 + **parchemin Marchand** ×2 + **lingots_fer Mineur**)
  - ✓ Matériau critique pour beaucoup de T4/T5
- Besace (tissu ×2 + **potion_soin Alchimiste** + **meuble Bûcheron**)
  - 👜 +60 capacité inventaire / 7 jours

**T4 Crée:**
- (Dépend d'autres T4)

**T5 Crée:**
- Faux contrat (besace + **armure Bûcheron** + **outils Mineur** + **contrat_artisan Marchand**)
  - 😤 −20% production ville ennemie / 1 jour

**Dépendances Entrantes:**
- Parchemin (Marchand T3)
- Lingots de fer (Mineur T3)
- Potion de soin (Alchimiste T3)
- Meuble (Bûcheron T3)
- Armure (Bûcheron T4)
- Outils (Mineur T4)
- Contrat artisan (Marchand T3)

---

### **FORGERON** ⚒️
**T1 Produit:**
- Minerai de fer (ferme_minerai)

**T2 Crée:**
- Charbon
- Corde (laine_brute ×3 + **chanvre Fermier** ×2)
  - Matériau pour talisman

**T3 Crée:**
- Épée courte (lingots_fer + **potion_soin Alchimiste** + **parchemin Marchand**)
  - ⚔️ +1 attaque, durabilité 4
- Bouclier → via Bûcheron

**T4 Crée:**
- Épée longue (épée_courte ×2 + **tissu Tisserand** + **lingots_or Orfèvre**)
  - ⚔️ +2 attaque, durabilité 6

**T5 Crée:**
- Clé forgée (épée_longue + **outils Mineur** + **besace Tisserand** + **potion_endur Alchimiste**)
  - 🏦 Vole 10−15% trésorerie ville ennemie

**Dépendances Entrantes:**
- Laine brute (Fermier T1)
- Chanvre (Fermier T2)
- Lingots de fer (Mineur T3)
- Potion de soin (Alchimiste T3)
- Parchemin (Marchand T3)
- Tissu (Tisserand T3)
- Lingots d'or (Orfèvre T3)
- Outils (Mineur T4)
- Besace (Tisserand T4)
- Potion d'endurance (Alchimiste T4)

---

### **ALCHIMISTE** 🧪
**T1 Produit:**
- Herbes (ferme_herbes)

**T2 Crée:**
- Extrait (herbes)
  - Consommable: +3 énergie

**T3 Crée:**
- Potion de soin (extrait + **fil Tisserand** ×2 + **encre Marchand**)
  - ⚡ +8 énergie instantané
  - **Critique:** Utilisée dans 7+ recettes T3/T4

**T4 Crée:**
- Potion d'endurance (potion_soin + **ragoût Fermier** + **épée_courte Forgeron**)
  - ⚡ +20 énergie instantané
  - **Critique:** Utilisée dans plusieurs T5

**T5 Crée:**
- Élixir de discorde (potion_endur + **épée_longue Forgeron** + **lingot_raffine Orfèvre** + **armure Bûcheron**)
  - ☠️ −10% taxes ville ennemie / 1 jour

+ Amulette (potion_endur + herbes ×3 + **talisman Orfèvre**)
  - 🌙 Regen faim ×2 / 24h

**Dépendances Entrantes:**
- Fil (Tisserand T2)
- Encre (Marchand T2)
- Ragoût (Fermier T4)
- Épée courte (Forgeron T3)
- Épée longue (Forgeron T4)
- Lingot raffiné (Orfèvre T4)
- Armure (Bûcheron T4)
- Talisman (Orfèvre T3)

---

### **ORFÈVRE** 💎
**T1 Produit:**
- Quartz brut (ferme_quartz)

**T2 Crée:**
- Quartz poli
- Encre (herbes ×2 + quartz_poli) **← Coordination Alchimiste**

**T3 Crée:**
- Lingots d'or (quartz_poli + **pierre_brute Mineur**)
  - 💰 Vendable: 25💰 orfèvre + 15💰 résidents
- Talisman (quartz_poli ×3 + **fil Tisserand** ×2 + **encre Marchand** + **corde Forgeron**)
  - ⚔️ +1 score combat, durabilité 4
- Lingots d'or (Orfèvre T3)

**T4 Crée:**
- Lingot raffiné (lingots_or + **potion_soin Alchimiste** + **parchemin Marchand**) [**Require: Fonderie**]
  - 💰 Vendable: 55💰 orfèvre + 35💰 résidents
- Bijou (lingot_raffine + quartz_poli ×3 + **fil Tisserand** ×2)
  - 💎 Prochain upgrade logement GRATUIT

**T5 Crée:**
- Lingot royal (lingot_raffine + **armure Bûcheron** + **outils Mineur** + **besace Tisserand**) [**Require: Fonderie**]
  - 💰 Vendable: 120💰 orfèvre + 80💰 résidents

**Dépendances Entrantes:**
- Pierre brute (Mineur T2)
- Herbes (Alchimiste T1)
- Fil (Tisserand T2)
- Encre (Marchand T2)
- Corde (Forgeron T2)
- Potion de soin (Alchimiste T3)
- Parchemin (Marchand T3)
- Armure (Bûcheron T4)
- Outils (Mineur T4)
- Besace (Tisserand T4)

---

### **MARCHAND** 💼
**T1 Produit:**
- Autorisation de marché (ferme_autorisation)

**T2 Crée:**
- Encre (herbes ×2 + **quartz_poli Orfèvre**)
  - 🖋️ Base des parchemins

**T3 Crée:**
- Parchemin (encre + **planches Bûcheron** ×2 + **tissu Tisserand**)
  - 📜 Base des contrats
  - **Très utilisé:** Input de 10+ recettes
- Contrat artisan (parchemin + **lingots_fer Mineur** + **potion_soin Alchimiste**)
  - 🎯 Objectif spécial: produire 5 T2 ou vendre 8 items → 110💰
  - **Utilisé dans:** Festin empoisonné (T5), Faux contrat (T5)

**T3 Crée (suite):**
- Bonus convoi (parchemin ×2 + **lingots_or Orfèvre** + **corde Forgeron** ×2)
  - 🚚 ×1.5 prochaine vente en gros
- Édit royal (parchemin ×2 + **lingots_or Orfèvre** + **lingot_raffine Orfèvre**)
  - 👑 MAIRE: Attire 1 habitant ville voisine (coûte 5 faim)

**T4 Crée:**
- Contrat marchand (meuble + **ragoût Fermier** + **lingots_or Orfèvre** + **épée_courte Forgeron**)
  - 🎯 Objectif complexe: vendre 20 items ou voyager → 260💰

**T5 Crée:**
- Contrat noble (**armure Bûcheron** + **épée_longue Forgeron** + **potion_endur Alchimiste** + **lingot_raffine Orfèvre**)
  - 🎯 Objectif majeur → 550💰
- Lettre de désinformation (**armure Bûcheron** + **outils Mineur** + **besace Tisserand** + **potion_endur Alchimiste**)
  - 📰 −10% taxes ville ennemie + rumeur taverne / 1 jour

**Dépendances Entrantes:**
- Herbes (Alchimiste T1)
- Quartz poli (Orfèvre T2)
- Planches (Bûcheron T2)
- Tissu (Tisserand T3)
- Lingots de fer (Mineur T3)
- Potion de soin (Alchimiste T3)
- Corde (Forgeron T2)
- Lingots d'or (Orfèvre T3)
- Meuble (Bûcheron T3)
- Ragoût (Fermier T4)
- Épée courte (Forgeron T3)
- Armure (Bûcheron T4)
- Épée longue (Forgeron T4)
- Potion d'endurance (Alchimiste T4)
- Lingot raffiné (Orfèvre T4)
- Outils (Mineur T4)
- Besace (Tisserand T4)

---

## 🔴 Items Critiques (Hotspots de Dépendance)

| Item | Tier | Utilisé par | Nombre d'Inputs |
|------|------|-------------|-----------------|
| **Parchemin** | T3 | 10+ recettes | ⚠️⚠️⚠️ **CRITIQUE** |
| **Potion de soin** | T3 | 7+ recettes | ⚠️⚠️⚠️ **CRITIQUE** |
| **Lingots de fer** | T3 | 6+ recettes | ⚠️⚠️ |
| **Tissu** | T3 | 8+ recettes | ⚠️⚠️⚠️ **CRITIQUE** |
| **Lingot d'or** | T3 | 5+ recettes | ⚠️⚠️ |
| **Potion d'endurance** | T4 | 5+ recettes | ⚠️⚠️ |
| **Lingot raffiné** | T4 | 4+ recettes | ⚠️⚠️ |
| **Épée longue** | T4 | 4+ recettes | ⚠️ |
| **Contrat artisan** | T3 | 2 T5 | ⚠️ |

---

## 📋 Systèmes Globaux

### **Objectifs Quotidiens** (lib/objectiveGenerator.js)
- **Filtrage par tier:** Basé sur l'or du joueur
  - <200 💰 → T1 seulement
  - <500 💰 → T1, T2
  - <1000 💰 → T2, T3
  - <2000 💰 → T3, T4
  - 2000+ 💰 → T4, T5

- **Types d'objectifs:**
  - `produce`: Créer X items
  - `sell`: Vendre X items
  - `contribute`: Contribuer ressources ville
  - `travel`: Voyager

- **Récompenses:** Base 20💰 × multiplicateur économique × bonus tier

---

### **Économie** (lib/gameData.js, lib/pricingData.js)
- **Prix de base (T1):** Définis statiquement
- **Prix T2-T5:** Calculés dynamiquement basé sur inflation
- **Inflation:** Basée sur or moyen par joueur

---

### **Levage d'Objectifs** (pages/ProductionPage.js)
- Objectifs spéciaux verrouillés par **parchemins:**
  - `contrat_artisan` (Marchand T3)
  - `contrat_marchand` (Marchand T4)
  - `contrat_noble` (Marchand T5)

---

## 🚨 Points d'Attention

1. **Parchemin & Potion de soin:** Extrêmement critiques, goulots d'étranglement potentiels
2. **Fonderie:** Requise pour lingot raffiné et lingot royal (Orfèvre uniquement)
3. **Encre:** Dépend de Marchand ET Orfèvre (cross-profession coordination)
4. **Contrats:** Contrôlent les objectifs majeurs (Marchand = gatekeeper)
5. **Items JCJ (T5):** Tous requièrent plusieurs T4 croisés

---

## ✅ Statut des Items

- ✅ Tous les items T1-T5 sont **intégrés**
- ✅ Aucun orphelin actuellement (contrat_simple retiré)
- ✅ Chaque profession a T1, T2, T3, et T4-T5 participatif