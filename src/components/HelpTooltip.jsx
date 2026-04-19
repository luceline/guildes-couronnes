import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function HelpTooltip({ text, side = "top" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted border border-border text-muted-foreground text-[10px] font-bold cursor-help select-none hover:bg-accent hover:text-accent-foreground transition-colors">
          ?
        </span>
      </PopoverTrigger>
      <PopoverContent side={side} className="max-w-xs text-xs font-body leading-relaxed p-3">
        {text}
      </PopoverContent>
    </Popover>
  );
}