import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenSchema = z.object({
  token: z.string().trim().min(10).max(200),
  kind: z.enum(["celular", "desktop"]).optional(),
});

type Resolved = {
  link: {
    id: string;
    restaurant_id: string;
    label: string;
    scope: "dashboard" | "stock_count";
    device_kind: "mobile" | "desktop";
    single_device: boolean;
  };
  restaurantName: string;
};

async function resolveAccess(token: string, kind?: "celular" | "desktop"): Promise<Resolved> {
  const helpers = await import("@/lib/access-links.server");
  const { getCookie, setCookie, getRequestHeader } = await import("@tanstack/react-start/server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tokenHash = helpers.hashToken(token);
  const { data: link } = await supabaseAdmin
    .from("access_links")
    .select("id, restaurant_id, label, scope, device_kind, single_device, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link) throw new helpers.AccessLinkError("invalid", "Link inválido.");
  if (link.revoked_at) throw new helpers.AccessLinkError("revoked", "Este link foi revogado pelo restaurante.");
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    throw new helpers.AccessLinkError("expired", "Este link expirou. Peça um novo ao restaurante.");
  }

  const userAgent = getRequestHeader("user-agent") ?? "";
  const detected = helpers.detectDeviceKind(userAgent);
  if (kind) {
    const requested = kind === "celular" ? "mobile" : "desktop";
    if (requested !== link.device_kind) throw new helpers.AccessLinkError("invalid", "Link inválido.");
  }
  if (detected !== link.device_kind) {
    throw new helpers.AccessLinkError(
      "device_kind",
      link.device_kind === "mobile"
        ? "Este link é de uso exclusivo no celular. Abra-o no celular indicado."
        : "Este link é de uso exclusivo no computador. Abra-o no computador indicado.",
    );
  }

  const cookieName = helpers.cookieNameFor(link.id);
  let deviceId = helpers.verifyDeviceCookie(getCookie(cookieName));

  const { data: devices } = await supabaseAdmin
    .from("access_link_devices")
    .select("id, device_hash, user_agent")
    .eq("link_id", link.id);

  const known = devices ?? [];
  let deviceRowId: string | null = null;
  if (deviceId) {
    const h = helpers.hashDeviceId(deviceId);
    deviceRowId = known.find((d) => d.device_hash === h)?.id ?? null;
    if (!deviceRowId) deviceId = null;
  }

  const uaKey = userAgent.slice(0, 400);
  // Assinatura tolerante do navegador: ignora números de versão, que mudam a
  // cada atualização do celular/navegador e não significam outro aparelho.
  const uaFingerprint = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\d._]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const fp = uaFingerprint(uaKey);

  const rebind = async (rowId: string) => {
    deviceRowId = rowId;
    const renewedId = helpers.newDeviceId();
    await supabaseAdmin
      .from("access_link_devices")
      .update({ device_hash: helpers.hashDeviceId(renewedId), user_agent: uaKey })
      .eq("id", rowId);
    setCookie(cookieName, helpers.signDeviceId(renewedId), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  };

  // O cookie de aparelho pode se perder (nova versão do app, atualização do
  // navegador, limpeza de dados, aba privada). Nesses casos reconhecemos o
  // mesmo aparelho pelo próprio navegador em vez de bloquear o acesso.
  if (!deviceRowId && uaKey) {
    const exact = known.find((d) => (d.user_agent ?? "") === uaKey);
    const fuzzy = exact ?? known.find((d) => uaFingerprint(d.user_agent ?? "") === fp);
    if (fuzzy) await rebind(fuzzy.id);
  }

  // Último recurso para links de aparelho único: se existe apenas um aparelho
  // vinculado, tratamos este acesso como o mesmo aparelho e revinculamos, para
  // que atualizações do aplicativo nunca derrubem o link já enviado.
  if (!deviceRowId && link.single_device && known.length === 1) {
    await rebind(known[0].id);
  }

  if (!deviceRowId) {
    if (link.single_device && known.length > 0) {
      throw new helpers.AccessLinkError(
        "locked",
        "Este link já está em uso em outro aparelho. Peça ao restaurante para desvincular o aparelho anterior.",
      );
    }

    const newId = helpers.newDeviceId();
    const { data: inserted } = await supabaseAdmin
      .from("access_link_devices")
      .insert({
        link_id: link.id,
        device_hash: helpers.hashDeviceId(newId),
        user_agent: uaKey,
      })
      .select("id")
      .single();
    deviceRowId = inserted?.id ?? null;
    setCookie(cookieName, helpers.signDeviceId(newId), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  } else {
    await supabaseAdmin
      .from("access_link_devices")
      .update({ last_seen_at: new Date().toISOString(), user_agent: uaKey })
      .eq("id", deviceRowId);
  }


  await supabaseAdmin
    .from("access_links")
    .update({ last_access_at: new Date().toISOString() })
    .eq("id", link.id);

  const { data: rest } = await supabaseAdmin
    .from("restaurants")
    .select("name")
    .eq("id", link.restaurant_id)
    .maybeSingle();

  return {
    link: {
      id: link.id,
      restaurant_id: link.restaurant_id,
      label: link.label,
      scope: link.scope as "dashboard" | "stock_count",
      device_kind: link.device_kind as "mobile" | "desktop",
      single_device: link.single_device,
    },
    restaurantName: rest?.name ?? "Restaurante",
  };
}

function fail(e: unknown) {
  const code = (e as { code?: string })?.code ?? "invalid";
  const message = e instanceof Error ? e.message : "Link inválido.";
  return { ok: false as const, code, message };
}

export const openAccessLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { link, restaurantName } = await resolveAccess(data.token, data.kind);
      return { ok: true as const, scope: link.scope, label: link.label, restaurantName };
    } catch (e) {
      return fail(e);
    }
  });

const isGlassVol = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);

export const getGuestDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { link, restaurantName } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "dashboard") return fail({ code: "scope", message: "Link sem permissão para o painel." });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rid = link.restaurant_id;

      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;

      const [{ data: wines }, { data: sessions }, { data: movements }, { data: corkage }, { data: targets }] =
        await Promise.all([
          supabaseAdmin.from("wines").select("id, volume, cost_price, sale_price").eq("restaurant_id", rid),
          supabaseAdmin
            .from("stock_count_sessions")
            .select("id, reference_date")
            .eq("restaurant_id", rid)
            .eq("status", "closed")
            .order("reference_date", { ascending: false })
            .limit(1),
          supabaseAdmin
            .from("inventory_movements")
            .select("wine_id, quantity, unit_price, unit_cost, occurred_at")
            .eq("restaurant_id", rid)
            .eq("movement_type", "sale")
            .gte("occurred_at", new Date(Date.UTC(previousYear, 0, 1)).toISOString()),
          supabaseAdmin
            .from("corkage_fees")
            .select("reference_year, reference_month, quantity, total_amount")
            .eq("restaurant_id", rid)
            .in("reference_year", [currentYear, previousYear]),
          supabaseAdmin
            .from("dashboard_targets")
            .select("indicator, reference_month, target_value")
            .eq("restaurant_id", rid)
            .eq("reference_year", currentYear),
        ]);

      const wineById = new Map((wines ?? []).map((w) => [w.id, w]));

      const zeros = () => Array(12).fill(0) as number[];
      const rev = { [currentYear]: zeros(), [previousYear]: zeros() } as Record<number, number[]>;
      const bottles = { [currentYear]: zeros(), [previousYear]: zeros() } as Record<number, number[]>;
      const glasses = { [currentYear]: zeros(), [previousYear]: zeros() } as Record<number, number[]>;
      const revWine = { [currentYear]: zeros(), [previousYear]: zeros() } as Record<number, number[]>;
      const costWine = { [currentYear]: zeros(), [previousYear]: zeros() } as Record<number, number[]>;

      for (const m of movements ?? []) {
        const d = new Date(m.occurred_at);
        const y = d.getFullYear();
        const mo = d.getMonth();
        if (y !== currentYear && y !== previousYear) continue;
        const w = wineById.get(m.wine_id);
        const price = Number(m.unit_price ?? w?.sale_price ?? 0);
        const cost = Number(m.unit_cost ?? 0) > 0 ? Number(m.unit_cost) : Number(w?.cost_price ?? 0) || 0;
        const q = m.quantity ?? 0;
        const r = price * q;
        rev[y][mo] += r;
        revWine[y][mo] += r;
        costWine[y][mo] += cost * q;
        if (w && isGlassVol(w.volume)) glasses[y][mo] += q;
        else bottles[y][mo] += q;
      }
      for (const c of corkage ?? []) {
        const y = c.reference_year;
        if (y !== currentYear && y !== previousYear) continue;
        rev[y][(c.reference_month || 1) - 1] += Number(c.total_amount || 0);
      }

      const cmv = (y: number) =>
        revWine[y].map((r, i) => (r > 0 ? (costWine[y][i] / r) * 100 : 0));
      const avgPrice = (y: number) =>
        revWine[y].map((r, i) => {
          const q = bottles[y][i] + glasses[y][i];
          return q > 0 ? r / q : 0;
        });

      let stockBottles = 0;
      let stockValue = 0;
      const lastSession = (sessions ?? [])[0] ?? null;
      if (lastSession) {
        const { data: items } = await supabaseAdmin
          .from("stock_count_items")
          .select("wine_id, counted_qty")
          .eq("session_id", lastSession.id);
        for (const it of items ?? []) {
          const w = wineById.get(it.wine_id);
          if (!w || isGlassVol(w.volume)) continue;
          const q = it.counted_qty ?? 0;
          stockBottles += q;
          stockValue += q * (Number(w.sale_price) || 0);
        }
      }

      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
      const costTotal = sum(costWine[currentYear]);
      const revWineTotal = sum(revWine[currentYear]);

      return {
        ok: true as const,
        restaurantName,
        label: link.label,
        currentYear,
        previousYear,
        series: {
          revenue: { current: rev[currentYear], previous: rev[previousYear] },
          bottles: { current: bottles[currentYear], previous: bottles[previousYear] },
          glasses: { current: glasses[currentYear], previous: glasses[previousYear] },
          avgPrice: { current: avgPrice(currentYear), previous: avgPrice(previousYear) },
          cmv: { current: cmv(currentYear), previous: cmv(previousYear) },
        },
        totals: {
          revenueYear: sum(rev[currentYear]),
          revenuePrevYear: sum(rev[previousYear]),
          bottlesYear: sum(bottles[currentYear]),
          glassesYear: sum(glasses[currentYear]),
          avgPriceYear:
            sum(bottles[currentYear]) + sum(glasses[currentYear]) > 0
              ? revWineTotal / (sum(bottles[currentYear]) + sum(glasses[currentYear]))
              : 0,
          cmvYear: revWineTotal > 0 ? (costTotal / revWineTotal) * 100 : 0,
          stockBottles,
          stockValue,
          lastCountDate: lastSession?.reference_date ?? null,
        },
        targets: (targets ?? []).map((t) => ({
          indicator: t.indicator,
          month: t.reference_month,
          value: Number(t.target_value),
        })),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const getGuestStockSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { link, restaurantName } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "stock_count") return fail({ code: "scope", message: "Link sem permissão para a contagem." });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      let { data: session } = await supabaseAdmin
        .from("stock_count_sessions")
        .select("id, reference_date, status")
        .eq("restaurant_id", link.restaurant_id)
        .eq("status", "draft")
        .order("reference_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Se não houver contagem aberta, o próprio acesso pelo link já significa
      // uma nova contagem: cria a sessão e os itens automaticamente.
      if (!session) {
        const isGlass = (v: string | null | undefined) => {
          const s = (v ?? "").toLowerCase();
          return s.includes("taça") || s.includes("taca");
        };
        const { data: wines } = await supabaseAdmin
          .from("wines")
          .select("id, volume, count_in_stock")
          .eq("restaurant_id", link.restaurant_id);
        const countable = (wines ?? []).filter(
          (w: any) => !isGlass(w.volume) && w.count_in_stock !== false,
        );
        if (countable.length === 0) {
          return { ok: true as const, restaurantName, label: link.label, session: null, items: [] };
        }
        const { data: lastStock } = await supabaseAdmin.rpc("get_last_closed_stock", {
          p_restaurant_id: link.restaurant_id,
        });
        const prev: Record<string, number> = {};
        (lastStock ?? []).forEach((r: any) => {
          prev[r.wine_id] = r.last_qty;
        });
        const { data: created, error: errSession } = await supabaseAdmin
          .from("stock_count_sessions")
          .insert({ restaurant_id: link.restaurant_id })
          .select("id, reference_date, status")
          .single();
        if (errSession || !created) {
          return fail({ code: "session", message: errSession?.message ?? "Não foi possível abrir a contagem." });
        }
        const { error: errItems } = await supabaseAdmin.from("stock_count_items").insert(
          countable.map((w: any) => ({
            session_id: created.id,
            wine_id: w.id,
            previous_qty: prev[w.id] ?? 0,
          })),
        );
        if (errItems) return fail({ code: "items", message: errItems.message });
        session = created;
      }


      const { data: items } = await supabaseAdmin
        .from("stock_count_items")
        .select("id, wine_id, previous_qty, counted_qty, wine:wines(name, producer, vintage, volume, internal_code)")
        .eq("session_id", session.id);

      const rows = (items ?? []).map((i: any) => ({
        id: i.id as string,
        previous_qty: i.previous_qty as number,
        counted_qty: i.counted_qty as number | null,
        name: i.wine?.name ?? "—",
        producer: i.wine?.producer ?? null,
        vintage: i.wine?.vintage ?? null,
        volume: i.wine?.volume ?? null,
        internal_code: i.wine?.internal_code ?? null,
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      return { ok: true as const, restaurantName, label: link.label, session, items: rows };
    } catch (e) {
      return fail(e);
    }
  });

export const saveGuestCount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    TokenSchema.extend({
      item_id: z.string().uuid(),
      qty: z.number().int().min(0).max(1000000).nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { link } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "stock_count") return fail({ code: "scope", message: "Link sem permissão para a contagem." });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: item } = await supabaseAdmin
        .from("stock_count_items")
        .select("id, session:stock_count_sessions(restaurant_id, status)")
        .eq("id", data.item_id)
        .maybeSingle();

      const session = (item as any)?.session;
      if (!item || !session || session.restaurant_id !== link.restaurant_id || session.status !== "draft") {
        return fail({ code: "invalid", message: "Item não disponível para contagem." });
      }

      const { error } = await supabaseAdmin
        .from("stock_count_items")
        .update({
          counted_qty: data.qty,
          counted_at: data.qty === null ? null : new Date().toISOString(),
        })
        .eq("id", data.item_id);
      if (error) return fail({ code: "save", message: error.message });
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

// Retorna as MESMAS linhas cruas que o painel autenticado consome, para que a
// tela aberta pelo link renderize o painel completo (KPIs, gráficos, metas,
// diagnóstico) em modo somente leitura.
export const getGuestDashboardData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { link, restaurantName } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "dashboard") {
        return fail({ code: "scope", message: "Link sem permissão para o painel." });
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rid = link.restaurant_id;
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const [{ data: wines }, { data: sessions }, { data: movements }, { data: corkage }, { data: targets }] =
        await Promise.all([
          supabaseAdmin
            .from("wines")
            .select("id,name,wine_type,volume,country,producer,cost_price,sale_price,active_on_menu")
            .eq("restaurant_id", rid),
          supabaseAdmin
            .from("stock_count_sessions")
            .select("id, reference_date")
            .eq("restaurant_id", rid)
            .eq("status", "closed")
            .order("reference_date", { ascending: false })
            .limit(1),
          supabaseAdmin
            .from("inventory_movements")
            .select("wine_id, quantity, unit_price, unit_cost, occurred_at")
            .eq("restaurant_id", rid)
            .eq("movement_type", "sale")
            .gte("occurred_at", new Date(Date.UTC(previousYear, 0, 1)).toISOString()),
          supabaseAdmin
            .from("corkage_fees")
            .select("reference_year, reference_month, quantity, total_amount")
            .eq("restaurant_id", rid)
            .in("reference_year", [currentYear, previousYear]),
          supabaseAdmin
            .from("dashboard_targets")
            .select("id, indicator, reference_year, reference_month, target_value")
            .eq("restaurant_id", rid)
            .eq("reference_year", currentYear),
        ]);

      const lastSession = (sessions ?? [])[0] ?? null;
      const stockMap: Record<string, number> = {};
      if (lastSession) {
        const { data: items } = await supabaseAdmin
          .from("stock_count_items")
          .select("wine_id, counted_qty")
          .eq("session_id", lastSession.id);
        for (const it of items ?? []) {
          stockMap[it.wine_id] = (stockMap[it.wine_id] ?? 0) + (it.counted_qty ?? 0);
        }
      }

      return {
        ok: true as const,
        restaurantName,
        label: link.label,
        wines: wines ?? [],
        movements: movements ?? [],
        corkage: (corkage ?? []).map((c) => ({
          reference_year: c.reference_year,
          reference_month: c.reference_month,
          quantity: Number(c.quantity ?? 0),
          total_amount: Number(c.total_amount ?? 0),
        })),
        stock: { map: stockMap, lastDate: lastSession?.reference_date ?? null },
        targets: (targets ?? []).map((t) => ({
          id: t.id as string,
          indicator: t.indicator as string,
          reference_year: t.reference_year as number,
          reference_month: t.reference_month as number | null,
          target_value: Number(t.target_value),
        })),
      };
    } catch (e) {
      return fail(e);
    }
  });
