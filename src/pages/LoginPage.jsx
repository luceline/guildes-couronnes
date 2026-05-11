import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import pb from "@/api/base44Client";
import { useMusicPlayer } from "../lib/MusicContext";
import landscapeImg from "@/assets/landscape.jpg";
import PWAInstallBanner from "@/components/PWAInstallBanner";

/**
 * LoginPage — splash screen plein écran (11/05/2026).
 * Refonte mobile-first : image de fond fullscreen, card semi-transparente avec
 * backdrop-blur, pas de scroll en mode portrait. Bandeau migration retiré.
 */
export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { togglePlay, isPlaying, enabled } = useMusicPlayer();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { toast.error("Email et mot de passe requis."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email.toLowerCase(), password);
        toast.success("Connexion réussie !");
      } else {
        if (!name) { toast.error("Nom requis."); setLoading(false); return; }
        await signUp(email.toLowerCase(), password, name);
        toast.success("Compte créé ! Bienvenue dans les chroniques ⚔️");
      }
      if (enabled && !isPlaying) setTimeout(() => togglePlay(), 500);
    } catch (e) {
      toast.error(e?.data?.message || (mode === "login" ? "Email ou mot de passe incorrect." : "Erreur lors de l'inscription."));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { toast.error("Entrez votre adresse email."); return; }
    setLoading(true);
    try {
      await pb.collection("users").requestPasswordReset(email.toLowerCase());
      setMode("reset_sent");
    } catch (e) {
      console.error("reset error:", e);
      toast.error("Erreur lors de l'envoi. Vérifiez votre email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Image de fond pleine page + overlay sombre */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${landscapeImg})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/75 -z-10" />

      {/* 11/05/2026 : Bannière PWA install (déplacée depuis LandingPage qui a
          été supprimée). Sticky en haut, cachée si déjà installée. */}
      <PWAInstallBanner />

      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-3 overflow-y-auto">
        {/* Titre + sous-titre compact */}
        <div className="text-center mb-3">
          <div className="text-3xl sm:text-5xl mb-0.5 drop-shadow-lg leading-none">⚔️</div>
          <h1
            className="font-heading text-xl sm:text-3xl font-bold tracking-wide drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)] leading-tight"
            style={{ color: "#f5e6c0" }}
          >
            Guildes &amp; Couronnes
          </h1>
          <p
            className="font-body text-[11px] sm:text-sm mt-0.5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]"
            style={{ color: "#e8d8b0" }}
          >
            {mode === "login" && "Rejoignez le royaume"}
            {mode === "register" && "Créez votre légende"}
            {mode === "reset" && "Réinitialisation"}
            {mode === "reset_sent" && "Email envoyé !"}
          </p>
        </div>

        {/* Card semi-transparente */}
        <div
          className="w-full max-w-md rounded-xl p-3 sm:p-5 space-y-2.5 shadow-2xl border"
          style={{
            background: "rgba(20, 16, 12, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderColor: "rgba(201, 164, 74, 0.4)",
          }}
        >
          {mode === "reset_sent" ? (
            <>
              <div
                style={{
                  background: "rgba(26, 10, 0, 0.6)",
                  border: "2px solid #c9a44a",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                }}
              >
                <p style={{ color: "#ffd700", fontWeight: "bold", marginBottom: "0.6rem", fontFamily: "Georgia, serif", fontSize: "0.95rem" }}>
                  📧 Vérifiez votre boîte mail
                </p>
                <ul style={{ color: "#f5e6c0", fontFamily: "sans-serif", fontSize: "0.82rem", lineHeight: 1.8, paddingLeft: "1.2rem", margin: 0 }}>
                  <li>Consultez vos <strong style={{ color: "#ffd700" }}>spams</strong></li>
                  <li>1 à 2 minutes pour recevoir l'email</li>
                  <li>Expéditeur : <strong style={{ color: "#ffd700" }}>lucas.brunet51@gmail.com</strong></li>
                </ul>
              </div>
              <Button className="w-full font-heading" onClick={() => setMode("login")}>
                Retour à la connexion
              </Button>
            </>
          ) : mode === "reset" ? (
            <>
              <div className="space-y-1">
                <Label className="font-body" style={{ color: "#f5e6c0" }}>Email</Label>
                <Input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-body bg-background/95"
                  onKeyDown={(e) => e.key === "Enter" && handleReset()}
                />
              </div>
              <Button className="w-full font-heading" onClick={handleReset} disabled={loading}>
                {loading ? "Envoi..." : "📧 Envoyer le lien"}
              </Button>
              <p className="text-center text-xs font-body">
                <button
                  onClick={() => setMode("login")}
                  style={{ color: "#c9a44a", textDecoration: "underline" }}
                >
                  Retour à la connexion
                </button>
              </p>
            </>
          ) : (
            <>
              {mode === "register" && (
                <div className="space-y-1">
                  <Label className="font-body" style={{ color: "#f5e6c0" }}>Votre nom</Label>
                  <Input
                    placeholder="Nom d'affichage"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="font-body bg-background/95"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="font-body" style={{ color: "#f5e6c0" }}>Email</Label>
                <Input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-body bg-background/95"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              <div className="space-y-1">
                <Label className="font-body" style={{ color: "#f5e6c0" }}>Mot de passe</Label>
                <Input
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-body bg-background/95"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              <Button
                className="w-full font-heading text-sm sm:text-base h-10 sm:h-11 shadow-lg"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "..." : mode === "login" ? "Se connecter ⚔️" : "Créer mon compte ⚔️"}
              </Button>
              {mode === "login" && (
                <p className="text-center text-xs font-body">
                  <button
                    onClick={() => setMode("reset")}
                    style={{ color: "#c9a44a", textDecoration: "underline", fontWeight: "bold" }}
                  >
                    Mot de passe oublié ?
                  </button>
                </p>
              )}
              <p
                className="text-center text-xs font-body pt-2 border-t"
                style={{ borderColor: "rgba(201, 164, 74, 0.25)", color: "#d8c890" }}
              >
                {mode === "login" ? (
                  <>
                    Pas encore de compte ?{" "}
                    <button
                      onClick={() => setMode("register")}
                      style={{ color: "#c9a44a", textDecoration: "underline" }}
                    >
                      S'inscrire
                    </button>
                  </>
                ) : (
                  <>
                    Déjà un compte ?{" "}
                    <button
                      onClick={() => setMode("login")}
                      style={{ color: "#c9a44a", textDecoration: "underline" }}
                    >
                      Se connecter
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        {/* Footer support discret */}
        <p
          className="font-body text-[9px] sm:text-[10px] mt-2 sm:mt-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
          style={{ color: "rgba(232, 216, 176, 0.7)" }}
        >
          Support :{" "}
          <a
            href="mailto:lucas.brunet51@gmail.com"
            style={{ color: "#c9a44a", textDecoration: "underline" }}
          >
            lucas.brunet51@gmail.com
          </a>
        </p>
      </div>
    </>
  );
}
