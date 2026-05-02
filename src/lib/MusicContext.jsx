import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem("gc_music_volume") || "0.2"));
  const [enabled, setEnabled] = useState(() => localStorage.getItem("gc_music_enabled") !== "false"); // activé par défaut
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("/");

  // Charger les musiques depuis la BD
  useEffect(() => {
    async function loadMusics() {
      const musics = await base44.entities.Music.filter({ is_active: true }).catch(() => []);
      setTracks(musics || []);
      setLoading(false);
    }
    loadMusics();
  }, []);

  // Tracker la page actuelle
  useEffect(() => {
    setCurrentPage(window.location.pathname);
    const handlePopState = () => setCurrentPage(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const currentTrack = tracks[currentIndex];

  // Init audio une seule fois + coordination multi-onglets
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.loop = true;
    audioRef.current = audio;

    // ── Coordination multi-onglets via BroadcastChannel ──
    // Si un autre onglet commence à jouer, cet onglet se met en pause
    const TAB_ID = Math.random().toString(36).slice(2);
    const channel = new BroadcastChannel("gc_music_tab");

    channel.onmessage = (e) => {
      if (e.data.type === "playing" && e.data.tabId !== TAB_ID) {
        // Un autre onglet joue → on se tait
        audio.pause();
        setIsPlaying(false);
      }
    };

    // Quand cet onglet joue, prévenir les autres
    audio.addEventListener("play", () => {
      channel.postMessage({ type: "playing", tabId: TAB_ID });
    });

    // Pause automatique quand l'appli passe en arrière-plan, reprise au retour
    let wasPlayingBeforeHide = false;
    const handleVisibility = () => {
      if (document.hidden) {
        // Page cachée (changement d'appli, verrouillage écran, autre onglet)
        wasPlayingBeforeHide = audioRef.current && !audioRef.current.paused;
        if (wasPlayingBeforeHide) {
          audioRef.current.pause();
        }
      } else {
        // Page de nouveau visible : reprendre si on jouait avant
        if (wasPlayingBeforeHide && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      audio.pause();
      audioRef.current = null;
      channel.close();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Changer de piste ou d'état de lecture
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.file_url;
    audio.onended = null;
    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentIndex, isPlaying, currentTrack, tracks.length]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem("gc_music_volume", String(volume));
  }, [volume]);

  // Enabled
  useEffect(() => {
    localStorage.setItem("gc_music_enabled", String(enabled));
    if (!enabled && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [enabled]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (!audio.src || audio.src === window.location.href) {
      audio.src = currentTrack.file_url;
    }
    audio.play().then(() => {
      setIsPlaying(true);
      setEnabled(true);
    }).catch(() => {});
  }, [currentTrack]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const next = useCallback(() => setCurrentIndex(prev => (prev + 1) % tracks.length), [tracks.length]);
  const prev = useCallback(() => setCurrentIndex(prev => (prev - 1 + tracks.length) % tracks.length), [tracks.length]);
  const toggleEnabled = useCallback(() => setEnabled(e => !e), []);

  const playTrack = useCallback((index) => {
    if (index >= 0 && index < tracks.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
      setEnabled(true);
    }
  }, [tracks.length]);

  // Auto-play musique selon la page
  useEffect(() => {
    if (!tracks.length || loading) return;

    const musicForPage = tracks.find(m => m.pages && m.pages.includes(currentPage));
    const targetIndex = musicForPage ? tracks.indexOf(musicForPage) : 0;

    if (targetIndex !== currentIndex) {
      setCurrentIndex(targetIndex);
    }

    if (enabled && audioRef.current) {
      const audio = audioRef.current;
      const track = tracks[targetIndex];
      if (track && audio.src !== track.file_url) {
        audio.src = track.file_url;
      }
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentPage, tracks, loading]);

  return (
    <MusicContext.Provider value={{
      isPlaying, currentTrack, currentIndex, volume, enabled, loading,
      setVolume, togglePlay, next, prev, toggleEnabled, playTrack,
      trackNumber: currentIndex + 1, totalTracks: tracks.length,
      tracks,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusicPlayer() {
  return useContext(MusicContext);
}