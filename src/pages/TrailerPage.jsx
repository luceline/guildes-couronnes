import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Users, Building2, Sword, Coins, MapPin } from 'lucide-react';

export default function TrailerPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Développez votre ville",
      description: "Construisez des bâtiments, attirez des habitants, gérez la trésorerie. Votre ville est votre forteresse."
    },
    {
      icon: <Coins className="w-8 h-8" />,
      title: "Économie vivante",
      description: "Produisez, transformez, vendez. 8 métiers distincts créent une économie complexe et interdépendante."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Commerce inter-villes",
      description: "Voyagez, négociez, dominaez les marchés. Chaque décision compte."
    },
    {
      icon: <Sword className="w-8 h-8" />,
      title: "Sabotage stratégique",
      description: "Items JCJ : désactivez bâtiments ennemis, volez les trésoreries, manipulez les taxes."
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Exploration & routes",
      description: "Découvrez de nouvelles routes commerciales. Le voyage coûte cher mais ouvre des opportunités."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Gestion ressources",
      description: "Énergie, faim, fatigue. Chaque action compte. Planifiez votre stratégie quotidienne."
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative py-20 px-4 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl font-bold font-heading text-foreground">
            🏰 Reinos : L'épopée économique
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Un jeu de stratégie où chaque métier compte, où chaque ville rivalisée, et où vos choix façonnent le monde.
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button size="lg" onClick={() => navigate('/')}>
              Jouer maintenant
            </Button>
            <Button size="lg" variant="outline">
              En savoir plus
            </Button>
          </div>
        </div>
      </div>

      {/* Core Concept */}
      <div className="py-16 px-4 bg-card">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold font-heading">Le concept</h2>
            <p className="text-lg text-muted-foreground">
              Vous incarnez un personnage dans une ville médiévale. Choisissez votre métier (Bûcheron, Mineur, Fermier, Tisserand, Forgeron, Alchimiste, Orfèvre, Marchand) et participez à une économie vivante.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 py-8">
            <div className="space-y-4 p-6 bg-background rounded-lg border">
              <h3 className="text-xl font-bold font-heading">🎯 L'objectif personnel</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Produire, transformer, vendre</li>
                <li>✓ Accumuler richesses et prestige</li>
                <li>✓ Complétez les objectifs quotidiens pour des récompenses</li>
                <li>✓ Améliorez votre logement et équipements</li>
                <li>✓ Montez en puissance économique</li>
              </ul>
            </div>

            <div className="space-y-4 p-6 bg-background rounded-lg border">
              <h3 className="text-xl font-bold font-heading">🏛️ L'enjeu collectif</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Votre ville rivalise avec 6 autres</li>
                <li>✓ Élisez un maire qui prélève les taxes</li>
                <li>✓ Construisez ensemble des bâtiments</li>
                <li>✓ Sabotez les villes rivales stratégiquement</li>
                <li>✓ Compétition pacifique mais intense</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-3xl font-bold font-heading text-center">Les enjeux du jeu</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-6 bg-card rounded-lg border hover:shadow-lg transition-shadow">
                <div className="text-accent mb-4">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2 font-heading">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gameplay Loop */}
      <div className="py-16 px-4 bg-card">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold font-heading text-center">La boucle de gameplay</h2>

          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 bg-background rounded-lg border-l-4 border-accent">
              <span className="text-2xl font-bold text-accent">1</span>
              <div>
                <h3 className="font-bold">Choisissez votre métier</h3>
                <p className="text-sm text-muted-foreground">8 professions avec chaînes de production uniques.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-background rounded-lg border-l-4 border-accent">
              <span className="text-2xl font-bold text-accent">2</span>
              <div>
                <h3 className="font-bold">Produisez & Transformez</h3>
                <p className="text-sm text-muted-foreground">Récoltez ressources brutes, créez items T2-T5 via des recettes interdépendantes.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-background rounded-lg border-l-4 border-accent">
              <span className="text-2xl font-bold text-accent">3</span>
              <div>
                <h3 className="font-bold">Commercez sur le marché</h3>
                <p className="text-sm text-muted-foreground">Achetez et vendez dans votre ville. Naviguez les taxes et prix dynamiques.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-background rounded-lg border-l-4 border-accent">
              <span className="text-2xl font-bold text-accent">4</span>
              <div>
                <h3 className="font-bold">Voyagez & Explorez</h3>
                <p className="text-sm text-muted-foreground">Découvrez 7 villes avec des économies et cultures uniques. Payez les péages.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-background rounded-lg border-l-4 border-accent">
              <span className="text-2xl font-bold text-accent">5</span>
              <div>
                <h3 className="font-bold">Sabotez stratégiquement</h3>
                <p className="text-sm text-muted-foreground">Utilisez items JCJ pour affaiblir villes rivales : vol de trésorerie, baisse production, etc.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-background rounded-lg border-l-4 border-accent">
              <span className="text-2xl font-bold text-accent">6</span>
              <div>
                <h3 className="font-bold">Collaborez pour bâtir</h3>
                <p className="text-sm text-muted-foreground">Contribuez ressources à votre ville. Votez pour la mairie. Construisez ensemble.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-20 px-4 bg-gradient-to-b from-background to-primary/5">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold font-heading">
            Prêt à rejoindre une épopée économique?
          </h2>
          <p className="text-lg text-muted-foreground">
            Créez votre personnage. Choisissez votre métier. Bâtissez votre empire. Affrontez 6 autres villes.
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button size="lg" onClick={() => navigate('/')}>
              Commencer l'aventure
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}