import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PAGES = [
  { value: "/", label: "🏠 Accueil" },
  { value: "/city", label: "🏘️ Ville" },
  { value: "/market", label: "🛒 Marché" },
  { value: "/travel", label: "🐴 Voyage" },
  { value: "/world", label: "🌍 Monde" },
  { value: "/taverne", label: "🍺 Taverne" },
  { value: "/production", label: "⚒️ Production" },
  { value: "/profile", label: "👤 Profil" },
];

export default function MusicManager() {
  const [musics, setMusics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    file: null,
    pages: [],
  });

  useEffect(() => {
    loadMusics();
  }, []);

  async function loadMusics() {
    setLoading(true);
    const data = await base44.entities.Music.list().catch(() => []);
    setMusics(data || []);
    setLoading(false);
  }

  async function handleUpload() {
    if (!formData.title || !formData.file) {
      toast.error("Titre et fichier requis");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: formData.file });

      await base44.entities.Music.create({
        title: formData.title,
        artist: formData.artist || "Unknown",
        file_url,
        pages: formData.pages,
        is_active: true,
      });

      toast.success(`✅ ${formData.title} uploadée !`);
      setFormData({ title: "", artist: "", file: null, pages: [] });
      await loadMusics();
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
    }
    setUploading(false);
  }

  async function deleteMusic(id) {
    if (!window.confirm("Supprimer cette musique ?")) return;
    await base44.entities.Music.delete(id);
    toast.success("Musique supprimée !");
    await loadMusics();
  }

  async function toggleActive(id, isActive) {
    await base44.entities.Music.update(id, { is_active: !isActive });
    await loadMusics();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">🎵 Upload de musique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Taverne médiévale"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Artiste</Label>
              <Input
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                placeholder="Ex: Ambiance fantasy"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-body">Fichier audio (MP3/WAV) *</Label>
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-body">Pages où jouer cette musique</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PAGES.map((page) => (
                <button
                  key={page.value}
                  onClick={() => {
                    const newPages = formData.pages.includes(page.value)
                      ? formData.pages.filter((p) => p !== page.value)
                      : [...formData.pages, page.value];
                    setFormData({ ...formData, pages: newPages });
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-body border transition-colors ${
                    formData.pages.includes(page.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {page.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading || !formData.title || !formData.file}
            className="font-heading w-full"
          >
            {uploading ? "Upload en cours..." : "📤 Upload"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {musics.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground font-body">
              Aucune musique uploadée
            </CardContent>
          </Card>
        ) : (
          musics.map((music) => (
            <Card key={music.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold">{music.title}</h3>
                      <p className="text-xs text-muted-foreground font-body">{music.artist}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {music.pages?.length > 0 ? (
                          music.pages.map((page) => (
                            <Badge key={page} variant="secondary" className="text-xs font-body">
                              {PAGES.find((p) => p.value === page)?.label || page}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs font-body text-muted-foreground">
                            Aucune page
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={music.is_active ? "default" : "secondary"}
                      className="text-xs font-body"
                    >
                      {music.is_active ? "✅ Actif" : "❌ Inactif"}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={music.is_active ? "secondary" : "default"}
                      className="font-body text-xs"
                      onClick={() => toggleActive(music.id, music.is_active)}
                    >
                      {music.is_active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="font-body text-xs"
                      onClick={() => deleteMusic(music.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}