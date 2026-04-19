import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { toast.error("Email et mot de passe requis."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        toast.success("Connexion réussie !");
      } else {
        if (!name) { toast.error("Nom requis."); setLoading(false); return; }
        await signUp(email, password, name);
        toast.success("Compte créé ! Bienvenue dans les chroniques ⚔️");
      }
    } catch (e) {
      toast.error(e?.data?.message || (mode === "login" ? "Email ou mot de passe incorrect." : "Erreur lors de l'inscription."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-2">⚔️</div>
          <CardTitle className="font-heading text-2xl">Guildes & Couronnes</CardTitle>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {mode === "login" ? "Connectez-vous pour rejoindre le royaume" : "Créez votre compte pour entrer dans les chroniques"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1">
              <Label className="font-body">Votre nom</Label>
              <Input
                placeholder="Nom d'affichage"
                value={name}
                onChange={e => setName(e.target.value)}
                className="font-body"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="font-body">Email</Label>
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="font-body"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1">
            <Label className="font-body">Mot de passe</Label>
            <Input
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="font-body"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <Button
            className="w-full font-heading"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "..." : mode === "login" ? "Se connecter ⚔️" : "Créer mon compte ⚔️"}
          </Button>
          <p className="text-center text-sm text-muted-foreground font-body">
            {mode === "login" ? (
              <>Pas encore de compte ?{" "}
                <button onClick={() => setMode("register")} className="text-primary underline">S'inscrire</button>
              </>
            ) : (
              <>Déjà un compte ?{" "}
                <button onClick={() => setMode("login")} className="text-primary underline">Se connecter</button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}