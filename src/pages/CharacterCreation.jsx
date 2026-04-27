import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROFESSIONS, MAX_HUNGER } from "../lib/gameData";
import { createNewCityWithRoutes } from "../lib/cityCreation";

export default function CharacterCreation({ onComplete }) {
  const [cities, setCities] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ character_name: "", sex: "", height: "", profession: "", city_id: "" });

  useEffect(() => {
    async function load() {
      const [allCities, allPlayers] = await Promise.all([
        base44.entities.City.list(),
        base44.entities.PlayerProfile.list(),
      ]);
      setCities(allCities);
      setPlayers(allPlayers);
      setLoading(false);
    }
    load();
  }, []);

  const getPlayerStatus = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activePlayers = players.filter(p => !p.last_active_at || new Date(p.last_active_at) >= thirtyDaysAgo);
    const inactivePlayers = players.filter(p => p.last_active_at && new Date(p.last_active_at) < thirtyDaysAgo);
    return { activeCount: activePlayers.length, inactiveCount: inactivePlayers.length, canCreate: activePlayers.length < 500 };
  };

  // Compte les métiers sur l'ensemble du jeu — les joueurs voyagent, la ville n'a pas de sens ici
  const getProfessionCounts = () => {
    const counts = {};
    for (const p of players) {
      if (p.profession) counts[p.profession] = (counts[p.profession] || 0) + 1;
    }
    return counts;
  };

  const getProfessionBadge = (profKey, counts) => {
    const count = counts[profKey] || 0;
    if (count === 0) return { label: "✨ Absent du jeu", color: "bg-green-100 text-green-800 border-green-300" };
    if (count === 1) return { label: "👍 Conseillé", color: "bg-blue-100 text-blue-800 border-blue-300" };
    if (count <= 3) return { label: "⚠️ Présent", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
    return { label: "❌ Saturé", color: "bg-red-100 text-red-800 border-red-300" };
  };

  const MAX_CITIES = 10;

  const handleCreate = async () => {
    if (!form.character_name || !form.sex || !form.profession) return;
    const realCities = cities.filter(c => !c.is_bot_city);
    const allCitiesFull = realCities.length > 0 && realCities.every(c => (c.population || 0) >= (c.max_population || 3));
    const citiesCapped = realCities.length >= MAX_CITIES;
    const isSdf = allCitiesFull && citiesCapped;
    if (!form.city_id && !allCitiesFull && !isSdf) return;
    setCreating(true);
    console.log('[handleCreate] form:', JSON.stringify(form));
    const user = await base44.auth.me();

    const profData = PROFESSIONS[form.profession];
    const startGold = 200;

    let targetCityId = form.city_id;
    let updatedCities = cities;
    let sdfMode = false;

    if (!targetCityId) {
      if (isSdf) {
        targetCityId = form.preferred_city_id || realCities[0]?.id;
        sdfMode = true;
      } else if (allCitiesFull && realCities.length < MAX_CITIES) {
        const newCity = await createNewCityWithRoutes(realCities);
        targetCityId = newCity.id;
        updatedCities = [...cities, newCity];
      }
    }

    await base44.entities.PlayerProfile.create({
      user_email:      user.email,
      character_name:  form.character_name,
      sex:             form.sex,
      height:          form.height || "Moyen",
      profession:      form.profession,
      city_id:         targetCityId,
      home_city_id:    sdfMode ? null : targetCityId,
      is_sdf:          sdfMode,
      gold:            startGold,
      inventory:       profData.startItems,
      housing_level:   "tente",
      is_traveling:    false,
      tool_charges:    0,
      fatigue:         20,
      hunger:          MAX_HUNGER,
    });

    if (!sdfMode) {
      const city = updatedCities.find(c => c.id === targetCityId);
      if (city) {
        await base44.entities.City.update(city.id, { population: (city.population || 0) + 1 });
      }
    }
    onComplete();
  };

  const handleLogout = () => {
    try { base44.auth.logout(); } catch {}
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const { activeCount, inactiveCount, canCreate } = getPlayerStatus();
  if (!canCreate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-2 border-destructive/20">
          <CardHeader className="text-center space-y-2">
            <span className="text-4xl">⚠️</span>
            <CardTitle className="font-heading text-2xl text-destructive">Limite de joueurs atteinte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="font-body text-sm">Le jeu a atteint sa limite de <strong>500 joueurs actifs</strong>.</p>
            <p className="font-body text-xs text-muted-foreground">Joueurs actifs: <strong>{activeCount}</strong> | Comptes inactifs (30+ jours): <strong>{inactiveCount}</strong></p>
            <p className="font-body text-xs">Les comptes inactifs seront progressivement supprimés pour libérer de la place.</p>
            <Button variant="ghost" size="sm" className="font-body text-muted-foreground mt-2" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const realNonBotCities = cities.filter(c => !c.is_bot_city);
  const availableCities = realNonBotCities.filter(c => (c.population || 0) < (c.max_population || 5));
  const allCitiesFull = realNonBotCities.length > 0 && availableCities.length === 0;
  const citiesCappedRender = realNonBotCities.length >= 10;
  const isSdfMode = allCitiesFull && citiesCappedRender;
  const counts = getProfessionCounts();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-2 border-primary/20">
        <CardHeader className="text-center space-y-2">
          <span className="text-4xl">⚜️</span>
          <CardTitle className="font-heading text-2xl">Créer votre personnage</CardTitle>
          <p className="text-muted-foreground font-body text-sm">
            Le héraut royal déroule son parchemin… Quel nom porterez-vous dans les chroniques du royaume ?
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label className="font-body">Votre nom dans les chroniques</Label>
            <Input placeholder="Ex: Aldric le Forgeron, Mira la Marchande…" value={form.character_name}
              onChange={e => setForm({ ...form, character_name: e.target.value })} className="font-body" />
          </div>

          {/* Sex + Height */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Sexe</Label>
              <Select value={form.sex} onValueChange={v => setForm({ ...form, sex: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Homme">Homme</SelectItem>
                  <SelectItem value="Femme">Femme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Taille</Label>
              <Select value={form.height} onValueChange={v => setForm({ ...form, height: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Petit">Petit</SelectItem>
                  <SelectItem value="Moyen">Moyen</SelectItem>
                  <SelectItem value="Grand">Grand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label className="font-body">Votre cité d'origine</Label>
            {isSdfMode ? (
              <div className="space-y-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-body text-amber-800">
                  🏕️ <strong>Mode Sans-Domicile Fixe</strong> — Toutes les villes sont pleines et le cap de 10 villes est atteint. Vous arriverez en tant que visiteur et devrez attendre qu'une place se libère pour vous établir.
                </div>
                <Label className="font-body text-xs text-muted-foreground">Choisissez votre ville d'arrivée :</Label>
                <Select value={form.preferred_city_id} onValueChange={v => setForm({ ...form, preferred_city_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une ville d'arrivée" /></SelectTrigger>
                  <SelectContent>
                    {realNonBotCities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        🏘️ {city.name} ({city.population || 0}/{city.max_population || 5} — pleine)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : availableCities.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body">
                {allCitiesFull ? `🏙️ Toutes les villes sont pleines. Une nouvelle ville sera créée automatiquement (${realNonBotCities.length}/10 villes).` : "Aucune ville disponible pour le moment."}
              </p>
            ) : (
              <Select value={form.city_id} onValueChange={v => setForm({ ...form, city_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir votre cité d'origine" /></SelectTrigger>
                <SelectContent>
                  {availableCities.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      🏘️ {city.name} ({city.population || 0}/{city.max_population || 5} habitants)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Profession */}
          <div className="space-y-2">
            <Label className="font-body">
              Votre destinée <span className="text-xs text-muted-foreground ml-1">(les métiers absents du royaume sont les plus précieux)</span>
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(PROFESSIONS).map(([key, val]) => {
                const badge = getProfessionBadge(key, counts);
                const isSelected = form.profession === key;
                return (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, profession: key })}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{val.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-semibold text-sm">{key}</span>
                          <Badge className={`text-xs border ${badge.color}`}>{badge.label}</Badge>
                          {key === "Orfèvre" && <Badge variant="outline" className="text-xs">50 💰 de départ</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-body mt-0.5 truncate">{val.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs font-body text-amber-800">
            📜 <strong>Le royaume a besoin de vous :</strong> chaque artisan dépend des autres. Sans le Mineur, les forges s'éteignent. Sans le Fermier, les ventres crient famine. Les métiers <strong>absents du royaume</strong> sont les plus précieux — soyez celui qui manque !
          </div>

          <Button className="w-full font-heading tracking-wide" size="lg" onClick={handleCreate}
            disabled={creating || !form.character_name || !form.sex || !form.profession || (!form.city_id && !allCitiesFull && !isSdfMode) || (isSdfMode && !form.preferred_city_id)}>
            {creating ? "Les dieux tracent votre destin…" : "Entrer dans les chroniques ⚔️"}
          </Button>

          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" className="font-body text-muted-foreground" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}