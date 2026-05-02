import { useMusicPlayer } from "@/lib/MusicContext";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, Music } from "lucide-react";

export default function MusicPlayer() {
  const {
    isPlaying,
    currentTrack,
    currentIndex,
    volume,
    enabled,
    setVolume,
    togglePlay,
    next,
    prev,
    toggleEnabled,
    playTrack,
    trackNumber,
    totalTracks,
    tracks,
    loading,
  } = useMusicPlayer();

  return (
    <div className="border border-border rounded-xl bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-base flex items-center gap-2">
          <Music className="h-4 w-4 text-accent" />
          Musique de fond
        </h3>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm font-body text-muted-foreground">
            {enabled ? "Activée" : "Désactivée"}
          </span>
          <button
            onClick={toggleEnabled}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Piste en cours */}
      <div className={`transition-opacity ${enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        <div className="bg-muted/50 rounded-lg px-4 py-3 text-center">
          <p className="font-heading text-sm font-semibold text-foreground truncate">
            🎵 {currentTrack?.title}
          </p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            {currentTrack?.artist} : Piste {trackNumber}/{totalTracks}
          </p>
        </div>

        {/* Contrôles */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <Button variant="ghost" size="icon" onClick={prev} title="Piste précédente">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={togglePlay}
            className="h-10 w-10 rounded-full"
            title={isPlaying ? "Pause" : "Lecture"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={next} title="Piste suivante">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => setVolume(volume > 0 ? 0 : 0.4)} className="text-muted-foreground hover:text-foreground transition-colors">
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right font-body">
            {Math.round(volume * 100)}%
          </span>
        </div>

        {/* Liste des pistes */}
        <div className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground font-body mb-2">Toutes les pistes :</p>
          {loading ? (
            <p className="text-xs text-muted-foreground font-body">Chargement...</p>
          ) : tracks.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body">Aucune musique.</p>
          ) : (
            tracks.map((track, i) => (
              <button
                key={i}
                onClick={() => playTrack(i)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-body cursor-pointer transition-colors ${
                  i === currentIndex
                    ? "bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span className="text-base">🎵</span>
                <span className="flex-1 truncate">{track.title}</span>
                <span className="text-xs opacity-60">{track.artist}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-body text-center">
        La musique est activée par défaut à 20% : elle continue pendant toute votre session
      </p>
    </div>
  );
}