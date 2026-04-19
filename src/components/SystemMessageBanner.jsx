import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight } from "lucide-react";

export default function SystemMessageBanner() {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessage = async () => {
      try {
        const messages = await base44.entities.SystemMessage.filter({ is_active: true });
        if (messages.length > 0) {
          setMessage(messages[0].message);
        }
      } catch (e) {
        console.error("Erreur chargement message système:", e);
      }
      setLoading(false);
    };

    loadMessage();
    const unsubscribe = base44.entities.SystemMessage.subscribe((event) => {
      if (event.type === "update" || event.type === "create") {
        loadMessage();
      }
    });

    return unsubscribe;
  }, []);

  if (loading || !message) return null;

  return (
    <div className="bg-accent text-accent-foreground overflow-hidden">
      <div className="animate-marquee inline-flex items-center gap-8 py-2 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          <span className="font-body text-sm">{message}</span>
        </div>
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          <span className="font-body text-sm">{message}</span>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}