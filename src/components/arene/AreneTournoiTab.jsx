/**
 * src/components/arene/AreneTournoiTab.jsx
 *
 * Placeholder pour l'onglet Tournoi. Sera implémenté en Phase 4 (après le
 * Boss communautaire validé en prod).
 *
 * Système prévu :
 *   - Tournoi bracket hebdomadaire (4 pools par saison)
 *   - Format Suisse 4 rounds
 *   - Cap 15 tours par match, 1 semaine max par match
 *   - Forfait auto après 3 jours d'inactivité
 *   - Ladder "historique des gagnants"
 *   - Récompenses : top 1 = 500 or + 10 jetons, top 2-3 = 100 or + 5 jetons
 */

export default function AreneTournoiTab() {
  return (
    <div style={{
      padding: '2rem 1rem',
      textAlign: 'center',
      color: 'var(--color-text-secondary, #a08868)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
      <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
        Tournoi saisonnier
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
        Bientôt, les chevaliers du royaume s'affronteront chaque semaine dans
        des brackets épiques. Saisons de 4 semaines, ladder permanent et titres
        de champion.
      </p>
      <p style={{ fontSize: 11, marginTop: 12, fontStyle: 'italic', opacity: 0.7 }}>
        Disponible après validation du combat contre le Dragon de Nuit.
      </p>
    </div>
  );
}
