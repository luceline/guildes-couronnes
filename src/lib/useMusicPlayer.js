// ── Global music player : persiste entre les pages via localStorage ──
import { useState, useEffect, useRef, useCallback } from "react";

export const TRACKS = [
  {
    title: "Taverne médiévale",
    artist: "Ambiance fantasy",
    url: "https://upload.wikimedia.org/wikipedia/commons/7/73/Medieval_Music_-_Dance_of_the_Peasants.ogg",
  },
  {
    title: "Marche royale",
    artist: "Fanfare de cour",
    url: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Saltarello.ogg",
  },
  {
    title: "Ballade du troubadour",
    artist: "Musique de luth",
    url: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Cantigas_de_Santa_Maria_-_CSM_166.ogg",
  },
  {
    title: "Bruit de forge",
    artist: "Ambiance artisanale",
    url: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Gregorian_Chant_-_Kyrie_Eleison.ogg",
  },
  {
    title: "Chant des croisés",
    artist: "Chœur médiéval",
    url: "https://upload.wikimedia.org/wikipedia/commons/1/16/Hildegard_von_Bingen_-_O_Virtus_Sapientie.ogg",
  },
];

function shuffleTracks() {
  const arr = [...TRACKS.map((_, i) => i)];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const STORAGE_KEY = "gc_music_enabled";
const VOLUME_KEY = "gc_music_volume";

export function useMusicPlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem(VOLUME_KEY) || "0.2"));
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== "false");
  const playOrderRef = useRef(shuffleTracks());

  const currentTrackIdx = playOrderRef.current[currentIndex] ?? 0;
  const currentTrack = TRACKS[currentTrackIdx];

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.loop = true;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    const track = TRACKS[playOrderRef.current[currentIndex] ?? 0];
    audioRef.current.src = track.url;
    if (enabled && isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    if (!enabled) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [enabled]);

  const play = useCallback(() => {
    if (!audioRef.current || !enabled) return;
    if (!audioRef.current.src || audioRef.current.src === window.location.href) {
      audioRef.current.src = TRACKS[playOrderRef.current[0]].url;
    }
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  }, [enabled]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const next = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % TRACKS.length);
  }, []);

  const prev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + TRACKS.length) % TRACKS.length);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(e => !e);
  }, []);

  return {
    isPlaying,
    currentTrack,
    volume,
    enabled,
    setVolume,
    togglePlay,
    next,
    prev,
    toggleEnabled,
    trackNumber: currentIndex + 1,
    totalTracks: TRACKS.length,
  };
}