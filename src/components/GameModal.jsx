import { useEffect, useState } from "react";

/**
 * GameModal : Bannière animée pour les notifications importantes du jeu
 *
 * Props :
 *   show     : boolean
 *   type     : "success" | "warning" | "error"
 *   icon     : string emoji
 *   title    : string
 *   message  : string
 *   onClose  : fn
 *   duration : number (ms, défaut 3500)
 */
export default function GameModal({ show, type = "success", icon, title, message, onClose, duration = 3500 }) {
  const [visible, setVisible] = useState(false);
  const [animOut, setAnimOut] = useState(false);

  useEffect(() => {
    if (!show) return;
    setAnimOut(false);
    setVisible(true);
    const hideTimer = setTimeout(() => setAnimOut(true), duration - 500);
    const closeTimer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => { clearTimeout(hideTimer); clearTimeout(closeTimer); };
  }, [show]);

  if (!visible) return null;

  const styles = {
    success: {
      background: "linear-gradient(135deg, #b8860b 0%, #ffd700 40%, #b8860b 100%)",
      border: "3px solid #ffd700",
      boxShadow: "0 0 40px rgba(255, 215, 0, 0.6), 0 8px 32px rgba(0,0,0,0.4)",
      titleColor: "#1a0a00",
      textColor: "#1a0a00",
      subColor: "#3d1f00",
    },
    warning: {
      background: "linear-gradient(135deg, #92400e 0%, #f59e0b 40%, #92400e 100%)",
      border: "3px solid #f59e0b",
      boxShadow: "0 0 40px rgba(245, 158, 11, 0.6), 0 8px 32px rgba(0,0,0,0.4)",
      titleColor: "#fff8ed",
      textColor: "#fff8ed",
      subColor: "#fde68a",
    },
    error: {
      background: "linear-gradient(135deg, #7f1d1d 0%, #ef4444 40%, #7f1d1d 100%)",
      border: "3px solid #ef4444",
      boxShadow: "0 0 40px rgba(239, 68, 68, 0.5), 0 8px 32px rgba(0,0,0,0.4)",
      titleColor: "#fff",
      textColor: "#fff",
      subColor: "#fca5a5",
    },
  };

  const s = styles[type] || styles.success;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    }}>
      <div style={{
        background: s.background,
        border: s.border,
        borderRadius: "1rem",
        padding: "1.5rem 2.5rem",
        textAlign: "center",
        boxShadow: s.boxShadow,
        maxWidth: "90vw",
        transform: animOut ? "scale(0.8) translateY(-20px)" : "scale(1) translateY(0)",
        opacity: animOut ? 0 : 1,
        transition: "transform 0.5s ease, opacity 0.5s ease",
        animation: animOut ? "none" : "popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}>
        <style>{`
          @keyframes popIn {
            0%   { transform: scale(0.5) translateY(20px); opacity: 0; }
            100% { transform: scale(1) translateY(0);      opacity: 1; }
          }
        `}</style>

        {icon && <div style={{ fontSize: "2.5rem", marginBottom: "0.25rem" }}>{icon}</div>}

        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(1.1rem, 4vw, 1.5rem)",
          fontWeight: "bold",
          color: s.titleColor,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          {title}
        </div>

        {message && (
          <div style={{
            fontFamily: "sans-serif",
            fontSize: "clamp(0.9rem, 3vw, 1.1rem)",
            color: s.textColor,
            fontWeight: 500,
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
