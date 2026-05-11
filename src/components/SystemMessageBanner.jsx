import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight } from "lucide-react";

/**
 * Bandeau système qui défile en haut de l'app.
 *
 * Modes (10/05/2026) :
 * - Par défaut : visible uniquement en desktop (`hidden md:block`)
 *   Sur mobile, le bandeau global est caché ; il est ré-affiché par
 *   VillageView en overlay sur la map (mode `overlay`).
 * - mode="overlay" : variante compacte intégrée à la map (mobile).
 */
export default function SystemMessageBanner({ mode = "default" }) {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessage = async () => {
      try {
        const messages = await base44.entities.SystemMessage.filter({ is_active: true });
        if (messages.length > 0) {
          setMessage(messages[0].message);
        }
      } catch (e) {
        console.error("Erreur chargement message système:", e);
      }
      setLoading(false);
    };

    loadMessage();
    const unsubscribe = base44.entities.SystemMessage.subscribe((event) => {
      if (event.type === "update" || event.type === "create") {
        loadMessage();
      }
    });

    return unsubscribe;
  }, []);

  if (loading || !message) return null;

  // ── Mode "overlay" : pour mobile, intégré dans la map ─────────────────
  // Le wrapper parent (VillageView) gère le positionnement en overlay.
  if (mode === "overlay") {
    return (
      <div className="bg-accent/85 backdrop-blur-sm text-accent-foreground overflow-hidden">
        <div className="animate-marquee inline-flex items-center gap-8 py-1 px-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-body text-xs">{message}</span>
          </div>
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-body text-xs">{message}</span>
          </div>
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 20s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // ── Mode "default" : caché sur mobile (la map gère son propre overlay) ──
  return (
    <div className="hidden md:block bg-accent text-accent-foreground overflow-hidden">
      <div className="animate-marquee inline-flex items-center gap-8 py-2 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          <span className="font-body text-sm">{message}</span>
        </div>
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          <span className="font-body text-sm">{message}</span>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
