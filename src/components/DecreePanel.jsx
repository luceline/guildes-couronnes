import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function DecreePanel({ city, isMayor, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  const currentMessage = city.mayor_message || "";

  const handleStartEdit = () => {
    setMessageInput(currentMessage);
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = messageInput.trim();
    await base44.entities.City.update(city.id, { mayor_message: trimmed });
    toast.success("📋 Message affiché sur le tableau d'affichage !");
    setEditing(false);
    onRefresh?.();
  };

  const handleClear = async () => {
    await base44.entities.City.update(city.id, { mayor_message: "" });
    toast.success("📋 Tableau d'affichage effacé.");
    setEditing(false);
    onRefresh?.();
  };

  if (!isMayor && !currentMessage) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-heading font-semibold text-amber-900">
          📋 Tableau d'affichage du maire
        </p>
        {isMayor && !editing && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs font-heading border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={handleStartEdit}
          >
            ✏️ {currentMessage ? "Modifier" : "Écrire un message"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Écrivez un message pour vos habitants..."
            className="text-xs font-body min-h-[80px] resize-none border-amber-300 focus:border-amber-500"
            maxLength={500}
          />
          <div className="flex items-center gap-2 justify-between">
            <span className="text-xs text-amber-700 font-body">
              {messageInput.length}/500
            </span>
            <div className="flex gap-2">
              {currentMessage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs font-heading text-red-600 hover:text-red-800"
                  onClick={handleClear}
                >
                  Effacer
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs font-heading"
                onClick={() => setEditing(false)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs font-heading"
                onClick={handleSave}
                disabled={!messageInput.trim()}
              >
                Publier
              </Button>
            </div>
          </div>
        </div>
      ) : currentMessage ? (
        <p className="text-xs font-body text-amber-900 whitespace-pre-wrap leading-relaxed">
          {currentMessage}
        </p>
      ) : (
        <p className="text-xs font-body text-amber-600 italic">
          Aucun message pour le moment.
        </p>
      )}
    </div>
  );
}