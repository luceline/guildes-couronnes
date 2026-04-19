import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

export default function SystemMessageManager() {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadMessage();
  }, []);

  const loadMessage = async () => {
    setLoading(true);
    try {
      const messages = await base44.entities.SystemMessage.list();
      if (messages.length > 0) {
        setMessage(messages[0]);
        setNewMessage(messages[0].message);
        setIsActive(messages[0].is_active);
      }
    } catch (e) {
      console.error("Erreur chargement message:", e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!newMessage.trim()) {
      toast.error("Le message ne peut pas être vide.");
      return;
    }

    try {
      if (message?.id) {
        await base44.entities.SystemMessage.update(message.id, {
          message: newMessage,
          is_active: isActive,
        });
        setMessage({ ...message, message: newMessage, is_active: isActive });
        toast.success("Message mis à jour.");
      } else {
        const created = await base44.entities.SystemMessage.create({
          message: newMessage,
          is_active: isActive,
        });
        setMessage(created);
        toast.success("Message créé.");
      }
      setEditing(false);
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde.");
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!message?.id) return;
    if (!confirm("Supprimer ce message ?")) return;

    try {
      await base44.entities.SystemMessage.delete(message.id);
      setMessage(null);
      setNewMessage("");
      toast.success("Message supprimé.");
    } catch (e) {
      toast.error("Erreur lors de la suppression.");
      console.error(e);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground">Chargement...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">📢 Message système</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <>
            {message ? (
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-body mb-1">Message actuel :</p>
                    <p className="font-body text-sm">{message.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Actif :</span>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          message.is_active ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Aucun message système pour le moment.</p>
            )}
            <Button onClick={() => setEditing(true)} className="w-full font-heading">
              {message ? "Modifier" : "Créer un message"}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="font-body">Message</Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Écrivez le message à afficher en banni..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground font-body">
                Le message défilera en haut de l'écran de tous les joueurs.
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                id="active-toggle"
              />
              <Label htmlFor="active-toggle" className="font-body text-sm cursor-pointer">
                Afficher le message
              </Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 font-heading">
                Enregistrer
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setNewMessage(message?.message || "");
                  setIsActive(message?.is_active ?? true);
                }}
                className="flex-1 font-heading"
              >
                Annuler
              </Button>
              {message && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleDelete}
                  className="font-heading"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}