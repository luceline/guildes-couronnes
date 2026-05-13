/**
 * HabitantsContent — Onglet "Habitants" de CityView.
 *
 * Affiche :
 *   - Panel nomination des rôles (maire uniquement)
 *   - Liste des résidents avec leurs badges, scores et actions (expel, atelier, défier)
 *   - Liste des visiteurs de passage
 *
 * Extrait de CityView.jsx le 09/05/2026 (refacto Phase 2) — comportement identique.
 *
 * Props :
 *   - cityPlayers : liste des joueurs présents dans la ville (résidents + visiteurs)
 *   - city : objet City courante
 *   - profile : PlayerProfile du joueur courant
 *   - isMayor : booleen, vrai si profile est le maire actif de la ville
 *   - isHomeCity : booleen, vrai si profile.home_city_id === city.id
 *   - cityRoles : objet city.city_roles (percepteur_id, chef_guerre_id, acheteur_id, etc.)
 *   - selectedAtelier : id du producteur dont l'atelier est ouvert (ou null)
 *   - setSelectedAtelier : setter
 *   - setChallengeTarget : setter pour ouvrir la modale ChallengeForm
 *   - onSetRole(role, player|null) : handler nomination/retrait d'un rôle
 *   - onExpel(targetPlayer) : handler expulsion
 *   - onRefresh : callback pour rafraichir le profil/ville
 *   - isPlayerOnline : helper qui retourne true si player.last_active_at < 5 min
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HelpTooltip from "../HelpTooltip";
import AtelierCommande from "../AtelierCommande";
import {
  getVendeurRank, getContributeurRank, getPvpRank,
  getAttackScore, getDefenseScore, isPlayerKO,
} from "../../lib/gameData";

const ROLES = [
  { key: "percepteur", label: "Percepteur", icon: "💰", desc: "Accès impôts & taxes" },
  { key: "chef_guerre", label: "Chef de guerre", icon: "⚔️", desc: "Accès onglet Guerre" },
  { key: "acheteur", label: "Acheteur", icon: "🛒", desc: "Accès offres d'achat" },
];

export default function HabitantsContent({
  cityPlayers,
  city,
  profile,
  isMayor,
  isHomeCity,
  cityRoles,
  selectedAtelier,
  setSelectedAtelier,
  setChallengeTarget,
  onSetRole,
  onExpel,
  onRefresh,
  isPlayerOnline,
}) {
  const residents = cityPlayers.filter(p => p.home_city_id === city.id);
  const visitors = cityPlayers.filter(p => p.home_city_id !== city.id && !p.is_traveling);

  return (
    <div className="space-y-3">
      {/* ── Panel nomination rôles (maire uniquement) ── */}
      {isMayor && residents.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm flex items-center gap-2">
              👑 Nommer des officiers
              <HelpTooltip text="Le maire peut déléguer trois rôles à ses résidents. Le Percepteur accède aux réglages d'impôts et taxes. Le Chef de guerre gère l'armée et les campagnes. L'Acheteur configure les offres de rachat de l'entrepôt. Les rôles s'affichent en badge dans la liste des habitants." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES.map(({ key, label, icon, desc }) => {
              const currentId = cityRoles[`${key}_id`];
              const currentName = cityRoles[`${key}_name`];
              return (
                <div key={key} className="flex items-center gap-2 flex-wrap">
                  <span className="text-base w-6 text-center">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-heading font-semibold">{label}</div>
                    <div className="text-xs font-body text-muted-foreground">{desc}</div>
                  </div>
                  {currentId ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-body font-semibold text-amber-800">{currentName}</span>
                      <button
                        onClick={() => onSetRole(key, null)}
                        className="text-xs text-red-500 hover:text-red-700 font-body underline underline-offset-2"
                      >
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <select
                      className="text-xs font-body border border-amber-300 rounded px-2 py-1 bg-white"
                      defaultValue=""
                      onChange={e => {
                        const p = residents.find(r => r.id === e.target.value);
                        if (p) onSetRole(key, p);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Nommer</option>
                      {residents.filter(r => r.id !== profile.id).map(r => (
                        <option key={r.id} value={r.id}>{r.character_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Résidents ── */}
      {residents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm flex items-center gap-2">
              🏠 Résidents ({residents.length})
              <HelpTooltip
                side="bottom"
                text={
                  "Légende des icônes :\n\n" +
                  "👑 Maire de la cité\n" +
                  "💰 Percepteur (gère les taxes)\n" +
                  "⚔️ Chef de guerre (commande l'armée)\n" +
                  "🛒 Acheteur (achète au marché pour la cité)\n" +
                  "🟢 Joueur en ligne\n\n" +
                  "Sous le nom :\n" +
                  "🏆 Rang vendeur · 🏗️ Rang contributeur entrepôt · ⚔️ Rang PvP\n" +
                  "⚔️X Score d'attaque · 🛡️X Score de défense (visibles uniquement chez vos concitoyens)\n\n" +
                  "Boutons :\n" +
                  "🏪 Atelier : Commander à un artisan ou améliorer ton équipement\n" +
                  "⚔️ Défier : Lancer un défi PvP\n" +
                  "🚫 Expulser : Réservé au maire\n" +
                  "⚒️ M'améliorer : Self-service Bûcheron/Mineur"
                }
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {residents.map(p => {
                const isMe = p.id === profile.id;
                const online = isPlayerOnline(p);
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-3 text-sm font-body ${
                      online ? "bg-green-50 border border-green-200" : "bg-muted/50"
                    }`}
                  >
                    {/* En-tête : avatar + nom + badge online */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl shrink-0">{p.is_traveling ? "🐴" : "👤"}</span>
                      <div className="font-semibold text-base flex-1 truncate">{p.character_name}</div>
                      {online && (
                        <span className="text-xs text-green-700 bg-green-100 border border-green-300 rounded px-2 py-0.5 font-body shrink-0">
                          🟢 En ligne
                        </span>
                      )}
                    </div>

                    {/* Badges de rôle (sous le nom, sur leur propre ligne) */}
                    {(city?.mayor_id === p.id || cityRoles?.percepteur_id === p.id || cityRoles?.chef_guerre_id === p.id || cityRoles?.acheteur_id === p.id) && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {city?.mayor_id === p.id && <Badge className="bg-amber-500 text-white text-xs font-heading">👑 Maire</Badge>}
                        {cityRoles?.percepteur_id === p.id && <Badge variant="outline" className="text-blue-700 border-blue-300 text-xs">💰 Percepteur</Badge>}
                        {cityRoles?.chef_guerre_id === p.id && <Badge variant="outline" className="text-red-700 border-red-300 text-xs">⚔️ Chef de guerre</Badge>}
                        {cityRoles?.acheteur_id === p.id && <Badge variant="outline" className="text-purple-700 border-purple-300 text-xs">🛒 Acheteur</Badge>}
                      </div>
                    )}

                    {/* Métier + rangs + scores (compact, une seule ligne) */}
                    <div className="text-muted-foreground text-xs flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold">{p.profession}{p.is_traveling ? " · En voyage" : ""}</span>
                      <span title={`Ventes: ${p.cumul_ventes_or || 0}💰`}>{getVendeurRank(p.cumul_ventes_or || 0).icon}</span>
                      <span title={`Entrepôt: ${p.cumul_contributions_warehouse || 0}`}>{getContributeurRank(p.cumul_contributions_warehouse || 0).icon}</span>
                      {(p.cumul_t5_envoyes || 0) > 0 && <span title={`T5: ${p.cumul_t5_envoyes}`}>{getPvpRank(p.cumul_t5_envoyes || 0).icon}</span>}
                      {/* 13/05/2026 — atk/def visibles SEULEMENT si on est chez soi (concitoyens)
                          ou si c'est nos propres stats. En visite dans une autre ville,
                          les habitants ne dévoilent pas leurs capacités de combat. */}
                      {(isMe || isHomeCity) && getAttackScore(p) > 0 && <span title="Score d'attaque">⚔️{getAttackScore(p)}</span>}
                      {(isMe || isHomeCity) && getDefenseScore(p) > 0 && <span title="Score de défense">🛡️{getDefenseScore(p)}</span>}
                      {!isMe && !isHomeCity && (() => {
                        const hasBourse = (profile.inventory || []).some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
                        if (!hasBourse) return null;
                        return <span className="text-yellow-700 border border-yellow-300 bg-yellow-50 rounded px-1.5 py-0.5 font-body">👜 Bourse active</span>;
                      })()}
                    </div>

                    {/* Boutons d'action : flex-wrap propre, en bas */}
                    {(() => {
                      const showExpel = !isMe && isMayor;
                      const showAtelier = !isMe && (p.atelier_vitrine?.active || p.profession === "Bûcheron" || p.profession === "Mineur");
                      const showDefier = !isMe && !isPlayerKO(profile) && !isPlayerKO(p);
                      const showSelfImprove = isMe && (p.profession === "Bûcheron" || p.profession === "Mineur");
                      if (!showExpel && !showAtelier && !showDefier && !showSelfImprove) return null;
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          {showExpel && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-sm font-heading text-orange-600 border-orange-200 hover:bg-orange-50"
                              onClick={() => onExpel(p)}
                            >
                              🚫 Expulser
                            </Button>
                          )}
                          {showAtelier && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-sm font-heading text-amber-700 border-amber-300 hover:bg-amber-50"
                              onClick={() => setSelectedAtelier(selectedAtelier === p.id ? null : p.id)}
                            >
                              🏪 Atelier
                            </Button>
                          )}
                          {showDefier && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-sm font-heading text-red-700 border-red-300 hover:bg-red-50"
                              onClick={() => setChallengeTarget(p)}
                              title={`Défier ${p.character_name}`}
                            >
                              ⚔️ Défier
                            </Button>
                          )}
                          {showSelfImprove && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-sm font-heading text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => setSelectedAtelier(selectedAtelier === p.id ? null : p.id)}
                            >
                              ⚒️ M'améliorer
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* ── Atelier commande (REFONTE v4 : UpgradeServicePanel retiré) ── */}
            {selectedAtelier && (() => {
              const prod = residents.find(p => p.id === selectedAtelier);
              if (!prod) return null;
              return (
                <AtelierCommande
                  producer={prod}
                  clientProfile={profile}
                  onClose={() => setSelectedAtelier(null)}
                  onRefresh={onRefresh}
                />
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ── Visiteurs ── */}
      {visitors.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm flex items-center gap-2">
              🧳 Visiteurs ({visitors.length})
              <HelpTooltip
                side="bottom"
                text={
                  "Voyageurs de passage dans la cité.\n\n" +
                  "🟢 En ligne\n\n" +
                  "⚔️ Défier : Lancer un défi PvP contre ce visiteur"
                }
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {visitors.map(p => {
                const isMe = p.id === profile.id;
                const defenderScore = getDefenseScore(p);
                const online = isPlayerOnline(p);
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-3 text-sm font-body ${
                      online ? "bg-green-50/50 border border-green-200" : "bg-orange-50/50 border border-orange-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl shrink-0">🧳</span>
                      <div className="font-semibold text-base flex-1 truncate">{p.character_name}</div>
                      {online && (
                        <span className="text-xs text-green-700 bg-green-100 border border-green-300 rounded px-2 py-0.5 font-body shrink-0">
                          🟢 En ligne
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold">{p.profession} · de {p.home_city_id ? "ailleurs" : "?"}</span>
                      {/* 13/05/2026 — La défense des visiteurs (joueurs d'une autre ville)
                          est cachée. On ne voit les stats que de ses propres concitoyens
                          ou de soi-même. Cohérent avec le filtrage côté résidents. */}
                      {isMe && defenderScore > 0 && <span title="Score de défense">🛡️{defenderScore}</span>}
                    </div>
                    {!isMe && !isPlayerKO(profile) && !isPlayerKO(p) && (
                      <div className="flex">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-sm font-heading text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => setChallengeTarget(p)}
                          title={`Défier ${p.character_name}`}
                        >
                          ⚔️ Défier
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {residents.length === 0 && visitors.length === 0 && (
        <p className="text-sm text-muted-foreground font-body text-center py-4 italic">
          Les rues sont silencieuses… Nul voyageur ne foule les pavés pour l'heure.
        </p>
      )}

      {isMayor && residents.length > 0 && (
        <p className="text-xs text-muted-foreground font-body mt-2 italic">
          💡 Les joueurs inactifs restent comptabilisés comme résidents tant qu'ils n'ont pas déménagé.
        </p>
      )}
    </div>
  );
}
