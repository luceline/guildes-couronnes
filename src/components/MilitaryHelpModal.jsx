/**
 * MilitaryHelpModal — Documentation complète du système de combat d'unités.
 *
 * Affiche les unités, formules d'attaque/défense, table des résultats,
 * et bonus de bâtiments. À ouvrir depuis MilitaryCampaignPanel ou la nav Aide.
 */
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { UNIT_TYPES, UNIT_ORDER_BY_STRENGTH, WAR_DECLARATION_COST } from "../lib/militaryData";

export default function MilitaryHelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg max-w-3xl w-full my-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            ⚔️ Le livre des batailles
          </h2>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-4 space-y-6 font-body text-sm leading-relaxed">

          {/* ── Introduction ── */}
          <section>
            <p className="text-muted-foreground italic">
              Avant de mener une campagne, comprenez les règles qui gouvernent les armées.
              Chaque unité possède sa force, chaque ville ses fortifications, chaque
              palier sa supériorité tactique. Voici comment se calculent les batailles.
            </p>
          </section>

          {/* ── Tableau des unités ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">🪖 Les six unités d'armée</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border rounded-lg">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-heading">Unité</th>
                    <th className="px-2 py-1.5 text-center font-heading">⚔️ ATK</th>
                    <th className="px-2 py-1.5 text-center font-heading">🛡️ DEF</th>
                    <th className="px-2 py-1.5 text-center font-heading">💰 Coût</th>
                    <th className="px-2 py-1.5 text-center font-heading">🍞⚡/j</th>
                    <th className="px-2 py-1.5 text-center font-heading">Palier</th>
                    <th className="px-2 py-1.5 text-left font-heading">Spécial</th>
                  </tr>
                </thead>
                <tbody>
                  {UNIT_ORDER_BY_STRENGTH.map(key => {
                    const u = UNIT_TYPES[key];
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="px-2 py-1.5"><strong>{u.icon} {u.name}</strong></td>
                        <td className="px-2 py-1.5 text-center font-mono">{u.atk}</td>
                        <td className="px-2 py-1.5 text-center font-mono">{u.def}</td>
                        <td className="px-2 py-1.5 text-center font-mono">{u.goldCost}</td>
                        <td className="px-2 py-1.5 text-center font-mono">
                          {u.food_cost}/{u.energy_cost}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono">{u.palierRequired}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{u.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">
              🍞⚡/j = nourriture / énergie consommées par jour pour l'entretien.
              Sans ravitaillement, les unités désertent peu à peu.
            </p>
          </section>

          {/* ── Formule attaque ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">⚔️ Calcul du score d'attaque</h3>
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5">
              <p className="font-mono text-xs">
                <strong>ATK</strong> = Σ (atk_unité × quantité) × (1 + bonus_ville + bonus_maire)
              </p>
              <ul className="text-xs space-y-0.5 ml-3">
                <li>• Chaque unité ajoute son <strong>atk × nombre</strong>.</li>
                <li>• <strong>Bonus de ville</strong> selon palier : +0% (pal. 1), +5%, +10%, +15%, +20%, +25% (pal. 6).</li>
                <li>• <strong>Bonus maire</strong> : +10% si l'attaquant est le maire de la ville assaillante.</li>
              </ul>
            </div>
          </section>

          {/* ── Formule défense ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">🛡️ Calcul du score de défense</h3>
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5">
              <p className="font-mono text-xs">
                <strong>DEF</strong> = (Σ def_unité × qté + 20×Remparts + 15×Palais) × (1 + bonus_ville)
              </p>
              <p className="font-mono text-xs">
                Si l'attaquant a une <strong>Catapulte</strong> : DEF × 0.70
              </p>
              <ul className="text-xs space-y-0.5 ml-3">
                <li>• Chaque unité ajoute sa <strong>def × nombre</strong>.</li>
                <li>• Si l'attaquant a au moins 1 Cavalier, la def des Archers défenseurs est <strong>×1.5</strong> (anti-cavalier).</li>
                <li>• Chaque <strong>Remparts</strong> ajoute +20 à la défense.</li>
                <li>• Chaque <strong>Palais</strong> ajoute +15 à la défense.</li>
                <li>• <strong>Bonus de ville</strong> selon palier (mêmes valeurs qu'en attaque).</li>
                <li>• Une <strong>Catapulte</strong> dans l'armée attaquante réduit la défense de 30%.</li>
              </ul>
            </div>
          </section>

          {/* ── Table des résultats ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">📜 Issue de la bataille</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Le ratio <strong>ATK / DEF</strong> détermine l'issue :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border rounded-lg">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 text-center font-heading">Ratio</th>
                    <th className="px-2 py-1.5 text-left font-heading">Issue</th>
                    <th className="px-2 py-1.5 text-center font-heading">Pertes ATK</th>
                    <th className="px-2 py-1.5 text-center font-heading">Pertes DEF</th>
                    <th className="px-2 py-1.5 text-center font-heading">Butin %</th>
                    <th className="px-2 py-1.5 text-center font-heading">Lingots</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-red-50/40">
                    <td className="px-2 py-1.5 text-center font-mono">&lt; 0.5</td>
                    <td className="px-2 py-1.5">💀 Désastre — l'armée s'est brisée sur les murailles</td>
                    <td className="px-2 py-1.5 text-center font-mono text-red-700">−80%</td>
                    <td className="px-2 py-1.5 text-center font-mono">−10%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0</td>
                  </tr>
                  <tr className="border-t border-border bg-orange-50/40">
                    <td className="px-2 py-1.5 text-center font-mono">0.5 – 0.8</td>
                    <td className="px-2 py-1.5">⚠️ Défaite — les soldats ont battu en retraite</td>
                    <td className="px-2 py-1.5 text-center font-mono text-orange-700">−50%</td>
                    <td className="px-2 py-1.5 text-center font-mono">−20%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0</td>
                  </tr>
                  <tr className="border-t border-border bg-amber-50/40">
                    <td className="px-2 py-1.5 text-center font-mono">0.8 – 1.0</td>
                    <td className="px-2 py-1.5">🟡 Victoire courte — la brèche fut courte mais fructueuse</td>
                    <td className="px-2 py-1.5 text-center font-mono">−30%</td>
                    <td className="px-2 py-1.5 text-center font-mono">−50%</td>
                    <td className="px-2 py-1.5 text-center font-mono">10%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0</td>
                  </tr>
                  <tr className="border-t border-border bg-green-50/40">
                    <td className="px-2 py-1.5 text-center font-mono">1.0 – 1.5</td>
                    <td className="px-2 py-1.5">✅ Victoire — la ville fut prise d'assaut</td>
                    <td className="px-2 py-1.5 text-center font-mono">−20%</td>
                    <td className="px-2 py-1.5 text-center font-mono">−70%</td>
                    <td className="px-2 py-1.5 text-center font-mono">15%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-amber-700">+1</td>
                  </tr>
                  <tr className="border-t border-border bg-green-100/60">
                    <td className="px-2 py-1.5 text-center font-mono">1.5 – 2.0</td>
                    <td className="px-2 py-1.5">⭐ Victoire nette — la garnison fut balayée</td>
                    <td className="px-2 py-1.5 text-center font-mono">−10%</td>
                    <td className="px-2 py-1.5 text-center font-mono">−90%</td>
                    <td className="px-2 py-1.5 text-center font-mono">20%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-amber-700">+2</td>
                  </tr>
                  <tr className="border-t border-border bg-emerald-100/70">
                    <td className="px-2 py-1.5 text-center font-mono">≥ 2.0</td>
                    <td className="px-2 py-1.5">👑 Victoire écrasante — la ville est à genoux</td>
                    <td className="px-2 py-1.5 text-center font-mono text-green-700">−5%</td>
                    <td className="px-2 py-1.5 text-center font-mono">−100%</td>
                    <td className="px-2 py-1.5 text-center font-mono">25%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-amber-700">+3</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="text-xs space-y-0.5 mt-2 ml-3 text-muted-foreground">
              <li>• <strong>Pertes ATK/DEF</strong> = pourcentage des unités tuées (les plus faibles meurent en premier).</li>
              <li>• <strong>Butin %</strong> = pourcentage du contenu de l'entrepôt ennemi pillé.</li>
              <li>• <strong>Lingots</strong> = lingots royaux capturés (utiles pour faire monter votre ville de palier).</li>
            </ul>
          </section>

          {/* ── Bonus bâtiments ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">🏰 Bâtiments défensifs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="border border-border rounded-lg p-2.5 text-xs">
                <div className="font-semibold mb-0.5">🧱 Remparts</div>
                <p className="text-muted-foreground">+20 défense par instance. Plusieurs remparts cumulent leur effet.</p>
              </div>
              <div className="border border-border rounded-lg p-2.5 text-xs">
                <div className="font-semibold mb-0.5">🏛️ Palais</div>
                <p className="text-muted-foreground">+15 défense par instance.</p>
              </div>
            </div>
          </section>

          {/* ── Coûts de campagne ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">💰 Coûts d'une campagne</h3>
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5 text-xs">
              <p>
                Déclarer une guerre coûte <strong>{WAR_DECLARATION_COST} or</strong> prélevés sur la
                trésorerie de la ville (or détruit, ne va à personne).
              </p>
              <p>
                Recruter une unité coûte son <strong>coût en or</strong> + ses <strong>ressources</strong>
                (bois, fer, etc.). L'or est versé à la trésorerie de votre propre ville.
              </p>
              <p>
                Entretenir une unité coûte de l'<strong>or par jour</strong> (cf. table) +
                de la <strong>nourriture/énergie</strong> de l'entrepôt. Sans ravitaillement, les
                unités désertent.
              </p>
            </div>
          </section>

          {/* ── Récompenses ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">🏆 Que rapporte une attaque ?</h3>

            <p className="text-xs text-muted-foreground mb-2">
              Les gains se répartissent entre <strong>la ville attaquante</strong> (collectif)
              et <strong>chaque contributeur</strong> (individuel).
            </p>

            <h4 className="font-heading text-sm font-semibold mt-3 mb-1.5">🏰 Pour la ville attaquante</h4>
            <ul className="text-xs space-y-1 ml-3 list-disc list-outside">
              <li>
                <strong>Butin sur l'entrepôt ennemi</strong> — % des ressources (bois, fer, pain, etc.) volées
                et déposées dans votre entrepôt.{" "}
                <span className="text-muted-foreground italic">Les lingots royaux ne sont pas concernés.</span>
              </li>
              <li>
                <strong>Lingots royaux pillés</strong> — transférés directement de la ville ennemie vers la
                vôtre. Ils font monter votre <strong>palier de cité</strong> (bonus permanents ATK/DEF) et
                peuvent même <strong>faire redescendre</strong> l'ennemie d'un palier.
              </li>
              <li>
                <strong>Affaiblissement durable de l'ennemi</strong> — sa garnison subit jusqu'à −100% de
                pertes selon l'ampleur de votre victoire.
              </li>
            </ul>

            <h4 className="font-heading text-sm font-semibold mt-3 mb-1.5">🪙 Pour chaque contributeur</h4>
            <p className="text-xs text-muted-foreground mb-1.5">
              Tout joueur ayant envoyé au moins 1 unité dans la campagne reçoit :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border rounded-lg">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-heading">Issue</th>
                    <th className="px-2 py-1.5 text-center font-heading">XP rang</th>
                    <th className="px-2 py-1.5 text-center font-heading">💰 Or</th>
                    <th className="px-2 py-1.5 text-center font-heading">⚔️ Rang militaire</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-red-50/40">
                    <td className="px-2 py-1.5">Défaite (toute issue &lt; 1.0)</td>
                    <td className="px-2 py-1.5 text-center font-mono">+50</td>
                    <td className="px-2 py-1.5 text-center font-mono">+5</td>
                    <td className="px-2 py-1.5 text-center font-mono">+1</td>
                  </tr>
                  <tr className="border-t border-border bg-green-50/40">
                    <td className="px-2 py-1.5">Victoire (toute issue ≥ 1.0)</td>
                    <td className="px-2 py-1.5 text-center font-mono">+150</td>
                    <td className="px-2 py-1.5 text-center font-mono">+15</td>
                    <td className="px-2 py-1.5 text-center font-mono">+1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              Le compteur de rang militaire fait progresser votre titre : Manant → Écuyer → Chevalier
              → Sire → Baron → Seigneur de Guerre.
            </p>

            <h4 className="font-heading text-sm font-semibold mt-3 mb-1.5">📊 Récapitulatif par issue</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border rounded-lg">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-heading">Issue</th>
                    <th className="px-2 py-1.5 text-center font-heading">Butin entrepôt</th>
                    <th className="px-2 py-1.5 text-center font-heading">Lingots</th>
                    <th className="px-2 py-1.5 text-center font-heading">XP/Or par joueur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-red-50/40">
                    <td className="px-2 py-1.5">💀 Désastre</td>
                    <td className="px-2 py-1.5 text-center font-mono">0%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0</td>
                    <td className="px-2 py-1.5 text-center font-mono">+50 / +5</td>
                  </tr>
                  <tr className="border-t border-border bg-orange-50/40">
                    <td className="px-2 py-1.5">⚠️ Défaite</td>
                    <td className="px-2 py-1.5 text-center font-mono">0%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0</td>
                    <td className="px-2 py-1.5 text-center font-mono">+50 / +5</td>
                  </tr>
                  <tr className="border-t border-border bg-amber-50/40">
                    <td className="px-2 py-1.5">🟡 Victoire courte</td>
                    <td className="px-2 py-1.5 text-center font-mono">10%</td>
                    <td className="px-2 py-1.5 text-center font-mono">0</td>
                    <td className="px-2 py-1.5 text-center font-mono">+150 / +15</td>
                  </tr>
                  <tr className="border-t border-border bg-green-50/40">
                    <td className="px-2 py-1.5">✅ Victoire</td>
                    <td className="px-2 py-1.5 text-center font-mono">15%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-amber-700">+1</td>
                    <td className="px-2 py-1.5 text-center font-mono">+150 / +15</td>
                  </tr>
                  <tr className="border-t border-border bg-green-100/60">
                    <td className="px-2 py-1.5">⭐ Victoire nette</td>
                    <td className="px-2 py-1.5 text-center font-mono">20%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-amber-700">+2</td>
                    <td className="px-2 py-1.5 text-center font-mono">+150 / +15</td>
                  </tr>
                  <tr className="border-t border-border bg-emerald-100/70">
                    <td className="px-2 py-1.5">👑 Victoire écrasante</td>
                    <td className="px-2 py-1.5 text-center font-mono">25%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-amber-700">+3</td>
                    <td className="px-2 py-1.5 text-center font-mono">+150 / +15</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground mt-2 italic">
              💡 Le vrai trésor, ce sont les <strong>lingots royaux</strong> — c'est le moyen le plus rapide
              de monter votre cité de palier (l'autre voie étant l'Orfèvre, beaucoup plus longue).
            </p>
          </section>

          {/* ── Conseils stratégiques ── */}
          <section>
            <h3 className="font-heading text-base font-semibold mb-2">📜 Conseils du vieil Aldebert</h3>
            <ul className="text-xs space-y-1 ml-3 list-disc list-outside text-muted-foreground">
              <li>Ne déclarez la guerre qu'avec un <strong>ratio ATK/DEF supérieur à 1.5</strong> pour minimiser les pertes.</li>
              <li>Une <strong>Catapulte</strong> change la donne face à une ville fortifiée — −30% sur la défense ennemie.</li>
              <li>Les <strong>Archers</strong> brillent en défense, surtout si l'ennemi mise sur la cavalerie (×1.5).</li>
              <li>Le <strong>Cavalier</strong> a la meilleure attaque pure (30) mais peu de défense (10) — bon pour les raids éclairs.</li>
              <li>Les <strong>Chevaliers</strong> sont l'élite, mais leur palier élevé en limite l'accès aux jeunes villes.</li>
              <li>Faire monter votre ville de <strong>palier</strong> donne un bonus permanent +5%/palier en attaque ET en défense.</li>
            </ul>
          </section>

        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex justify-end rounded-b-lg">
          <Button size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}
