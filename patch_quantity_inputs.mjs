// patch_quantity_inputs.mjs
// Ajoute onFocus={e => e.target.select()} à tous les <Input type="number"> et <input type="number">
// du projet, pour que les joueurs puissent remplacer la valeur directement.
//
// Usage : node patch_quantity_inputs.mjs
// (depuis C:\GuildesCouronnes\check_zip\)
//
// IDEMPOTENT : si onFocus est déjà présent sur un input, il n'est PAS ajouté à nouveau.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const SRC = path.join(ROOT, "src");

// Fichiers à patcher (côté joueur uniquement)
const FILES = [
  "components/WarehouseUnified.jsx",
  "components/WarehouseCraftedPanel.jsx",
  "pages/Market.jsx",
  "pages/CityView.jsx",
  "components/MaireOffresPanel.jsx",
  "components/MairieTab.jsx",
  "components/AtelierVitrine.jsx",
  "components/BountyBoard.jsx",
  "components/UpgradeWorkshopPanel.jsx",
];

const ON_FOCUS_PROP = `onFocus={e => e.target.select()}`;

// Trouver tous les blocs <Input ... /> ou <input ... /> qui contiennent type="number".
// Approche : on parcourt manuellement le texte, on tracke les accolades JSX pour
// gérer correctement les expressions comme onChange={e => ...} qui contiennent des >.
function findNumberInputBlocks(src) {
  const matches = [];
  const tagRe = /<(Input|input)\b/g;
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const start = m.index;
    const tagName = m[1];
    let i = m.index + m[0].length;
    let braceDepth = 0;
    let inString = null; // '"' | "'" | null
    let selfClosed = false;

    // Parcourir jusqu'à trouver le /> ou > correspondant à l'ouverture de la balise
    while (i < src.length) {
      const c = src[i];
      if (inString) {
        if (c === inString && src[i - 1] !== "\\") inString = null;
      } else if (c === '"' || c === "'") {
        inString = c;
      } else if (c === "{") {
        braceDepth++;
      } else if (c === "}") {
        braceDepth--;
      } else if (braceDepth === 0) {
        if (c === "/" && src[i + 1] === ">") { selfClosed = true; i += 2; break; }
        if (c === ">") { i += 1; break; }
      }
      i++;
    }

    if (!selfClosed) continue; // on ne touche que les self-closed
    const block = src.slice(start, i);
    if (!/\btype\s*=\s*["']number["']/.test(block)) continue;
    matches.push({ start, end: i, block, tagName });
  }
  return matches;
}

let totalFiles = 0;
let totalPatched = 0;
let totalSkipped = 0;

for (const rel of FILES) {
  const full = path.join(SRC, rel);
  if (!fs.existsSync(full)) {
    console.warn(`⚠️  Fichier introuvable : ${rel}`);
    continue;
  }

  const orig = fs.readFileSync(full, "utf8");
  const blocks = findNumberInputBlocks(orig);

  if (blocks.length === 0) {
    console.log(`?  ${rel}  →  aucun input number détecté`);
    continue;
  }

  let patchedInThisFile = 0;
  let skippedInThisFile = 0;
  // Patcher de la fin vers le début pour ne pas décaler les indices
  let out = orig;
  for (let k = blocks.length - 1; k >= 0; k--) {
    const { start, end, block } = blocks[k];

    if (/\bonFocus\s*=/.test(block)) {
      skippedInThisFile++;
      continue;
    }

    // Détecter l'indentation des attributs (lignes du milieu du bloc)
    const lines = block.split("\n");
    let attrIndent = "  ";
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        const mm = lines[i].match(/^(\s+)\S/);
        if (mm) { attrIndent = mm[1]; break; }
      }
    }

    // On retire le /> final, on insère onFocus avec la bonne indentation, on remet />
    const closingMatch = block.match(/(\s*)\/>\s*$/);
    const closingWhitespace = closingMatch ? closingMatch[1] : "\n" + attrIndent.slice(0, -2);
    const body = block.slice(0, block.length - closingMatch[0].length);

    const newBlock = `${body}\n${attrIndent}${ON_FOCUS_PROP}${closingWhitespace}/>`;
    out = out.slice(0, start) + newBlock + out.slice(end);
    patchedInThisFile++;
  }

  if (patchedInThisFile > 0) {
    fs.writeFileSync(full, out, "utf8");
    console.log(`✅ ${rel}  →  ${patchedInThisFile} input(s) patché(s)${skippedInThisFile ? `, ${skippedInThisFile} déjà OK` : ""}`);
    totalFiles++;
    totalPatched += patchedInThisFile;
  } else {
    console.log(`✓  ${rel}  →  ${skippedInThisFile} input(s) déjà patché(s), rien à faire`);
    totalSkipped += skippedInThisFile;
  }
}

console.log(`\n📊 Résumé : ${totalPatched} input(s) patché(s) dans ${totalFiles} fichier(s), ${totalSkipped} déjà OK`);
