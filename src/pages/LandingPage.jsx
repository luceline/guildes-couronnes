import { useAuth } from "@/lib/AuthContext";
import { DISCORD_INVITE_URL } from "@/lib/links";

export default function LandingPage() {
  const { navigateToLogin } = useAuth();

  return (
    <div style={{ background: "#0e0b05", minHeight: "100vh", fontFamily: "Georgia, serif", color: "#f5e6c0", overflowX: "hidden" }}>


    {/* ── Bannière PWA installation ── */}
    <div style={{ background: "#c9a44a", padding: "0.6rem 1rem", textAlign: "center", position: "sticky", top: 0, zIndex: 100 }}>
      <p style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 600, color: "#0e0b05", margin: 0, letterSpacing: 0.5 }}>
        📲 Installez le jeu sur votre appareil : Chrome/Edge : icône ⊕ dans la barre d'adresse · Safari iOS : Partager ↑ → "Sur l'écran d'accueil"
      </p>
    </div>

      {/* HERO */}
      <div style={{ position: "relative", minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3.5rem 1rem 2rem", overflow: "hidden", background: "#0e0b05" }}>
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 10 }}>
          <button style={{ padding: "0.5rem 1rem", background: "#5865F2", color: "#ffffff", border: "none", borderRadius: "0.375rem", fontFamily: "sans-serif", fontSize: "clamp(10px, 2vw, 12px)", fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", transition: "opacity 0.2s", display: "inline-flex", alignItems: "center", gap: "0.4rem" }} onMouseEnter={e => e.currentTarget.style.opacity = 0.85} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Discord
          </button>
        </a>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 90%, #3d2a0a 0%, #1a1208 50%, #0e0b05 100%)", zIndex: 0 }} />

        {/* Skyline */}
        <svg style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1 }} viewBox="0 0 800 110" preserveAspectRatio="xMidYMax meet">
          <rect x="0" y="75" width="800" height="40" fill="#0e0b05"/>
          <rect x="20" y="55" width="30" height="55" fill="#1a1208"/><rect x="55" y="65" width="20" height="45" fill="#1a1208"/>
          <rect x="80" y="45" width="15" height="65" fill="#1a1208"/><rect x="100" y="60" width="25" height="50" fill="#1a1208"/>
          <rect x="130" y="40" width="18" height="70" fill="#1a1208"/>
          <rect x="160" y="25" width="22" height="85" fill="#1a1208"/>
          <polygon points="171,8 160,25 182,25" fill="#1a1208"/>
          <rect x="183" y="55" width="20" height="55" fill="#1a1208"/><rect x="205" y="60" width="15" height="50" fill="#1a1208"/>
          <rect x="225" y="45" width="25" height="65" fill="#1a1208"/>
          <rect x="260" y="15" width="25" height="95" fill="#1a1208"/>
          <rect x="288" y="30" width="50" height="80" fill="#1a1208"/>
          <rect x="341" y="15" width="25" height="95" fill="#1a1208"/>
          <rect x="258" y="10" width="9" height="9" fill="#1a1208"/><rect x="269" y="10" width="9" height="9" fill="#1a1208"/>
          <rect x="339" y="10" width="9" height="9" fill="#1a1208"/><rect x="350" y="10" width="9" height="9" fill="#1a1208"/>
          <rect x="290" y="23" width="9" height="9" fill="#1a1208"/><rect x="301" y="23" width="9" height="9" fill="#1a1208"/>
          <rect x="318" y="23" width="9" height="9" fill="#1a1208"/><rect x="329" y="23" width="9" height="9" fill="#1a1208"/>
          <rect x="295" y="50" width="7" height="5" fill="#c9a44a44"/><rect x="308" y="50" width="7" height="5" fill="#c9a44a44"/>
          <rect x="375" y="50" width="28" height="60" fill="#1a1208"/><rect x="408" y="40" width="20" height="70" fill="#1a1208"/>
          <rect x="432" y="55" width="30" height="55" fill="#1a1208"/><rect x="465" y="35" width="18" height="75" fill="#1a1208"/>
          <rect x="490" y="45" width="20" height="65" fill="#1a1208"/>
          <rect x="515" y="55" width="25" height="55" fill="#1a1208"/><rect x="545" y="45" width="20" height="65" fill="#1a1208"/>
          <rect x="570" y="60" width="30" height="50" fill="#1a1208"/><rect x="605" y="40" width="22" height="70" fill="#1a1208"/>
          <rect x="632" y="50" width="28" height="60" fill="#1a1208"/><rect x="665" y="38" width="18" height="72" fill="#1a1208"/>
          <rect x="690" y="55" width="25" height="55" fill="#1a1208"/><rect x="720" y="45" width="30" height="65" fill="#1a1208"/>
          <rect x="755" y="60" width="40" height="50" fill="#1a1208"/>
          <rect x="167" y="50" width="6" height="5" fill="#c9a44a44"/><rect x="175" y="50" width="6" height="5" fill="#c9a44a44"/>
        </svg>

        <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
          <p style={{ fontFamily: "sans-serif", fontSize: 13, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", marginBottom: "1rem" }}>
            Chroniques du royaume : monde persistant multijoueur
          </p>
          <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4rem)", fontWeight: 400, lineHeight: 1.1, color: "#f5e6c0", letterSpacing: 2, marginBottom: "0.5rem", textShadow: "0 0 40px rgba(201,164,74,0.3)" }}>
            <span style={{ color: "#c9a44a" }}>Guildes</span> & <span style={{ color: "#c9a44a" }}>Couronnes</span>
          </h1>
          <p style={{ fontSize: "1.2rem", color: "#a89070", fontStyle: "italic", marginBottom: "2rem", letterSpacing: 0.5 }}>
            Forgez votre destin. Bâtissez votre cité. Écrivez votre légende.
          </p>
          <button
            onClick={navigateToLogin}
            style={{ padding: "0.7rem 2.5rem", background: "#c9a44a", color: "#0e0b05", border: "none", fontFamily: "sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", transition: "opacity 0.2s" }}
            onMouseEnter={e => e.target.style.opacity = 0.85}
            onMouseLeave={e => e.target.style.opacity = 1}
          >
            Rejoindre le royaume
          </button>
          <p style={{ marginTop: "0.8rem", fontSize: 11, color: "#7a6648", fontFamily: "sans-serif", letterSpacing: 1 }}>
            Inscription gratuite · Monde persistant · L'aurore renouvelle tout
          </p>
        </div>
      </div>

      {/* SCROLL STRIP */}
      <div style={{ background: "#c9a44a", padding: "0.45rem 0", overflow: "hidden", whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-block", animation: "scrollLeft 32s linear infinite", fontFamily: "sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: 2, color: "#0e0b05" }}>
          &nbsp;&nbsp;&nbsp;⚒ BÂTISSEZ VOTRE CITÉ &nbsp;·&nbsp; 💰 COMMERCEZ SUR LES MARCHÉS &nbsp;·&nbsp; 🏰 BRIGUEZ LA MAIRIE &nbsp;·&nbsp; 🌿 EXPLOREZ LES TERRES SAUVAGES &nbsp;·&nbsp; 🗡 SABOTEZ VOS RIVAUX &nbsp;·&nbsp; ⚔️ DÉCLAREZ LA GUERRE &nbsp;·&nbsp; 🐴 LANCEZ VOS ARMÉES &nbsp;·&nbsp; 🎯 ACCOMPLISSEZ VOS QUÊTES &nbsp;·&nbsp; 👑 NOMMEZ VOS OFFICIERS &nbsp;·&nbsp; 📊 TABLEAU DE BORD MAIRE &nbsp;·&nbsp; 📈 DU NOVICE AU LÉGENDAIRE &nbsp;·&nbsp; 🏛 ÉRIGEZ UN PALAIS &nbsp;&nbsp;&nbsp;⚒ BÂTISSEZ VOTRE CITÉ &nbsp;·&nbsp; 💰 COMMERCEZ SUR LES MARCHÉS &nbsp;·&nbsp; 🏰 BRIGUEZ LA MAIRIE &nbsp;·&nbsp; 🌿 EXPLOREZ LES TERRES SAUVAGES &nbsp;·&nbsp; 🗡 SABOTEZ VOS RIVAUX &nbsp;·&nbsp; ⚔️ DÉCLAREZ LA GUERRE &nbsp;·&nbsp; 🐴 LANCEZ VOS ARMÉES &nbsp;·&nbsp; 🎯 ACCOMPLISSEZ VOS QUÊTES &nbsp;·&nbsp; 👑 NOMMEZ VOS OFFICIERS &nbsp;·&nbsp; 📊 TABLEAU DE BORD MAIRE &nbsp;·&nbsp; 📈 DU NOVICE AU LÉGENDAIRE &nbsp;·&nbsp; 🏛 ÉRIGEZ UN PALAIS &nbsp;&nbsp;&nbsp;
        </span>
      </div>

      {/* FEATURES */}
      <div style={{ padding: "4rem 2rem 3rem", maxWidth: 1000, margin: "0 auto" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Ce que racontent les voyageurs</p>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "2rem", letterSpacing: 1 }}>Tout un monde à bâtir et à défendre</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2, background: "#3d2a0a44", border: "1px solid #3d2a0a" }}>
          {[
            { icon: "🏗️", name: "Construire & Entretenir", desc: "Scieries, mines, forges, cathédrales, palais… Chaque bâtiment réclame son tribut en matériaux chaque nuit. Chaque résident consomme aussi une ressource brute par jour. Négligez l'entrepôt, et vos bâtiments s'effondrent à l'aurore." },
            { icon: "⚖️", name: "Marchés & Taxes", desc: "Vendez et achetez librement. Les taxes s'accumulent en silence tout au long du jour et sont prélevées par chaque mairie à l'aurore, ville par ville, sans exception." },
            { icon: "🌿", name: "Terres sauvages & Bénédictions", desc: "Affrontez les créatures de six contrées. Chaque victoire rapporte de l'or et parfois un trésor rare. Combattez dans votre biome de métier pour recevoir une bénédiction d'une heure sur votre production." },
            { icon: "📈", name: "Titres & Renommée personnelle", desc: "Montez du rang de novice jusqu'à celui de légende. Chaque titre gagné vous rend plus rapide et plus chanceux à la production. Ces bienfaits se cumulent avec ceux de votre cité et des biomes." },
            { icon: "👑", name: "Gouvernance & Officiers", desc: "Le maire règne dix jours et peut nommer trois officiers parmi ses résidents : Percepteur, Chef de guerre, Acheteur. Chacun accède aux fonctions qui lui sont confiées. Un tableau de bord complet lui donne une vue sur toute la vie économique de la cité." },
            { icon: "⚔️", name: "Guerres & Pillages", desc: "Recrutez des guerriers, formez une armée, marchez sur les villes voisines. Brisez leur garnison, pillez leurs réserves, et volez leurs lingots royaux pour freiner leur ascension." },
          ].map(f => (
            <div key={f.name} style={{ background: "#120e06", padding: "1.4rem 1.2rem", borderBottom: "1px solid #3d2a0a22" }}>
              <span style={{ fontSize: 22, display: "block", marginBottom: "0.65rem" }}>{f.icon}</span>
              <p style={{ fontFamily: "sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.35rem" }}>{f.name}</p>
              <p style={{ fontSize: 14, color: "#b8956b", lineHeight: 1.6, fontStyle: "italic" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CITY LOOP */}
      <div style={{ padding: "4rem 2rem 3.5rem", background: "#0a0804" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Le récit d'une journée</p>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "0.4rem", letterSpacing: 1 }}>La vie d'un citoyen</h2>
        <p style={{ fontSize: 14, color: "#a89070", fontStyle: "italic", textAlign: "center", marginBottom: "2rem", maxWidth: 700, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Produire → Vendre → Explorer les terres sauvages → Accomplir ses quêtes → Livrer des lingots → Bâtir → Lever des soldats → Marcher sur les voisins → Monter en gloire → Frapper dans l'ombre
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 2, background: "#3d2a0a44", border: "1px solid #3d2a0a", maxWidth: 1000, margin: "0 auto" }}>
          {[
            { step: "01", icon: "⚡", title: "Produire & transformer", desc: "Récoltez vos matières premières, transformez-les. Gardez planches, fil et pierre taillée en poche pour leurs bienfaits passifs. Vos outils ont trois usages, sans eux tout prend deux fois plus de temps." },
            { step: "02", icon: "🌿", title: "Terres sauvages & Titres", desc: "Parcourez les six contrées pour récolter des trésors rares. Consommez-les pour gagner en renommée. Chaque titre supplémentaire vous accélère et dédouble parfois votre récolte. Consommez un T1 pendant la bénédiction pour cinq minutes de bonus récolte en plus." },
            { step: "03", icon: "🏗️", title: "Alimenter l'entrepôt communautaire", desc: "Déposez vos matériaux transformés à l'entrepôt. L'entretien des bâtiments, des soldats et la consommation des résidents le vident chaque nuit. Le maire voit les jours d'autonomie restants en temps réel dans son tableau de bord." },
            { step: "04", icon: "👑", title: "Gouverner & Déléguer", desc: "Si vous êtes maire, nommez vos officiers depuis l'onglet Habitants. Suivez la trésorerie et les stocks critiques dans votre tableau de bord. Un Percepteur peut gérer les taxes à votre place, un Chef de guerre les campagnes militaires." },
          ].map(f => (
            <div key={f.step} style={{ background: "#120e06", padding: "1.4rem 1.2rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span style={{ fontFamily: "sans-serif", fontSize: 10, fontWeight: 700, color: "#c9a44a44", letterSpacing: 2, marginTop: 3, flexShrink: 0 }}>{f.step}</span>
              <div>
                <p style={{ fontFamily: "sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.35rem" }}>{f.icon} {f.title}</p>
                <p style={{ fontSize: 14, color: "#b8956b", lineHeight: 1.6, fontStyle: "italic" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#7a6648", fontStyle: "italic", marginTop: "2rem", fontFamily: "sans-serif", letterSpacing: 1, maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
          Trois gloires à conquérir : la cité (Hameau → Empire), la renommée personnelle (Novice → Légendaire), la puissance militaire (garnison, victoires, lingots pillés). Et un tableau de bord pour tout voir d'un coup d'oeil.
        </p>
      </div>

      {/* BIOMES & EVENTS */}
      <div style={{ padding: "3rem 2rem", background: "#0e0b05", borderTop: "1px solid #3d2a0a" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Au-delà des murailles</p>
        <h2 style={{ fontSize: "1.7rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "1.5rem", letterSpacing: 1 }}>Les six contrées sauvages</h2>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1rem", maxWidth: 900, margin: "0 auto" }}>
          {[
            { icon: "🌲", name: "La Forêt", desc: "Des créatures rôdent sous les frondaisons. Pierre rare et bois rare en tombent parfois. La maîtrise du lieu vous ouvre des bienfaits permanents." },
            { icon: "🌾", name: "Les Champs", desc: "Affrontez les créatures rurales pour glaner or rare et blé rare. Montez la maîtrise pour débloquer des privilèges personnels." },
            { icon: "⛏️", name: "La Mine", desc: "Plongez dans les galeries obscures. Charbon rare et minerai rare vous y attendent. Chaque victoire forge votre renommée personnelle." },
            { icon: "🧵", name: "L'Atelier", desc: "Défiez les artisans des profondeurs. Fil rare et tissu rare. Convertissez-les en renommée ou vendez-les au marché : à vous de choisir." },
            { icon: "🔥", name: "La Forge", desc: "Duel contre les maîtres forgerons. Fer rare et lingots rares. La maîtrise de ce lieu donne accès aux bienfaits du combattant." },
            { icon: "🏛️", name: "La Guilde", desc: "Relevez les défis de la guilde. Parchemins rares et contrats rares. Certains combats déverrouillent des effets que nul ne peut prévoir." },
          ].map(e => (
            <div key={e.name} style={{ background: "#120e06", border: "1px solid #3d2a0a", padding: "1.2rem", width: 200, flexShrink: 0 }}>
              <span style={{ fontSize: 24, display: "block", marginBottom: "0.5rem" }}>{e.icon}</span>
              <p style={{ fontFamily: "sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.3rem" }}>{e.name}</p>
              <p style={{ fontSize: 13, color: "#b8956b", lineHeight: 1.5, fontStyle: "italic" }}>{e.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#7a6648", fontStyle: "italic", marginTop: "1.5rem", fontFamily: "sans-serif" }}>
          Cinq combats par jour, six si votre cité est un bourg. Les trésors rares forgent votre renommée : ou s'échangent contre de l'or. Double fortune !
        </p>
      </div>

      {/* PROFESSIONS */}
      <div style={{ padding: "1.5rem 1.5rem 2.5rem", background: "#0a0804" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "1rem" }}>Choisissez votre destine</p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.6rem", maxWidth: 600, margin: "0 auto" }}>
          {["🏪 Marchand", "⛏️ Mineur", "🪓 Bûcheron", "🐄 Fermier", "⚗️ Alchimiste", "🧵 Tisserand", "🔨 Forgeron", "🏅 Orfèvre"].map(p => (
            <span key={p} style={{ padding: "0.35rem 0.9rem", border: "1px solid #3d2a0a", background: "#1a1208", fontFamily: "sans-serif", fontSize: 12, color: "#c9a44a", letterSpacing: 1 }}>{p}</span>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 14, color: "#a89070", fontStyle: "italic", marginTop: "1.2rem", maxWidth: 440, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Chaque métier tient une place dans la chaîne du labeur. Sans le Mineur, les forges s'éteignent. Sans le Fermier, les ventres crient. Le Forgeron fabrique les outils qui accélèrent tout le monde : sans eux, les délais doublent. Et votre renommée personnelle ? Elle amplifie tout ce que vous faites.
        </p>
      </div>

      {/* DIPLOMACY & SPY */}
      <div style={{ borderTop: "1px solid #3d2a0a", borderBottom: "1px solid #3d2a0a", padding: "4rem 2rem" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Alliances & Trahisons</p>
        <h2 style={{ fontSize: "1.7rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "0.4rem", letterSpacing: 1 }}>La guerre se gagne aussi dans l'ombre</h2>
        <p style={{ fontSize: 15, color: "#a89070", fontStyle: "italic", textAlign: "center", marginBottom: "2rem", maxWidth: 650, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Chaque maître artisan peut forger un objet de nuisance. Les coups frappent à minuit. Une seule attaque par cité par jour. Le Contrat noble annule le prochain coup ennemi. Le Fermier reste indispensable : sans lui, les ventres ne se remplissent jamais assez vite.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2.5rem", maxWidth: 1000, margin: "0 auto" }}>
          <div>
            <p style={{ fontFamily: "sans-serif", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid #3d2a0a" }}>🗝️ Sabotage</p>
            {[
              { icon: "🔥", name: "Huile inflammable", desc: "Détruit un bâtiment de la cité adverse dans les flammes." },
              { icon: "💥", name: "Poudre corrosive", desc: "Ravage quatre-vingts pour cent d'une ressource dans leurs réserves." },
              { icon: "🍖", name: "Festin empoisonné", desc: "Les habitants adverses peinent à se nourrir pendant deux jours." },
              { icon: "📄", name: "Faux contrat", desc: "Les routes restent inconnues aux voyageurs ennemis pendant deux jours." },
            ].map(a => (
              <div key={a.name} style={{ display: "flex", gap: "0.75rem", padding: "0.55rem 0", borderBottom: "1px solid #3d2a0a22" }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 2 }}>{a.icon}</span>
                <div>
                  <span style={{ fontFamily: "sans-serif", fontSize: 11, color: "#f5e6c0", display: "block", marginBottom: 2 }}>{a.name}</span>
                  <span style={{ fontSize: 13, color: "#a89070", lineHeight: 1.5 }}>{a.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontFamily: "sans-serif", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid #3d2a0a" }}>💰 Vol & Influence</p>
            {[
              { icon: "🗝️", name: "Clé forgée", desc: "Dérobe vingt pour cent des lingots royaux stockés à leur mairie." },
              { icon: "☠️", name: "Élixir de discorde", desc: "Les taxes de la cité cible sont détournées vers votre ville pendant deux jours." },
              { icon: "✉️", name: "Lettre de désinformation", desc: "Alourdit les taxes de la ville cible de trente pour cent pendant deux jours." },
            ].map(a => (
              <div key={a.name} style={{ display: "flex", gap: "0.75rem", padding: "0.55rem 0", borderBottom: "1px solid #3d2a0a22" }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 2 }}>{a.icon}</span>
                <div>
                  <span style={{ fontFamily: "sans-serif", fontSize: 11, color: "#f5e6c0", display: "block", marginBottom: 2 }}>{a.name}</span>
                  <span style={{ fontSize: 13, color: "#a89070", lineHeight: 1.5 }}>{a.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontFamily: "sans-serif", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid #3d2a0a" }}>🛡️ Défense</p>
            {[
              { icon: "📜", name: "Contrat noble", desc: "Annule le prochain coup individuel ennemi sur votre cité." },
              { icon: "🏰", name: "Bâtiments défensifs", desc: "Sept ouvrages bloquent chacun un type d'attaque. Détruits après usage, sans entretien quotidien." },
              { icon: "🏵️", name: "Sceau royal", desc: "Absorbe taxes et impôts jusqu'à cent dix pièces d'or. S'achète à la mairie pour cent pièces." },
            ].map(a => (
              <div key={a.name} style={{ display: "flex", gap: "0.75rem", padding: "0.55rem 0", borderBottom: "1px solid #3d2a0a22" }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 2 }}>{a.icon}</span>
                <div>
                  <span style={{ fontFamily: "sans-serif", fontSize: 11, color: "#f5e6c0", display: "block", marginBottom: 2 }}>{a.name}</span>
                  <span style={{ fontSize: 13, color: "#a89070", lineHeight: 1.5 }}>{a.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MILITARY */}
      <div style={{ padding: "4rem 2rem", background: "#0a0804", borderTop: "1px solid #3d2a0a" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Conquête & Guerre</p>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "0.4rem", letterSpacing: 1 }}>Sonnez le tocsin</h2>
        <p style={{ fontSize: 14, color: "#a89070", fontStyle: "italic", textAlign: "center", marginBottom: "2rem", maxWidth: 650, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Levez vos soldats, formez votre armée, marchez sur les cités voisines. Brisez leur garnison, pillez leurs réserves, volez leurs lingots royaux pour freiner leur montée en gloire.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 2, background: "#3d2a0a44", border: "1px solid #3d2a0a", maxWidth: 1000, margin: "0 auto" }}>
          {[
            { icon: "🗡️", name: "Six types de guerriers", desc: "Milicien, Archer, Fantassin, Cavalier, Catapulte, Chevalier. Chacun a ses forces et ses faiblesses. Les archers transpercent la cavalerie. La catapulte réduit la défense adverse de trente pour cent." },
            { icon: "⚔️", name: "La marche des armées", desc: "Le maire déclare l'attaque. Trente minutes pour que les résidents contribuent leurs unités. L'armée marche selon les routes. Le combat se règle seul à l'arrivée. Les survivants rentrent à la garnison." },
            { icon: "🪙", name: "Le pillage stratégique", desc: "Victoire : réserves saisies et lingots royaux volés. Voler des lingots ralentit directement la progression de palier adverse. C'est là l'objectif véritable d'une guerre." },
            { icon: "🛡️", name: "La garnison vulnérable", desc: "Les unités parties en campagne quittent la garnison sur le champ. Si votre cité est attaquée pendant ce temps, vous défendez avec ce qui reste. La ruse prime sur la force brute." },
          ].map(f => (
            <div key={f.name} style={{ background: "#120e06", padding: "1.4rem 1.2rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
              <div>
                <p style={{ fontFamily: "sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.35rem" }}>{f.name}</p>
                <p style={{ fontSize: 14, color: "#b8956b", lineHeight: 1.6, fontStyle: "italic" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <p style={{ fontFamily: "sans-serif", fontSize: 11, letterSpacing: 2, color: "#7a6648", fontStyle: "italic" }}>
            Issues possibles : Déroute · Défaite · Victoire courte · Victoire · Victoire nette · Victoire écrasante
          </p>
          <p style={{ fontSize: 13, color: "#c9a44a44", fontFamily: "sans-serif", marginTop: "0.5rem" }}>
            Même les vaincus gagnent renommée et or : contribuez toujours
          </p>
        </div>
      </div>

      {/* STAKES */}
      <div style={{ padding: "4rem 2rem", maxWidth: 950, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.5rem" }}>Les lois du monde</p>
        <h2 style={{ fontSize: "1.7rem", fontWeight: 400, color: "#f5e6c0", marginBottom: "2rem", letterSpacing: 1 }}>Chaque décision a un prix</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2, background: "#3d2a0a44", border: "1px solid #3d2a0a" }}>
          {[
            { icon: "🏚️", title: "Les bâtiments s'effondrent", body: "Sans matériaux dans l'entrepôt, les bâtiments tombent chaque nuit. Planches, farine, fil, extrait, pain : approvisionnez avant l'aurore." },
            { icon: "⚖️", title: "Les taxes arrivent à l'aube", body: "Vos achats au marché accumulent des taxes tout le jour. Au matin, chaque mairie vient réclamer son dû sur votre or, une par une." },
            { icon: "💸", title: "L'impôt impayé ruine", body: "Si votre bourse est vide au moment du prélèvement, vos biens sont saisis : inventaire vide, faim et forces à zéro." },
            { icon: "🍞", title: "La faim paralyse", body: "Sous trois de faim, chaque action coûte un souffle supplémentaire. À zéro, impossible de travailler. La faim remonte seule, lentement. Pain et ragoût accélèrent le retour." },
            { icon: "🏖️", title: "Le repos du voyageur", body: "Absent quelques jours ? Déclarez votre retraite : quinze jours au plus : pour suspendre impôts et toute conséquence de l'absence." },
            { icon: "💤", title: "L'oubli efface les noms", body: "Sept jours sans passage : un avertissement vous parvient. À neuf jours : votre personnage est rayé des chroniques. Revenez, ou déclarez votre repos !" },
          ].map(s => (
            <div key={s.title} style={{ background: "#120e06", padding: "1.25rem 1rem" }}>
              <span style={{ fontSize: 22, display: "block", marginBottom: "0.5rem" }}>{s.icon}</span>
              <p style={{ fontFamily: "sans-serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.4rem" }}>{s.title}</p>
              <p style={{ fontSize: 13, color: "#a89070", lineHeight: 1.6, fontStyle: "italic" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER CTA */}
      <div style={{ background: "#0a0804", borderTop: "1px solid #3d2a0a", padding: "4rem 2rem", textAlign: "center" }}>
        <div style={{ width: 40, height: 1, background: "#c9a44a44", margin: "0 auto 2rem" }} />
        <h2 style={{ fontSize: "2.1rem", fontWeight: 400, color: "#f5e6c0", marginBottom: "0.5rem", letterSpacing: 2 }}>Votre légende commence ici</h2>
        <p style={{ fontSize: 15, color: "#a89070", fontStyle: "italic", marginBottom: "2.5rem" }}>Bâtissez une cité. Parcourez les terres sauvages. Levez une armée. Gravissez tous les rangs jusqu'à la légende. Devenez une figure que les chroniques n'oublieront pas.</p>
        <button
          onClick={navigateToLogin}
          style={{ padding: "0.75rem 2.5rem", background: "#c9a44a", color: "#0e0b05", border: "none", fontFamily: "sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }}
          onMouseEnter={e => e.target.style.opacity = 0.85}
          onMouseLeave={e => e.target.style.opacity = 1}
        >
          Rejoindre le royaume
        </button>
        <div style={{ width: 40, height: 1, background: "#c9a44a44", margin: "2rem auto 0" }} />
        <p style={{ fontSize: 11, color: "#7a6648", fontFamily: "sans-serif", letterSpacing: 1, marginTop: "1rem" }}>
          Inscription gratuite · Monde persistant · L'aurore renouvelle tout
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#5865F2", textDecoration: "none", fontSize: 12, fontFamily: "sans-serif", letterSpacing: 1, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Rejoindre le Discord
          </a>
        </p>
      </div>


      {/* ── PWA Install ── */}
      <div style={{ background: "#0a0804", borderTop: "1px solid #3d2a0a", padding: "3rem 2rem", textAlign: "center" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.5rem" }}>Jouer comme une application</p>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 400, color: "#f5e6c0", marginBottom: "1.5rem", letterSpacing: 1 }}>Installer sur votre appareil</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", maxWidth: 800, margin: "0 auto", textAlign: "left" }}>
          <div style={{ background: "#120e06", border: "1px solid #3d2a0a", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <p style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.75rem" }}>🖥️ PC / Mac (Chrome ou Edge)</p>
            <ol style={{ color: "#b8956b", fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.8, paddingLeft: "1.2rem", margin: 0 }}>
              <li>Ouvrez le site dans Chrome ou Edge</li>
              <li>Cliquez sur l'icône <strong style={{ color: "#f5e6c0" }}>⊕</strong> dans la barre d'adresse</li>
              <li>Cliquez sur <strong style={{ color: "#f5e6c0" }}>"Installer"</strong></li>
              <li>Le jeu s'ouvre comme une application !</li>
            </ol>
          </div>
          <div style={{ background: "#120e06", border: "1px solid #3d2a0a", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <p style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.75rem" }}>🤖 Android (Chrome)</p>
            <ol style={{ color: "#b8956b", fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.8, paddingLeft: "1.2rem", margin: 0 }}>
              <li>Ouvrez le site dans Chrome</li>
              <li>Appuyez sur le menu <strong style={{ color: "#f5e6c0" }}>⋮</strong> en haut à droite</li>
              <li>Choisissez <strong style={{ color: "#f5e6c0" }}>"Ajouter à l'écran d'accueil"</strong></li>
              <li>Confirmez : l'icône apparaît sur votre écran !</li>
            </ol>
          </div>
          <div style={{ background: "#120e06", border: "1px solid #3d2a0a", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <p style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.75rem" }}>🍎 iPhone / iPad (Safari)</p>
            <ol style={{ color: "#b8956b", fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.8, paddingLeft: "1.2rem", margin: 0 }}>
              <li>Ouvrez le site dans <strong style={{ color: "#f5e6c0" }}>Safari</strong></li>
              <li>Appuyez sur le bouton <strong style={{ color: "#f5e6c0" }}>Partager ↑</strong></li>
              <li>Choisissez <strong style={{ color: "#f5e6c0" }}>"Sur l'écran d'accueil"</strong></li>
              <li>Confirmez : l'icône apparaît sur votre écran !</li>
            </ol>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scrollLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
