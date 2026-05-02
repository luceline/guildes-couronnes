import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, Lock } from "lucide-react";
import BountyBoard from "../components/BountyBoard";
import PlayerRanking from "../components/PlayerRanking";
import { FOOD_ITEMS_WITH_FATIGUE, computeFatigueWithDailyReset, getTodayStr } from "../lib/craftingData";
import { PROFESSIONS, getMaxFatigue, getCityFatigueBonus } from "../lib/gameData";
import { toast } from "sonner";
import { usePlayerData } from "../lib/usePlayerData";

async function getTavernSleepPrice(cityId) {
  const today = getTodayStr();
  const storageKey = `tavern_sleep_${cityId}_${today}`;
  const cached = localStorage.getItem(storageKey);
  if (cached) return JSON.parse(cached);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `Tu es le tavernier d'un jeu médiéval fantastique. Fixe le prix d'une nuit à la taverne pour aujourd'hui (${today}).
Réponds UNIQUEMENT avec du JSON valide, sans texte autour : {"price": <nombre entre 5 et 40>, "fatigue_restored": <nombre entre 20 et 60>, "reason": "<courte raison poétique en français, max 12 mots>"}
Varie selon des événements fictifs (fête, saison, affluence, événement spécial...).`
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      localStorage.setItem(storageKey, JSON.stringify(result));
      return result;
    }
  } catch (e) {
    console.error("Tavern price AI error:", e);
  }
  const fallback = { price: 15, fatigue_restored: 35, reason: "Tarif standard de la maison." };
  localStorage.setItem(storageKey, JSON.stringify(fallback));
  return fallback;
}

function ChatMessages({ messages, profile, bottomRef, emptyText, bubbleClass }) {
  const prof = (name) => PROFESSIONS[name];
  return (
    <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <div className="text-center text-muted-foreground font-body text-sm py-8">{emptyText}</div>
      )}
      {messages.map((msg, i) => {
        const isMe = msg.author_email === profile.user_email;
        const profData = prof(msg.profession);
        return (
          <div key={msg.id || i} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${bubbleClass || "bg-muted"}`}>
              {profData?.icon || "👤"}
            </div>
            <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
              <div className={`text-xs font-body text-muted-foreground ${isMe ? "text-right" : ""}`}>
                {msg.author_name}
                {msg.profession && <span className="ml-1 opacity-70">· {msg.profession}</span>}
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm font-body ${isMe ? "bg-primary text-primary-foreground" : (bubbleClass ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-muted")}`}>
                {msg.message}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </CardContent>
  );
}

export default function TavernPage() {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [input, setInput] = useState("");
  const [privateInput, setPrivateInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingPrivate, setSendingPrivate] = useState(false);
  const [sleepPrice, setSleepPrice] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [foodOnMarket, setFoodOnMarket] = useState([]);
  const bottomRef = useRef(null);
  const privateBottomRef = useRef(null);

  const cityFatigueBonus = getCityFatigueBonus(homeCity?.buildings || []);
  const maxFatigue = profile ? getMaxFatigue(profile, cityFatigueBonus) : 40;
  const isResident = !!(profile && city && profile.home_city_id === city.id);

  useEffect(() => {
    if (!city?.id) return;
    const hasTavernBuilding = city.buildings?.some(b => b.building_type === "taverne");
    if (!hasTavernBuilding) return;

    base44.entities.MarketListing.filter({ city_id: city.id, status: "active" }).then(listings => {
      const foodNames = FOOD_ITEMS_WITH_FATIGUE.map(f => f.name);
      setFoodOnMarket(listings.filter(l =>
        l.item_category === "nourriture" &&
        foodNames.some(name => l.item_name === name || l.item_name?.includes(name))
      ));
    });

    setLoadingPrice(true);
    getTavernSleepPrice(city.id).then(price => {
      setSleepPrice(price);
      setLoadingPrice(false);
    });
  }, [city?.id]);

  useEffect(() => {
    if (!profile?.city_id) return;
    const cityId = profile.city_id;
    loadMessages(cityId);
    const interval = setInterval(() => loadMessages(cityId), 10000);
    return () => clearInterval(interval);
  }, [profile?.city_id]);

  async function loadMessages(cityId) {
    const cid = cityId || profile?.city_id;
    if (!cid) return;
    const all = await base44.entities.TavernMessage.filter(
      { city_id: cid },
      "created",
      100
    );
    setMessages(all.filter(m => !m.is_private && m.is_active !== false));
    setPrivateMessages(all.filter(m => m.is_private && m.is_active !== false));
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { privateBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [privateMessages]);

  const hasTavern = city?.buildings?.some(b => b.building_type === "taverne");

  const handleSleep = async () => {
    if (!profile || !sleepPrice) return;
    if (foodOnMarket.length > 0) {
      toast.error(`🍞 De la nourriture est disponible sur le marché (${foodOnMarket.map(f => f.item_name).join(", ")}). Achetez-en pour récupérer de l'énergie !`);
      return;
    }
    const { fatigue: currentFatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
    if (currentFatigue >= maxFatigue) { toast("⚡ Vous êtes déjà au maximum de votre énergie !"); return; }
    const today = getTodayStr();
    if (profile.tavern_sleep_date === today) { toast.error("😴 Vous avez déjà dormi à la taverne aujourd'hui."); return; }
    if ((profile.gold || 0) < sleepPrice.price) { toast.error(`💰 Pas assez d'or ! Il vous faut ${sleepPrice.price} pièces.`); return; }

    setSleeping(true);
    const fatigueRestored = Math.floor(maxFatigue * 0.5);
    const newFatigue = Math.min(maxFatigue, currentFatigue + fatigueRestored);
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - sleepPrice.price,
      fatigue: newFatigue,
      fatigue_last_reset: today,
      tavern_sleep_date: today,
    });

    // V6.1.7 — Trace dans le journal d'or (or détruit, side: none)
    if (sleepPrice.price > 0) {
      await logGold(
        profile.user_email, profile.character_name,
        profile.city_id, "",
        -sleepPrice.price, "taverne_repos",
        `Repos à la taverne (+${fatigueRestored}⚡)`
      );
    }
    toast.success(`🛌 Bonne nuit ! +${fatigueRestored}⚡ énergie (${newFatigue}/${maxFatigue})`);
    await refresh();
    setSleeping(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !profile || !hasTavern) return;
    if (input.trim().length > 300) { toast.error("Message trop long (300 caractères max)"); return; }
    setSending(true);
    await base44.entities.TavernMessage.create({
      city_id: profile.city_id,
      author_email: profile.user_email,
      author_name: profile.character_name,
      profession: profile.profession,
      message: input.trim(),
      is_private: false,
      is_active: true,
    });
    setInput("");
    setSending(false);
    await loadMessages(profile?.city_id);
  };

  const sendPrivateMessage = async () => {
    if (!privateInput.trim() || !profile || !hasTavern || !isResident) return;
    if (privateInput.trim().length > 300) { toast.error("Message trop long (300 caractères max)"); return; }
    setSendingPrivate(true);
    await base44.entities.TavernMessage.create({
      city_id: profile.city_id,
      author_email: profile.user_email,
      author_name: profile.character_name,
      profession: profile.profession,
      message: privateInput.trim(),
      is_private: true,
      is_active: true,
    });
    setPrivateInput("");
    setSendingPrivate(false);
    await loadMessages(profile?.city_id);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handlePrivateKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrivateMessage(); } };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!profile) return null;

  const { fatigue: currentFatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const today = getTodayStr();
  const alreadySleptToday = profile.tavern_sleep_date === today;


  // Bloquer si joueur en biome
  if (profile && !profile.is_traveling && profile.travel_destination_id?.startsWith("biome:")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <span className="text-5xl">🌿</span>
        <h2 className="font-heading text-xl font-semibold">Vous êtes dans un biome</h2>
        <p className="text-muted-foreground font-body text-sm max-w-xs">
          La taverne n'est pas accessible depuis un biome. Retournez en ville d'abord.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold heading-medieval">🍺 La Taverne</h2>
          <p className="text-muted-foreground font-body text-sm">
            {city ? `La taverne de ${city.name} : Échangez vos bons plans !` : "Taverne locale"}
          </p>
        </div>
        {hasTavern && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Ouverte</Badge>}
      </div>

      {!hasTavern ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="text-5xl">🏗️</div>
            <h3 className="font-heading text-lg font-semibold">Pas encore de taverne</h3>
            <p className="text-muted-foreground font-body text-sm max-w-sm mx-auto">
              Votre ville n'a pas encore de taverne. Contribuez aux objectifs de construction ou demandez à l'administrateur d'en construire une !
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Sleep section ── */}
          <Card className={foodOnMarket.length > 0 ? "border-orange-200" : "border-amber-200"}>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                🛌 Dormir à la taverne
                <span className="text-xs font-normal font-body text-muted-foreground">· récupère de l'énergie</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-body text-muted-foreground">Énergie actuelle :</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[160px]">
                  <div
                    className={`h-full rounded-full ${(currentFatigue / maxFatigue) > 0.6 ? "bg-green-500" : (currentFatigue / maxFatigue) > 0.3 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${(currentFatigue / maxFatigue) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{currentFatigue}/{maxFatigue}</span>
              </div>

              {foodOnMarket.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm font-body text-orange-800">
                  🍞 <strong>Nourriture disponible sur le marché</strong> : Achetez-en plutôt pour récupérer de l'énergie.
                  <div className="text-xs mt-1 text-orange-600">
                    En vente : {foodOnMarket.map(f => `${f.item_name} (${f.price_per_unit} or/u.)`).join(" · ")}
                  </div>
                </div>
              )}

              {loadingPrice ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Le tavernier fixe son prix...
                </div>
              ) : sleepPrice && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-amber-900">💤 Une nuit de repos</span>
                    <div className="flex items-center gap-3">
                      <span className="text-green-700 font-semibold">+{Math.floor(maxFatigue * 0.5)}⚡ (50%)</span>
                      <span className="font-bold text-amber-900">{sleepPrice.price} 💰</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 font-body italic">« {sleepPrice.reason} »</p>
                </div>
              )}

              {alreadySleptToday && (
                <p className="text-xs text-muted-foreground font-body">😴 Vous avez déjà dormi ici aujourd'hui. Revenez demain.</p>
              )}

              <Button
                onClick={handleSleep}
                disabled={sleeping || loadingPrice || !sleepPrice || alreadySleptToday || currentFatigue >= maxFatigue || (profile.gold || 0) < (sleepPrice?.price || 0) || foodOnMarket.length > 0}
                className="font-heading w-full"
                variant={foodOnMarket.length > 0 ? "outline" : "default"}
              >
                {sleeping ? "Vous dormez..." :
                  foodOnMarket.length > 0 ? "🚫 Nourriture dispo sur le marché" :
                  alreadySleptToday ? "😴 Déjà dormi aujourd'hui" :
                  currentFatigue >= maxFatigue ? "⚡ Énergie au maximum" :
                  sleepPrice ? `🛌 Dormir (${sleepPrice.price} 💰)` : "Chargement..."}
              </Button>
            </CardContent>
          </Card>

          {/* ── Chat section ── */}
          <Tabs defaultValue="grande-salle">
            <TabsList className="w-full">
              <TabsTrigger value="grande-salle" className="flex-1">🍺 Grande Salle</TabsTrigger>
              <TabsTrigger value="residents" className="flex-1 gap-1">
                <Lock className="h-3 w-3" />
                Résidents
                {!isResident && <span className="ml-1 text-xs opacity-60">(visiteur)</span>}
              </TabsTrigger>
              <TabsTrigger value="primes" className="flex-1">🏴‍☠️ Primes</TabsTrigger>
              <TabsTrigger value="classement" className="flex-1">🏆 Classement</TabsTrigger>
            </TabsList>

            {/* Public chat */}
            <TabsContent value="grande-salle">
              <Card className="flex flex-col" style={{ height: "55vh", minHeight: 360 }}>
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="font-heading text-base flex items-center gap-2">
                    🍺 Grande Salle : {city?.name}
                    <span className="text-xs text-muted-foreground font-body font-normal">Résidents & Visiteurs</span>
                  </CardTitle>
                </CardHeader>
                <ChatMessages
                  messages={messages}
                  profile={profile}
                  bottomRef={bottomRef}
                  emptyText="Personne n'a encore parlé ici... Soyez le premier ! 🍻"
                />
                <div className="border-t border-border p-3 flex gap-2">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Partagez vos bons plans... (Enter pour envoyer)"
                    className="font-body"
                    maxLength={300}
                  />
                  <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon" className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* Private residents chat */}
            <TabsContent value="residents">
              <Card className="flex flex-col" style={{ height: "55vh", minHeight: 360 }}>
                <CardHeader className="pb-2 border-b border-amber-200 bg-amber-50 rounded-t-xl">
                  <CardTitle className="font-heading text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-700" />
                    Salle des Résidents
                    <span className="text-xs text-amber-700 font-body font-normal">· habitants de {city?.name} uniquement</span>
                  </CardTitle>
                </CardHeader>
                {!isResident ? (
                  <CardContent className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2 py-8">
                      <div className="text-4xl">🔒</div>
                      <p className="font-heading font-semibold">Accès réservé aux résidents</p>
                      <p className="text-sm text-muted-foreground font-body">
                        Vous êtes en visite. Seuls les habitants permanents de {city?.name} peuvent accéder à cette salle.
                      </p>
                    </div>
                  </CardContent>
                ) : (
                  <>
                    <ChatMessages
                      messages={privateMessages}
                      profile={profile}
                      bottomRef={privateBottomRef}
                      emptyText="🔒 La salle des résidents est silencieuse... Parlez en toute discrétion."
                      bubbleClass="bg-amber-100"
                    />
                    <div className="border-t border-amber-200 p-3 flex gap-2">
                      <Input
                        value={privateInput}
                        onChange={e => setPrivateInput(e.target.value)}
                        onKeyDown={handlePrivateKey}
                        placeholder="Message privé aux résidents... (Enter pour envoyer)"
                        className="font-body"
                        maxLength={300}
                      />
                      <Button onClick={sendPrivateMessage} disabled={sendingPrivate || !privateInput.trim()} size="icon" className="shrink-0 bg-amber-600 hover:bg-amber-700">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="primes">
              <BountyBoard profile={profile} cityId={city?.id} cityName={city?.name} />
            </TabsContent>
            <TabsContent value="classement" className="mt-2">
              <PlayerRanking />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Tips */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-heading font-semibold text-sm mb-2">💡 Règles de la taverne</h3>
          <ul className="text-xs text-muted-foreground font-body space-y-1">
            <li>• Partagez les prix du marché, vos stratégies de farming et de crafting.</li>
            <li>• Signalez les bonnes affaires et les ressources rares en stock.</li>
            <li>• Le langage respectueux est de rigueur : les grossièretés sont filtrées automatiquement.</li>
            <li>• La taverne est locale à votre ville actuelle.</li>
            <li>• 🔒 La Salle des Résidents est réservée aux habitants permanents de la ville.</li>
            <li>• 🛌 Dormir à la taverne récupère de l'énergie, mais seulement si aucune nourriture n'est dispo sur le marché.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}