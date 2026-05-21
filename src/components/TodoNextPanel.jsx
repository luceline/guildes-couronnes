// src/components/TodoNextPanel.jsx
//
// Drawer "📅 Aujourd'hui" : les 5 essentiels du jour.
//
// CHARGE :
//   - profile.quests (PlayerObjective today)
//   - boss actif (collection `boss` — un seul à la fois)
//   - hasUsedCauldronToday → bool agrégé (n'importe quelle rank suffit)

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44, pb } from "@/api/base44Client";
import { hasUsedCauldronToday } from "@/lib/cauldronHelpers";
import { generateTodoCards } from "@/lib/todoNext";


// Styles par state
const STATE_STYLES = {
  done:     'bg-emerald-50/60 border-emerald-200 opacity-75',
  progress: 'bg-amber-50/60 border-amber-300',
  todo:     'bg-card border-amber-200 hover:bg-amber-50 hover:border-amber-300',
};
const STATE_CHECKBOX = {
  done:     'bg-emerald-500 border-emerald-500',
  progress: 'bg-amber-300 border-amber-400',
  todo:     'bg-white border-amber-400',
};
const STATE_LABEL = {
  done:     '✓',
  progress: '…',
  todo:     '',
};


export default function TodoNextPanel({ profile, city, onNavigate, onOpenSavoir }) {
  const [quests, setQuests] = useState([]);
  const [boss, setBoss] = useState(null);
  const [cauldronUsedToday, setCauldronUsedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charge quêtes du jour + boss actif + état chaudron en parallèle
  useEffect(() => {
    if (!profile?.user_email) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];

    Promise.all([
      // Quêtes du jour (active + completed)
      base44.entities.PlayerObjective.filter({ player_email: profile.user_email, status: 'active' }),
      base44.entities.PlayerObjective.filter({ player_email: profile.user_email, status: 'completed' }),
      // Boss : passe par l'endpoint custom (gère locks + normalisation)
      pb.send('/api/boss/current', { method: 'GET' }).then(r => r?.boss || null).catch(() => null),
      // État chaudron : retourne {1:bool, 2:bool, 3:bool}, on agrège en un seul bool
      hasUsedCauldronToday(profile.user_email).catch(() => ({})),
    ])
      .then(([active, done, bossRes, cauldronStatus]) => {
        if (cancelled) return;
        const all = [...(active || []), ...(done || [])].filter(o =>
          (o.created_date || o.quest_date || '').startsWith(todayStr)
        );
        setQuests(all);
        setBoss(bossRes);
        // Au moins une rank utilisée aujourd'hui = considéré comme "fait"
        setCauldronUsedToday(Object.values(cauldronStatus || {}).some(Boolean));
      })
      .catch(err => {
        console.warn('[TodoNext] load error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [profile?.user_email]);

  const cards = useMemo(
    () => generateTodoCards({ profile, city, quests, boss, cauldronUsedToday }),
    [profile, city, quests, boss, cauldronUsedToday]
  );

  const doneCount = cards.filter(c => c.state === 'done').length;
  const totalCount = cards.length;

  const handleCardClick = (card) => {
    if (!card.target) return;
    if (typeof onNavigate === 'function') {
      onNavigate(card.target, card.subTarget);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header avec progression globale */}
      <div className="flex items-center justify-between text-xs font-body">
        <span className="text-muted-foreground">
          {loading
            ? 'Chargement...'
            : doneCount === totalCount
            ? '🎉 Journée complète ! Reviens demain.'
            : `${doneCount}/${totalCount} essentiels accomplis`}
        </span>
      </div>

      {/* Liste cards (toujours 5, dans le même ordre) */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card)}
              disabled={!card.target}
              className={`w-full text-left rounded-lg border-2 p-3 transition-all active:scale-[0.98] ${STATE_STYLES[card.state]} ${!card.target ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox visuelle */}
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${STATE_CHECKBOX[card.state]}`}>
                  {STATE_LABEL[card.state] && (
                    <span className={`text-[12px] leading-none ${card.state === 'done' ? 'text-white' : 'text-amber-900'}`}>
                      {STATE_LABEL[card.state]}
                    </span>
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base shrink-0">{card.icon}</span>
                    <span className={`font-heading text-sm font-semibold truncate ${card.state === 'done' ? 'line-through' : ''}`}>
                      {card.title}
                    </span>
                  </div>
                  <p className="text-[11px] font-body text-muted-foreground mt-0.5">
                    {card.subtitle}
                  </p>
                </div>

                {/* Chevron action */}
                {card.target && card.state !== 'done' && (
                  <span className="text-amber-600 text-lg shrink-0 self-center">→</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lien Bibliothèque en bas (puisque la tuile a disparu) */}
      <div className="pt-2 border-t border-border">
        <Button
          variant="outline"
          onClick={onOpenSavoir}
          className="w-full font-body text-xs h-9"
        >
          📚 Aide & savoir du royaume
        </Button>
      </div>
    </div>
  );
}
