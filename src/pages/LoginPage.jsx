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
      if (enabled && !isPlaying) {
        setTimeout(() => togglePlay(), 500);
      }
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
      toast.success("Email envoyé ! Vérifiez votre boîte mail pour réinitialiser votre mot de passe.");
      setMode("login");
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
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1">
                <Label className="font-body">Votre nom</Label>
                <Input placeholder="Nom d'affichage" value={name} onChange={e => setName(e.target.value)} className="font-body" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="font-body">Email</Label>
              <Input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} className="font-body" onKeyDown={e => e.key === "Enter" && (mode === "reset" ? handleReset() : handleSubmit())} />
            </div>
            {mode !== "reset" && (
              <div className="space-y-1">
                <Label className="font-body">Mot de passe</Label>
                <Input type="password" placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} className="font-body" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
            )}
            {mode === "reset" ? (
              <>
                <Button className="w-full font-heading" onClick={handleReset} disabled={loading}>
                  {loading ? "Envoi..." : "📧 Envoyer le lien de réinitialisation"}
                </Button>
                <p className="text-center text-sm text-muted-foreground font-body">
                  <button onClick={() => setMode("login")} className="text-primary underline">Retour à la connexion</button>
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



