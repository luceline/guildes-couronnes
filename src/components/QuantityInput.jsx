/**
 * QuantityInput : sélecteur de quantité mobile-friendly.
 *
 * Remplace les <Input type="number"> qui déclenchent le clavier numérique
 * système (qui prend 60% de l'écran en mode landscape mobile, masquant le
 * contexte). Combine :
 *   - Bouton [-] (décrémente par `step`, respecte `min`)
 *   - Input numérique éditable (clavier optionnel pour saisie rapide)
 *   - Bouton [+] (incrémente par `step`, respecte `max`)
 *   - Bouton [Max] (optionnel, si `showMax` ET `max` défini)
 *
 * Utilisation type :
 *   <QuantityInput
 *     value={qty}
 *     onChange={setQty}
 *     min={1}
 *     max={50}
 *     showMax
 *   />
 *
 * Propriétés
 * @param {number} value - Valeur actuelle
 * @param {(n: number) => void} onChange - Callback appelé avec la nouvelle valeur (clampée)
 * @param {number} [min=0] - Valeur minimale
 * @param {number} [max] - Valeur maximale (si undefined, pas de borne haute)
 * @param {number} [step=1] - Pas d'incrémentation
 * @param {boolean} [showMax=false] - Affiche le bouton "Max" (nécessite `max` défini)
 * @param {string} [maxLabel="Max"] - Texte du bouton max
 * @param {boolean} [disabled=false] - Désactive tous les contrôles
 * @param {string} [className=""] - Classes supplémentaires sur le wrapper
 * @param {string} [inputClassName=""] - Classes supplémentaires sur l'input
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

export default function QuantityInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  showMax = false,
  maxLabel = "Max",
  disabled = false,
  className = "",
  inputClassName = "",
}) {
  // Clamp helper
  const clamp = (n) => {
    let v = Number.isFinite(n) ? n : min;
    if (v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    // Permettre saisie vide (utilisateur en train d'effacer)
    if (raw === "") {
      onChange(min);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed));
  };

  const handleDec = () => onChange(clamp(value - step));
  const handleInc = () => onChange(clamp(value + step));
  const handleMax = () => max !== undefined && onChange(max);

  const canDec = !disabled && value > min;
  const canInc = !disabled && (max === undefined || value < max);
  const canMax = !disabled && max !== undefined && value < max;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDec}
        disabled={!canDec}
        className="h-10 w-10 shrink-0 font-body"
        aria-label="Diminuer"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`text-center font-body h-10 w-16 ${inputClassName}`}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleInc}
        disabled={!canInc}
        className="h-10 w-10 shrink-0 font-body"
        aria-label="Augmenter"
      >
        <Plus className="h-4 w-4" />
      </Button>
      {showMax && max !== undefined && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleMax}
          disabled={!canMax}
          className="h-10 px-3 font-body shrink-0"
        >
          {maxLabel}
        </Button>
      )}
    </div>
  );
}
