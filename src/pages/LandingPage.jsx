import { useAuth } from "@/lib/AuthContext";

export default function LandingPage() {
  const { navigateToLogin } = useAuth();

  return (
    <div style={{ background: "#0e0b05", minHeight: "100vh", fontFamily: "Georgia, serif", color: "#f5e6c0", overflowX: "hidden" }}>

      {/* HERO */}
      <div style={{ position: "relative", minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3.5rem 1rem 2rem", overflow: "hidden", background: "#0e0b05" }}>
        <a href="https://fr.tipeee.com/guildes-couronnes/" target="_blank" rel="noopener noreferrer" style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 10 }}>
          <button style={{ padding: "0.5rem 1rem", background: "#c9a44a", color: "#0e0b05", border: "none", borderRadius: "0.375rem", fontFamily: "sans-serif", fontSize: "clamp(10px, 2vw, 12px)", fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", transition: "opacity 0.2s" }} onMouseEnter={e => e.target.style.opacity = 0.85} onMouseLeave={e => e.target.style.opacity = 1}>
            💛 Soutenir
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
            Chroniques du royaume — monde persistant multijoueur
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
          &nbsp;&nbsp;&nbsp;⚒ BÂTISSEZ VOTRE CITÉ &nbsp;·&nbsp; 💰 COMMERCEZ SUR LES MARCHÉS &nbsp;·&nbsp; 🏰 BRIGUÉ LA MAIRIE &nbsp;·&nbsp; 🌿 EXPLOREZ LES TERRES SAUVAGES &nbsp;·&nbsp; 🗡 SABOTEZ VOS RIVAUX &nbsp;·&nbsp; ⚔️ DÉCLAREZ LA GUERRE &nbsp;·&nbsp; 🐴 LANCEZ VOS ARMÉES &nbsp;·&nbsp; ⚓ ROUTES MARITIMES &nbsp;·&nbsp; 🎯 ACCOMPLISSEZ VOS QUÊTES &nbsp;·&nbsp; 📈 DU NOVICE AU LÉGENDAIRE &nbsp;·&nbsp; 🏛 ÉRIGEZ UN PALAIS &nbsp;&nbsp;&nbsp;⚒ BÂTISSEZ VOTRE CITÉ &nbsp;·&nbsp; 💰 COMMERCEZ SUR LES MARCHÉS &nbsp;·&nbsp; 🏰 BRIGUEZ LA MAIRIE &nbsp;·&nbsp; 🌿 EXPLOREZ LES TERRES SAUVAGES &nbsp;·&nbsp; 🗡 SABOTEZ VOS RIVAUX &nbsp;·&nbsp; ⚔️ DÉCLAREZ LA GUERRE &nbsp;·&nbsp; 🐴 LANCEZ VOS ARMÉES &nbsp;·&nbsp; ⚓ ROUTES MARITIMES &nbsp;·&nbsp; 🎯 ACCOMPLISSEZ VOS QUÊTES &nbsp;·&nbsp; 📈 DU NOVICE AU LÉGENDAIRE &nbsp;·&nbsp; 🏛 ÉRIGEZ UN PALAIS &nbsp;&nbsp;&nbsp;
        </span>
      </div>

      {/* FEATURES */}
      <div style={{ padding: "4rem 2rem 3rem", maxWidth: 1000, margin: "0 auto" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Ce que racontent les voyageurs</p>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "2rem", letterSpacing: 1 }}>Tout un monde à bâtir et à défendre</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2, background: "#3d2a0a44", border: "1px solid #3d2a0a" }}>
          {[
            { icon: "🏗️", name: "Construire & Entretenir", desc: "Scieries, mines, forges, cathédrales, palais… Chaque bâtiment réclame son tribut en matériaux chaque nuit. Négligez l'entrepôt, et vos bâtiments s'effondrent à l'aurore." },
            { icon: "⚖️", name: "Marchés & Taxes", desc: "Vendez et achetez librement. Les taxes s'accumulent en silence tout au long du jour et sont prélevées par chaque mairie à l'aurore — ville par ville, sans exception." },
            { icon: "🌿", name: "Terres sauvages & Ressources rares", desc: "Affrontez les créatures de six contrées. Chaque victoire rapporte de l'or et parfois un trésor rare. Combattez dans votre biome de métier pour recevoir une bénédiction d'une heure." },
            { icon: "📈", name: "Titres & Renommée personnelle", desc: "Montez du rang de novice jusqu'à celui de légende. Chaque titre gagné vous rend plus rapide et plus chanceux. Ces bienfaits se cumulent avec ceux de votre cité et des biomes." },
            { icon: "👑", name: "Gouvernance & Élections", desc: "Briguer la mairie coûte vingt pièces d'or. Le maire règne dix jours, fixe les taxes et impôts, et peut déclarer la guerre. Trop d'impôts, et les habitants fuient vers d'autres cités." },
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
            { step: "01", icon: "⚡", title: "Produire & transformer", desc: "Récoltez vos matières premières, transformez-les. Gardez planches, fil et pierre brute en poche pour leurs bienfaits passifs. Vos outils ont trois usages — sans eux, tout prend deux fois plus de temps." },
            { step: "02", icon: "🌿", title: "Terres sauvages & Titres", desc: "Parcourez les six contrées pour récolter des trésors rares. Consommez-les pour gagner en renommée. Chaque titre supplémentaire vous accélère et dédouble parfois votre récolte." },
            { step: "03", icon: "🏗️", title: "Alimenter l'entrepôt communautaire", desc: "Déposez vos matériaux transformés à l'entrepôt. L'entretien des bâtiments et des soldats les consomme chaque nuit. L'entrepôt vide, c'est les fonderies qui s'éteignent et les garnisons qui fondent." },
            { step: "04", icon: "⚔️", title: "Armée & Conquête", desc: "Levez vos soldats dans l'onglet Gouvernance. Le maire sonne le tocsin. Les résidents contribuent leurs unités. Le combat se règle à l'arrivée. Pillez lingots et réserves pour freiner l'ascension adverse." },
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
          Trois gloires à conquérir : la cité (Hameau → Empire), la renommée personnelle (Novice → Légendaire), la puissance militaire (garnison, victoires, lingots pillés).
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
            { icon: "🧵", name: "L'Atelier", desc: "Défiez les artisans des profondeurs. Fil rare et tissu rare. Convertissez-les en renommée ou vendez-les au marché — à vous de choisir." },
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
          Cinq combats par jour, six si votre cité est un bourg. Les trésors rares forgent votre renommée — ou s'échangent contre de l'or. Double fortune !
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
          Chaque métier tient une place dans la chaîne du labeur. Sans le Mineur, les forges s'éteignent. Sans le Fermier, les ventres crient. Le Forgeron fabrique les outils qui accélèrent tout le monde — sans eux, les délais doublent. Et votre renommée personnelle ? Elle amplifie tout ce que vous faites.
        </p>
      </div>

      {/* DIPLOMACY & SPY */}
      <div style={{ borderTop: "1px solid #3d2a0a", borderBottom: "1px solid #3d2a0a", padding: "4rem 2rem" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", textAlign: "center", marginBottom: "0.5rem" }}>Alliances & Trahisons</p>
        <h2 style={{ fontSize: "1.7rem", fontWeight: 400, textAlign: "center", color: "#f5e6c0", marginBottom: "0.4rem", letterSpacing: 1 }}>La guerre se gagne aussi dans l'ombre</h2>
        <p style={{ fontSize: 15, color: "#a89070", fontStyle: "italic", textAlign: "center", marginBottom: "2rem", maxWidth: 650, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Chaque maître artisan peut forger un objet de nuisance. Les coups frappent à minuit. Une seule attaque par cité par jour. Le Contrat noble annule le prochain coup ennemi. Le Fermier reste indispensable — sans lui, les ventres ne se remplissent jamais assez vite.
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
            Même les vaincus gagnent renommée et or — contribuez toujours
          </p>
        </div>
      </div>

      {/* STAKES */}
      <div style={{ padding: "4rem 2rem", maxWidth: 950, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontFamily: "sans-serif", fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#c9a44a", marginBottom: "0.5rem" }}>Les lois du monde</p>
        <h2 style={{ fontSize: "1.7rem", fontWeight: 400, color: "#f5e6c0", marginBottom: "2rem", letterSpacing: 1 }}>Chaque décision a un prix</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2, background: "#3d2a0a44", border: "1px solid #3d2a0a" }}>
          {[
            { icon: "🏚️", title: "Les bâtiments s'effondrent", body: "Sans matériaux dans l'entrepôt, les bâtiments tombent chaque nuit. Planches, farine, fil, extrait, pain — approvisionnez avant l'aurore." },
            { icon: "⚖️", title: "Les taxes arrivent à l'aube", body: "Vos achats au marché accumulent des taxes tout le jour. Au matin, chaque mairie vient réclamer son dû sur votre or, une par une." },
            { icon: "💸", title: "L'impôt impayé ruine", body: "Si votre bourse est vide au moment du prélèvement, vos biens sont saisis : inventaire vide, faim et forces à zéro." },
            { icon: "🍞", title: "La faim paralyse", body: "Sous trois de faim, chaque action coûte un souffle supplémentaire. À zéro, impossible de travailler. La faim remonte seule, lentement. Pain et ragoût accélèrent le retour." },
            { icon: "🏖️", title: "Le repos du voyageur", body: "Absent quelques jours ? Déclarez votre retraite — quinze jours au plus — pour suspendre impôts et toute conséquence de l'absence." },
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
          <a href="https://fr.tipeee.com/guildes-couronnes/" target="_blank" rel="noopener noreferrer" style={{ color: "#c9a44a", textDecoration: "none", fontSize: 12, fontFamily: "sans-serif", letterSpacing: 1, fontWeight: 500 }}>💛 Soutenir le conteur</a>
        </p>
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
