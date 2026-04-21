import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import pb from "@/api/base44Client";
import { useMusicPlayer } from "../lib/MusicContext";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { togglePlay, isPlaying, enabled } = useMusicPlayer();
  const [mode, setMode] = useState("login"); // "login" | "register" | "reset" | "reset_sent"
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
    console.log('reset clicked', email);
    if (!email) { toast.error("Entrez votre adresse email."); return; }
    setLoading(true);
    try {
      await pb.collection("users").requestPasswordReset(email.toLowerCase());
      setMode("reset_sent");
    } catch (e) {
      console.error('reset error:', e);
      toast.error("Erreur lors de l'envoi. Vérifiez votre email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-4">

        {mode === "login" && (
          <div style={{
            background: "linear-gradient(135deg, #1a0a00 0%, #3d2a0a 100%)",
            border: "2px solid #c9a44a",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
          }}>
            <p style={{ color: "#ffd700", fontFamily: "Georgia, serif", fontSize: "0.95rem", fontWeight: "bold", marginBottom: "0.4rem" }}>
              ⚠️ Suite à la migration serveur
            </p>
            <p style={{ color: "#f5e6c0", fontFamily: "sans-serif", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
              Si vous aviez déjà un compte, votre personnage est conservé.<br />
              Définissez simplement votre nouveau mot de passe ci-dessous.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
              <span style={{ color: "#c9a44a", fontSize: "1.3rem" }}>↓</span>
              <span style={{ color: "#c9a44a", fontFamily: "sans-serif", fontSize: "0.8rem", fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase" }}>
                Cliquez sur "Première connexion ou mot de passe oublié ?"
              </span>
            </div>
          </div>
        )}

        <Card className="w-full">
          <CardHeader className="text-center pb-2">
            <div className="text-4xl mb-2">⚔️</div>
            <CardTitle className="font-heading text-2xl">Guildes & Couronnes</CardTitle>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {mode === "login" && "Connectez-vous pour rejoindre le royaume"}
              {mode === "register" && "Créez votre compte pour entrer dans les chroniques"}
              {mode === "reset" && "Réinitialisez votre mot de passe"}
              {mode === "reset_sent" && "Email envoyé !"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {mode === "reset_sent" ? (
              <div className="space-y-4">
                <div style={{ background: "#1a0a00", border: "2px solid #c9a44a", borderRadius: "0.75rem", padding: "1.25rem" }}>
                  <p style={{ color: "#ffd700", fontWeight: "bold", marginBottom: "0.75rem", fontFamily: "Georgia, serif", fontSize: "0.95rem" }}>
                    📧 Vérifiez votre boîte mail
                  </p>
                  <ul style={{ color: "#f5e6c0", fontFamily: "sans-serif", fontSize: "0.85rem", lineHeight: 2, paddingLeft: "1.2rem", margin: 0 }}>
                    <li>Consultez vos <strong style={{ color: "#ffd700" }}>spams / courriers indésirables</strong></li>
                    <li>L'email peut mettre 1 à 2 minutes à arriver</li>
                    <li>L'expéditeur est <strong style={{ color: "#ffd700" }}>lucas.brunet51@gmail.com</strong></li>
                  </ul>
                </div>
                <div style={{ background: "#0a0804", border: "1px solid #3d2a0a", borderRadius: "0.5rem", padding: "1rem" }}>
                  <p style={{ color: "#a89070", fontFamily: "sans-serif", fontSize: "0.8rem", lineHeight: 1.7, margin: 0 }}>
                    🛠️ <strong style={{ color: "#c9a44a" }}>Bug en jeu ?</strong> Appuyez sur <strong style={{ color: "#c9a44a" }}>Ctrl + Shift + R</strong> pour vider le cache et forcer le rechargement.
                  </p>
                </div>
                <p className="text-center text-xs text-muted-foreground font-body">
                  En cas de problème : <a href="mailto:lucas.brunet51@gmail.com" className="text-primary underline">lucas.brunet51@gmail.com</a>
                </p>
                <Button className="w-full font-heading" onClick={() => setMode("login")}>
                  Retour à la connexion
                </Button>
              </div>

            ) : mode === "reset" ? (
              <>
                <div className="space-y-1">
                  <Label className="font-body">Email</Label>
                  <Input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} className="font-body"
                    onKeyDown={e => e.key === "Enter" && handleReset()} />
                </div>
                <Button className="w-full font-heading" onClick={handleReset} disabled={loading}>
                  {loading ? "Envoi..." : "📧 Envoyer le lien de réinitialisation"}
                </Button>
                <p className="text-center text-sm text-muted-foreground font-body">
                  <button onClick={() => setMode("login")} className="text-primary underline">Retour à la connexion</button>
                </p>
              </>

            ) : (
              <>
                {mode === "register" && (
                  <div className="space-y-1">
                    <Label className="font-body">Votre nom</Label>
                    <Input placeholder="Nom d'affichage" value={name} onChange={e => setName(e.target.value)} className="font-body" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="font-body">Email</Label>
                  <Input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} className="font-body"
                    onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                </div>
                <div className="space-y-1">
                  <Label className="font-body">Mot de passe</Label>
                  <Input type="password" placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} className="font-body"
                    onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                </div>
                <Button className="w-full font-heading" onClick={handleSubmit} disabled={loading}>
                  {loading ? "..." : mode === "login" ? "Se connecter ⚔️" : "Créer mon compte ⚔️"}
                </Button>
                {mode === "login" && (
                  <p className="text-center text-xs font-body">
                    <button onClick={() => setMode("reset")} style={{ color: "#c9a44a", textDecoration: "underline", fontWeight: "bold" }}>
                      ← Première connexion ou mot de passe oublié ?
                    </button>
                  </p>
                )}
                <p className="text-center text-sm text-muted-foreground font-body">
                  {mode === "login" ? (
                    <>Pas encore de compte ?{" "}<button onClick={() => setMode("register")} className="text-primary underline">S'inscrire</button></>
                  ) : (
                    <>Déjà un compte ?{" "}<button onClick={() => setMode("login")} className="text-primary underline">Se connecter</button></>
                  )}
                </p>
                <p className="text-center text-xs text-muted-foreground font-body pt-2 border-t border-border">
                  En cas de problème lors de la migration :<br />
                  <a href="mailto:lucas.brunet51@gmail.com" className="text-primary underline">lucas.brunet51@gmail.com</a>
                </p>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
