import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Bug } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "combat",  label: "⚔️ Combat" },
  { value: "market",  label: "🛒 Marché" },
  { value: "mairie",  label: "🏛️ Mairie" },
  { value: "quetes",  label: "📜 Quêtes" },
  { value: "ui",      label: "🖥️ UI / Affichage" },
  { value: "autre",   label: "❓ Autre" },
];

const MAX_DESCRIPTION = 1000;

/**
 * Modale "Signaler un bug" accessible depuis le menu haut.
 *
 * La modale fetch elle-même le profil et la cité du joueur connecté au montage
 * (pas besoin de les passer en props depuis le parent).
 *
 * Props :
 *   - onClose : callback appelé après envoi ou fermeture
 *
 * Le formulaire écrit dans la collection PocketBase `bug_reports`. Un hook
 * serveur `bug_report_discord.pb.js` envoie alors un embed Discord automatique.
 */
export default function BugReportModal({ onClose }) {
  const location = useLocation();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("autre");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [cityName, setCityName] = useState("");

  // Fetch profile + city au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;
        const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
        if (profiles.length === 0 || cancelled) return;
        const p = profiles[0];
        setProfile(p);
        // Cité actuelle si disponible
        if (p.current_city_id) {
          try {
            const city = await base44.entities.City.get(p.current_city_id);
            if (!cancelled && city?.name) setCityName(city.name);
          } catch (_) { /* silencieux */ }
        }
      } catch (_) { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      toast.error("Décrivez le bug en au moins quelques mots (10 caractères minimum).");
      return;
    }
    if (trimmed.length > MAX_DESCRIPTION) {
      toast.error(`Description trop longue (${MAX_DESCRIPTION} caractères max).`);
      return;
    }
    setBusy(true);
    try {
      // Détection succincte du navigateur depuis user-agent
      const ua = navigator.userAgent || "";
      let uaShort = "Inconnu";
      if (/iPhone|iPad/.test(ua))                  uaShort = "iOS Safari";
      else if (/Android/.test(ua) && /Chrome/.test(ua)) uaShort = "Android Chrome";
      else if (/Edg\//.test(ua))                   uaShort = "Edge";
      else if (/Firefox/.test(ua))                 uaShort = "Firefox";
      else if (/Chrome/.test(ua))                  uaShort = "Chrome desktop";
      else if (/Safari/.test(ua))                  uaShort = "Safari desktop";

      await base44.entities.BugReport.create({
        description: trimmed,
        category,
        player_name: profile?.character_name || "(anonyme)",
        player_city: cityName || "(sans cité)",
        page_url:    location.pathname || "/",
        user_agent:  uaShort + " — " + ua.substring(0, 200),
      });
      toast.success("🐛 Bug signalé, merci ! Le crieur public l'a transmis au royaume.");
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'envoi du signalement. Réessayez plus tard.");
    } finally {
      setBusy(false);
    }
  };

  const remainingChars = MAX_DESCRIPTION - description.length;
  const countColor = remainingChars < 0
    ? "text-red-600 font-semibold"
    : remainingChars < 100 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-lg border-2 border-primary/30 shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col my-auto">
        <CardHeader className="relative pb-2 shrink-0">
          <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" disabled={busy}>
            <X className="h-4 w-4" />
          </button>
          <CardTitle className="font-heading text-xl flex items-center gap-2">
            <Bug className="h-5 w-5 text-accent" />
            Signaler un bug
          </CardTitle>
          <p className="text-xs text-muted-foreground font-body italic">
            🐛 Décrivez ce que vous avez vu, ce que vous attendiez, et la ligne du temps. Le royaume vous remerciera.
          </p>
        </CardHeader>

        <CardContent className="overflow-y-auto py-2 min-h-0 space-y-4">
          <div>
            <label className="text-xs font-heading font-semibold mb-1 block">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
              className="w-full text-sm font-body border border-border rounded px-2 py-1.5 bg-background"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-heading font-semibold mb-1 block">Description du bug</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              rows={6}
              placeholder="Que s'est-il passé ? Qu'attendiez-vous ? Comment reproduire ?"
              className="w-full text-sm font-body border border-border rounded px-2 py-1.5 bg-background resize-y min-h-[120px]"
              maxLength={MAX_DESCRIPTION + 50}
            />
            <p className={`text-[11px] mt-1 font-body ${countColor}`}>
              {remainingChars} caractère{Math.abs(remainingChars) > 1 ? "s" : ""} restant{Math.abs(remainingChars) > 1 ? "s" : ""}
            </p>
          </div>

          <div className="text-[11px] text-muted-foreground font-body italic bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
            Sont transmis automatiquement avec votre signalement : votre nom de personnage ({profile?.character_name || "?"}),
            votre cité actuelle ({cityName || "?"}), la page consultée ({location.pathname}) et votre type de navigateur.
            Ces informations aident le royaume à reproduire et corriger le bug plus vite.
          </div>
        </CardContent>

        <div className="p-4 pt-2 shrink-0 border-t border-border flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="font-body" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button className="flex-1 font-heading" onClick={submit} disabled={busy || description.trim().length < 10}>
            {busy ? "Envoi en cours..." : "🐛 Envoyer le signalement"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
