import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getTodayDateStr } from "../lib/gameData";

export default function ElectionPanel({ city, profile, mayorActive, onRefresh }) {
  const [candidateProgram, setCandidateProgram] = useState("");
  const [declaringCandidate, setDeclaringCandidate] = useState(false);
  const [voting, setVoting] = useState(null);
  const [localAlreadyCandidate, setLocalAlreadyCandidate] = useState(false);

  if (!mayorActive || !city?.mayor_until) return null;

  const todayStr = getTodayDateStr();

  // Calcul robuste en comparant des strings ISO à midi UTC pour éviter les décalages de fuseau
  const daysLeft = Math.round(
    (new Date(city.mayor_until + "T12:00:00Z") - new Date(todayStr + "T12:00:00Z")) / 86400000
  );

  // Phase électorale :
  // daysLeft <= 2 → vote ouvert (2 derniers jours)
  // daysLeft <= 7 → candidatures ouvertes
  // sinon → pas de phase active
  const electionPhase = daysLeft <= 2 ? "vote" : daysLeft <= 7 ? "candidature" : null;

  const isResident = profile?.home_city_id === city?.id;
  const candidates = city?.election_candidates || [];
  const votes = city?.election_votes || {};
  const alreadyCandidate = localAlreadyCandidate || candidates.some(c => c.player_email === profile?.user_email);
  const alreadyVoted = !!(profile?.user_email && votes[profile.user_email]);

  // Rien à afficher si pas de phase ET pas de candidats déjà déclarés
  if (!electionPhase && candidates.length === 0) {
    if (!isResident || daysLeft === null || daysLeft > 7) return null;
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 mb-2">
        <p className="text-xs font-heading font-semibold text-gray-700">🗳️ Prochaine élection dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}</p>
        <p className="text-xs font-body text-gray-500">Les candidatures ouvrent à J-7, le vote à J-2.</p>
      </div>
    );
  }

  const handleDeclareCandidate = async () => {
    if (!isResident) { toast.error("Seuls les résidents peuvent se présenter."); return; }
    if (alreadyCandidate) { toast.error("Vous êtes déjà candidat !"); return; }
    setDeclaringCandidate(true);
    try {
      const freshCity = await base44.entities.City.get(city.id).catch(() => city);
      const currentCandidates = freshCity?.election_candidates || [];
      if (currentCandidates.some(c => c.player_email === profile.user_email)) {
        toast("Vous êtes déjà candidat !"); setDeclaringCandidate(false); onRefresh?.(); return;
      }
      const newCandidates = [...currentCandidates, {
        player_email: profile.user_email,
        player_name:  profile.character_name,
        profession:   profile.profession,
        program:      candidateProgram.trim() || "Aucun programme communiqué.",
        declared_at:  new Date().toISOString(),
      }];
      await base44.entities.City.update(city.id, { election_candidates: newCandidates });
      const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
      if (hasTavern) {
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Héraut royal",
          profession: "",
          message: `📜 ${profile.character_name} (${profile.profession}) se présente à la mairie de ${city.name} ! Programme : « ${candidateProgram.trim() || "Aucun programme communiqué."} »`,
        }).catch(() => {});
      }
      toast.success("📜 Vous êtes candidat à la mairie !");
      setCandidateProgram("");
      setDeclaringCandidate(false);
      setLocalAlreadyCandidate(true);
      onRefresh?.();
    } catch(e) {
      console.error("Erreur candidature:", e);
      toast.error("Erreur lors de la candidature. Réessayez.");
      setDeclaringCandidate(false);
    }
  };

  const handleVote = async (candidateEmail) => {
    if (!isResident) { toast.error("Seuls les résidents peuvent voter."); return; }
    if (alreadyVoted) { toast.error("Vous avez déjà voté !"); return; }
    if (electionPhase !== "vote") { toast.error("La phase de vote n'est pas encore ouverte."); return; }
    if (candidateEmail === profile.user_email) { toast.error("Vous ne pouvez pas voter pour vous-même."); return; }
    setVoting(candidateEmail);
    const newVotes = { ...votes, [profile.user_email]: candidateEmail };
    await base44.entities.City.update(city.id, { election_votes: newVotes });
    const candidate = candidates.find(c => c.player_email === candidateEmail);
    toast.success(`🗳️ Vote enregistré pour ${candidate?.player_name} !`);
    setVoting(null);
    onRefresh?.();
  };

  return (
    <div className={`rounded-lg border p-4 space-y-3 mb-2 ${electionPhase === "vote" ? "border-blue-300 bg-blue-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-heading font-semibold text-sm text-amber-900">
          {electionPhase === "vote" ? "🗳️ Vote en cours" : "📜 Élection municipale"}
        </h3>
        <span className="text-xs font-body text-muted-foreground">
          Fin du mandat dans <strong>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</strong>
          {electionPhase === "candidature" && " — Candidatures ouvertes"}
          {electionPhase === "vote" && " — Vote ouvert"}
        </span>
      </div>

      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map(c => {
            const voteCount = Object.values(votes).filter(v => v === c.player_email).length;
            const hasMyVote = votes[profile?.user_email] === c.player_email;
            const isMe = c.player_email === profile?.user_email;
            return (
              <div key={c.player_id} className={`rounded-lg border p-3 space-y-1 bg-white ${hasMyVote ? "border-blue-400" : isMe ? "border-amber-400" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-heading font-semibold text-sm">{c.player_name}</span>
                    <span className="text-xs text-muted-foreground font-body ml-2">{c.profession}</span>
                    {isMe && <span className="text-xs text-amber-600 font-body ml-2">✓ Vous</span>}
                    {hasMyVote && <span className="text-xs text-blue-600 font-body ml-2">✓ Votre vote</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {electionPhase === "vote" && <span className="text-xs font-body text-muted-foreground">{voteCount} vote{voteCount > 1 ? "s" : ""}</span>}
                    {electionPhase === "vote" && isResident && !alreadyVoted && !isMe && (
                      <Button size="sm" variant="outline" className="h-7 text-xs font-heading"
                        disabled={voting === c.player_email}
                        onClick={() => handleVote(c.player_email)}>
                        {voting === c.player_email ? "..." : "Voter"}
                      </Button>
                    )}
                  </div>
                </div>
                {c.program && <p className="text-xs font-body text-muted-foreground italic">« {c.program} »</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground font-body italic">Aucun candidat déclaré pour l'instant.</p>
      )}

      {electionPhase === "candidature" && isResident && !alreadyCandidate && (
        <div className="space-y-2 border-t border-amber-200 pt-3">
          <label className="text-xs font-body font-semibold text-amber-900">Votre programme (facultatif) :</label>
          <textarea
            className="w-full text-xs text-gray-900 font-body border border-amber-300 rounded-lg px-3 py-2 bg-white resize-none h-16"
            placeholder="Max 200 caractères..."
            maxLength={200}
            value={candidateProgram}
            onChange={e => setCandidateProgram(e.target.value)}
          />
          <p className="text-xs text-gray-400 font-body">{candidateProgram.length}/200</p>
          <Button size="sm" className="font-heading w-full bg-amber-500 hover:bg-amber-600 text-white"
            disabled={declaringCandidate} onClick={handleDeclareCandidate}>
            {declaringCandidate ? "Envoi..." : "📜 Me déclarer candidat"}
          </Button>
        </div>
      )}
      {electionPhase === "candidature" && isResident && alreadyCandidate && (
        <p className="text-xs text-amber-800 font-body border-t border-amber-200 pt-2">✅ Vous êtes candidat. Le vote s'ouvre à J-2.</p>
      )}
      {electionPhase === "vote" && isResident && alreadyVoted && (
        <p className="text-xs text-blue-700 font-body border-t border-blue-200 pt-2">✅ Vous avez voté. Résultats à la fin du mandat.</p>
      )}
      {!isResident && (
        <p className="text-xs text-muted-foreground font-body italic">Seuls les résidents de {city.name} peuvent voter ou se présenter.</p>
      )}
    </div>
  );
}