/**
 * src/components/arene/AreneCombatTab.jsx
 *
 * Onglet "Combat" de l'Arène. Affiche la fiche de combat complète du joueur
 * (équipement, soin, amélioration, durabilité) via le composant
 * CombatEquipmentPanel qui existait déjà dans le projet.
 *
 * Refonte 15/05/2026 : remplace la vue rapide custom par le panel existant
 * pour récupérer toutes les fonctionnalités (heal, repair, upgrade).
 */

import { usePlayerData } from '@/lib/usePlayerData';
import CombatEquipmentPanel from '@/components/CombatEquipmentPanel';

export default function AreneCombatTab() {
  const { profile, loading, refresh } = usePlayerData();

  if (loading || !profile) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#a08868' }}>
        Chargement…
      </div>
    );
  }

  return <CombatEquipmentPanel profile={profile} onRefresh={refresh} />;
}
