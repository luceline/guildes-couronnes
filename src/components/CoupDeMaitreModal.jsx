import { useEffect, useState } from "react";

/**
 * CoupDeMaitreModal : Bannière animée affichée lors d'un coup de maître
 * Props :
 *   show     : boolean
 *   itemName : string  : nom de l'item produit en bonus
 *   qty      : number  : quantité bonus
 *   sources  : string  : sources du bonus (ex: "biome + charbon")
 *   onClose  : fn      : appelé après la durée d'affichage
 */
export default function CoupDeMaitreModal({ show, itemName, qty, sources, onClose }) {
  const [visible, setVisible] = useState(false);
  const [animOut, setAnimOut] = useState(false);

  useEffect(() => {
    if (!show) return;
    setAnimOut(false);
    setVisible(true);
    const hideTimer = setTimeout(() => {
      setAnimOut(true);
    }, 3200);
    const closeTimer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 3700);
    return () => { clearTimeout(hideTimer); clearTimeout(closeTimer); };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #b8860b 0%, #ffd700 40%, #b8860b 100%)",
          border: "3px solid #ffd700",
          borderRadius: "1rem",
          padding: "1.5rem 2.5rem",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(255, 215, 0, 0.6), 0 8px 32px rgba(0,0,0,0.4)",
          maxWidth: "90vw",
          transform: animOut ? "scale(0.8) translateY(-20px)" : "scale(1) translateY(0)",
          opacity: animOut ? 0 : 1,
          transition: "transform 0.5s ease, opacity 0.5s ease",
          animation: animOut ? "none" : "popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <style>{`
          @keyframes popIn {
            0%   { transform: scale(0.5) translateY(20px); opacity: 0; }
            100% { transform: scale(1) translateY(0);      opacity: 1; }
          }
          @keyframes shimmer {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>

        <div style={{ fontSize: "2.5rem", marginBottom: "0.25rem" }}>⭐</div>

        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(1.2rem, 4vw, 1.6rem)",
          fontWeight: "bold",
          color: "#1a0a00",
          letterSpacing: 2,
          textTransform: "uppercase",
          textShadow: "0 1px 2px rgba(255,255,255,0.3)",
          marginBottom: "0.5rem",
        }}>
          Coup de Maître !
        </div>

        <div style={{
          fontFamily: "sans-serif",
          fontSize: "clamp(1rem, 3vw, 1.25rem)",
          color: "#1a0a00",
          fontWeight: 600,
          marginBottom: "0.4rem",
        }}>
          +{qty} {itemName} en bonus !
        </div>

        {sources && (
          <div style={{
            fontFamily: "sans-serif",
            fontSize: "0.8rem",
            color: "#3d1f00",
            opacity: 0.8,
            letterSpacing: 1,
          }}>
            {sources}
          </div>
        )}
      </div>
    </div>
  );
}
