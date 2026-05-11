/**
 * HubPage : page-passerelle qui présente 2-4 sous-pages d'un même thème
 * sous forme de grandes cartes cliquables.
 *
 * Utilisé pour les regroupements du menu (Production, Aventure, Savoir).
 *
 * Props :
 *   - title    : titre de la page (ex: "Le labeur du jour")
 *   - subtitle : phrase d'introduction (ton ménestrel)
 *   - cards    : array de { path?, onClick?, icon, title, description, accent?, badge? }
 *                 - path : navigue vers une route
 *                 - onClick : déclenche un callback (ex : ouvrir un modal)
 *                 - Au moins l'un des 2 doit être fourni.
 */
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export default function HubPage({ title, subtitle, cards = [] }) {
  // Card content factorisé pour réutiliser entre <Link> et <button>
  const renderCardInner = (card) => (
    <Card className="h-full border-2 border-border hover:border-primary/60 transition-all hover:shadow-lg hover:-translate-y-0.5">
      <CardContent className="pt-6 pb-5 px-5 flex flex-col h-full min-h-[140px]">
        <div className="flex items-start gap-3 mb-2">
          <span className="text-4xl shrink-0">{card.icon}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-lg font-semibold leading-tight">
              {card.title}
            </h2>
            {card.badge && (
              <span className="inline-block mt-1 text-[10px] bg-red-600 text-white font-heading rounded-full px-2 py-0.5">
                {card.badge}
              </span>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed flex-1 text-left">
          {card.description}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* En-tête */}
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground font-body italic">{subtitle}</p>
        )}
      </div>

      {/* Grille de cartes : 1 colonne mobile, 2 colonnes tablette, 3 colonnes desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card, idx) => {
          // Mode bouton (onClick) : pour actions custom (ouvrir modal, etc.)
          if (card.onClick) {
            return (
              <button
                key={card.path || `card-${idx}`}
                type="button"
                onClick={card.onClick}
                className="block group text-left w-full"
              >
                {renderCardInner(card)}
              </button>
            );
          }
          // Mode lien (path) : navigation classique
          return (
            <Link
              key={card.path}
              to={card.path}
              className="block group"
            >
              {renderCardInner(card)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
