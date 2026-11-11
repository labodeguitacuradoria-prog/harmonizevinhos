import { useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type W = { id: string; name: string; producer: string | null; vintage: number | null; internal_code: string | null };

const label = (w: W) => `${w.internal_code ? `[${w.internal_code}] ` : ""}${w.name}${w.vintage ? ` ${w.vintage}` : ""}`;

export function WinePicker({ wines, value, onChange, emptyLabel }: { wines: W[]; value: string; onChange: (id: string) => void; emptyLabel: string }) {
  const [open, setOpen] = useState(false);
  const cur = wines.find((w) => w.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-2 rounded border border-input bg-background px-2 py-1 text-left text-xs">
          <span className="truncate">{cur ? label(cur) : emptyLabel}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome, código ou produtor..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum rótulo encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__novo__" onSelect={() => { onChange(""); setOpen(false); }}>
                <Plus className="h-3 w-3" /> {emptyLabel}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Rótulos (A–Z)">
              {wines.map((w) => (
                <CommandItem key={w.id} value={`${label(w)} ${w.producer ?? ""} ${w.id}`} onSelect={() => { onChange(w.id); setOpen(false); }}>
                  <div className="min-w-0">
                    <div className="truncate text-xs">{label(w)}</div>
                    {w.producer && <div className="truncate text-[10px] text-muted-foreground">{w.producer}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
