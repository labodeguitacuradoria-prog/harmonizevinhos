import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { setActiveGroup, setActiveRestaurant, useActiveScope } from "@/lib/active-scope";
import { ChevronDown, Building2, Layers } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export default function RestaurantContextSwitcher() {
  const { memberships, groups, activeRole } = useAuth();
  const scope = useActiveScope();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (memberships.length === 0) return null;

  const active = memberships.find((m) => m.restaurantId === scope.activeRestaurantId);
  const activeGroup = groups.find((g) => g.id === scope.activeGroupId);

  // grupos onde o papel do usuário permite consolidado
  const eligibleGroupIds = new Set(
    memberships
      .filter((m) => (m.role === "rest_admin" || m.role === "rest_owner") && m.groupId)
      .map((m) => m.groupId!),
  );
  const visibleGroups = groups.filter((g) => eligibleGroupIds.has(g.id));

  function pickRestaurant(id: string) {
    setActiveRestaurant(id);
    setOpen(false);
    qc.invalidateQueries();
    router.invalidate();
  }
  function pickGroup(id: string) {
    setActiveGroup(id);
    setOpen(false);
    qc.invalidateQueries();
    router.invalidate();
  }

  const label = activeGroup
    ? `Rede: ${activeGroup.name}`
    : active
      ? active.name
      : "Selecione";

  return (
    <div ref={ref} className="relative border-b border-border px-3 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-left text-sm hover:border-primary"
      >
        <div className="flex items-center gap-2 truncate">
          {activeGroup ? (
            <Layers className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">{label}</div>
            {!activeGroup && active && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {activeRole === "rest_admin"
                  ? "Administrador"
                  : activeRole === "rest_owner"
                    ? "Chef / Owner"
                    : activeRole === "staff"
                      ? "Staff"
                      : activeRole ?? "—"}
              </div>
            )}
            {activeGroup && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Consolidado
              </div>
            )}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Restaurantes
          </div>
          {memberships.map((m) => (
            <button
              key={m.restaurantId}
              onClick={() => pickRestaurant(m.restaurantId)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                m.restaurantId === scope.activeRestaurantId && !scope.activeGroupId
                  ? "bg-accent text-primary"
                  : ""
              }`}
            >
              <span className="truncate">{m.name}</span>
              {m.city && <span className="text-[10px] text-muted-foreground">{m.city}</span>}
            </button>
          ))}
          {visibleGroups.length > 0 && (
            <>
              <div className="border-t border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Redes (consolidado)
              </div>
              {visibleGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => pickGroup(g.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                    g.id === scope.activeGroupId ? "bg-accent text-primary" : ""
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
