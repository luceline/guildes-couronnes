import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ITEMS } from "@/lib/craftingData";
import { COMPETITIVE_ITEMS } from "@/lib/gameData";

/**
 * Infobulle item : hover sur desktop, tap (toggle) sur mobile.
 * Utilise un portal pour éviter tout problème de z-index/overflow.
 * @param recipe - Recette dynamique T1.5 (inputs aléatoires)
 */
export default function ItemTooltip({ itemKey, itemName, children, side = "top", recipe = null }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const triggerRef      = useRef(null);
  const tooltipRef      = useRef(null);

  // ── Données à afficher ──────────────────────────────────────────
  let icon, name, useText, craftedBy;

  if (recipe) {
    icon    = recipe.icon;
    name    = recipe.name;
    useText = recipe.description || "Ressources aléatoires pour craft";
  } else {
    const data =
      (itemKey && ITEMS[itemKey]) ||
      Object.values(ITEMS).find(d => d.name === itemName) ||
      (itemName && ITEMS[itemName?.toLowerCase().replace(/ /g, "_")]);

    const compData =
      (itemKey && COMPETITIVE_ITEMS[itemKey]) ||
      Object.values(COMPETITIVE_ITEMS).find(d => d.name === itemName);

    icon      = data?.icon || compData?.icon;
    name      = data?.name || compData?.name || itemName;
    useText   = data?.use  || compData?.description;
    craftedBy = compData?.craftedBy;
  }

  // ── Calcul position ─────────────────────────────────────────────
  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect  = triggerRef.current.getBoundingClientRect();
    const TIP_W = 256;
    const TIP_H = 100;

    let top = (side === "top" || rect.bottom + TIP_H + 8 > window.innerHeight)
      ? rect.top  + window.scrollY - TIP_H - 8
      : rect.bottom + window.scrollY + 8;

    let left = rect.left + window.scrollX + rect.width / 2 - TIP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TIP_W - 8));

    setPos({ top, left });
  }, [side]);

  // ── Fermer si clic dehors ───────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleMouseEnter = () => { computePos(); setOpen(true); };
  const handleMouseLeave = (e) => {
    if (tooltipRef.current?.contains(e.relatedTarget)) return;
    setOpen(false);
  };
  const handleClick = (e) => {
    e.stopPropagation();
    computePos();
    setOpen(v => !v);
  };

  if (!useText) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        style={{ WebkitTapHighlightColor: "transparent", cursor: "help", display: "inline" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </span>

      {open && createPortal(
        <div
          ref={tooltipRef}
          onMouseLeave={() => setOpen(false)}
          style={{ position: "absolute", top: pos.top, left: pos.left, width: 256, zIndex: 9999 }}
          className="text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-xl rounded-lg px-3 py-2"
        >
          {icon && name && (
            <div className="font-semibold mb-1 font-heading">{icon} {name}</div>
          )}
          <div className="font-body whitespace-pre-wrap">{useText}</div>
          {craftedBy && (
            <div className="mt-1 text-muted-foreground">
              Fabriqué par : {craftedBy.join(", ")}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}