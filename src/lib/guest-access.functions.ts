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
    scope: "dashboard" | "stock_count" | "training" | "pairings";
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
  // Fichas de treinamento podem ser abertas em qualquer aparelho.
  // Visualização do administrador roda dentro de uma janela no computador.
  const isPreview = link.label.startsWith("__preview__");
  if (link.scope !== "training" && !isPreview) {
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
    .select("name, deleted_at")
    .eq("id", link.restaurant_id)
    .maybeSingle();

  if (!rest || rest.deleted_at) {
    throw new helpers.AccessLinkError("revoked", "Este acesso não está disponível.");
  }

  return {
    link: {
      id: link.id,
      restaurant_id: link.restaurant_id,
      label: link.label,
      scope: link.scope as "dashboard" | "stock_count" | "training" | "pairings",
      device_kind: link.device_kind as "mobile" | "desktop",
      single_device: link.single_device,
    },
    restaurantName: rest.name,
  };
}

function fail(e: unknown) {
  const code = (e as { code?: string })?.code ?? "invalid";
  const message = e instanceof Error ? e.message : "Link inválido.";
  return { ok: false as const, code, message };
}

function sessionDateBR(s?: { reference_date?: string | null; closed_at?: string | null } | null) {
  if (!s) return null;
  if (s.closed_at) {
    const d = new Date(s.closed_at);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
  }
  return s.reference_date ?? null;
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
            .select("id, reference_date, closed_at")
            .eq("restaurant_id", rid)
            .eq("status", "closed")
            .order("closed_at", { ascending: false, nullsFirst: false })
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
          lastCountDate: sessionDateBR(lastSession) ?? null,
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
        .select(
          "id, wine_id, previous_qty, counted_qty, flag, flag_note, wine:wines(name, producer, vintage, volume, internal_code, wine_type, image_url)",
        )
        .eq("session_id", session.id);

      const rows = (items ?? []).map((i: any) => ({
        id: i.id as string,
        wine_id: i.wine_id as string,
        previous_qty: i.previous_qty as number,
        counted_qty: i.counted_qty as number | null,
        flag: (i.flag ?? null) as string | null,
        flag_note: (i.flag_note ?? null) as string | null,
        name: i.wine?.name ?? "—",
        producer: i.wine?.producer ?? null,
        vintage: i.wine?.vintage ?? null,
        volume: i.wine?.volume ?? null,
        internal_code: i.wine?.internal_code ?? null,
        wine_type: i.wine?.wine_type ?? null,
        image_url: i.wine?.image_url ?? null,
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      const { data: issues } = await supabaseAdmin
        .from("stock_count_issues")
        .select("id, description, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false });

      return {
        ok: true as const,
        restaurantName,
        label: link.label,
        session,
        items: rows,
        issues: (issues ?? []).map((x: any) => ({
          id: x.id as string,
          description: x.description as string,
        })),
      };
    } catch (e) {
      return fail(e);
    }
  });

// Sinaliza um problema em um rótulo específico (rótulo errado, duplicado etc.)
export const saveGuestFlag = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    TokenSchema.extend({
      item_id: z.string().uuid(),
      flag: z.string().max(40).nullable(),
      note: z.string().max(500).nullable().optional(),
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
        .update({ flag: data.flag, flag_note: data.note || null })
        .eq("id", data.item_id);
      if (error) return fail({ code: "save", message: error.message });
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

// Observação geral da contagem (falta um rótulo, rótulo errado etc.)
export const saveGuestIssue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    TokenSchema.extend({
      session_id: z.string().uuid(),
      description: z.string().trim().min(3).max(1000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { link } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "stock_count") return fail({ code: "scope", message: "Link sem permissão para a contagem." });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: session } = await supabaseAdmin
        .from("stock_count_sessions")
        .select("id, restaurant_id, status")
        .eq("id", data.session_id)
        .maybeSingle();
      if (!session || session.restaurant_id !== link.restaurant_id || session.status !== "draft") {
        return fail({ code: "invalid", message: "Contagem não disponível." });
      }
      const { error } = await supabaseAdmin
        .from("stock_count_issues")
        .insert({ session_id: data.session_id, description: data.description });
      if (error) return fail({ code: "save", message: error.message });
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

// Encerra a contagem aberta pelo link, gerando os ajustes de estoque.
export const closeGuestCount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.extend({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { link } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "stock_count") return fail({ code: "scope", message: "Link sem permissão para a contagem." });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: session } = await supabaseAdmin
        .from("stock_count_sessions")
        .select("id, restaurant_id, status, reference_date")
        .eq("id", data.session_id)
        .maybeSingle();
      if (!session || session.restaurant_id !== link.restaurant_id || session.status !== "draft") {
        return fail({ code: "invalid", message: "Contagem não disponível." });
      }

      const { data: items } = await supabaseAdmin
        .from("stock_count_items")
        .select("wine_id, previous_qty, counted_qty, flag")
        .eq("session_id", session.id);

      const pending = (items ?? []).filter((i: any) => i.counted_qty === null && !i.flag);
      if (pending.length > 0) {
        return fail({ code: "pending", message: `${pending.length} rótulo(s) ainda sem contagem.` });
      }

      const adjustments = (items ?? [])
        .filter((i: any) => i.counted_qty !== null && i.flag !== "duplicate" && i.flag !== "should_not_count")
        .map((i: any) => ({ ...i, diff: (i.counted_qty as number) - (i.previous_qty as number) }))
        .filter((i: any) => i.diff !== 0)
        .map((i: any) => ({
          wine_id: i.wine_id as string,
          restaurant_id: link.restaurant_id,
          movement_type: "adjustment" as const,
          quantity: i.diff as number,
          notes: `Ajuste por contagem (${session.reference_date})`,
          source_session_id: session.id,
        }));

      if (adjustments.length > 0) {
        const { error } = await supabaseAdmin.from("inventory_movements").insert(adjustments);
        if (error) return fail({ code: "save", message: error.message });
      }

      const { error: errClose } = await supabaseAdmin
        .from("stock_count_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", session.id);
      if (errClose) return fail({ code: "save", message: errClose.message });
      return { ok: true as const, adjustments: adjustments.length };
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
            .select("id, reference_date, closed_at")
            .eq("restaurant_id", rid)
            .eq("status", "closed")
            .order("closed_at", { ascending: false, nullsFirst: false })
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
        stock: {
          map: stockMap,
          lastDate: sessionDateBR(lastSession) ?? null,
          history: await (await import("@/lib/stock-history")).fetchStockHistory(supabaseAdmin, [rid], new Date()),
        },
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

/** Fichas rápidas publicadas, para o link de treinamento do staff. */
export const getGuestTrainingCards = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { token?: string; kind?: string })
  .handler(async ({ data }) => {
    try {
      const parsed = TokenSchema.safeParse(data);
      if (!parsed.success) {
        return fail({ code: "invalid", message: "Link inválido ou incompleto." });
      }
      const { link, restaurantName } = await resolveAccess(parsed.data.token, parsed.data.kind);
      if (link.scope !== "training") {
        return fail({ code: "scope", message: "Link sem permissão para as fichas de treinamento." });
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: cards } = await supabaseAdmin
        .from("wine_story_cards")
        .select(
          "wine_id, compact_summary, grapes_line, making_line, origin_story, name_meaning, mouthfeel, pairings, sales_pitch, fun_fact, do_not_confuse, image_url, video_paths, video_published, video_status, video_script",
        )
        .eq("restaurant_id", link.restaurant_id)
        .eq("status", "published");

      const ids = (cards ?? []).map((c) => c.wine_id);
      if (!ids.length) {
        const { data: choices } = await supabaseAdmin.from("restaurant_training_videos").select("training_library_videos(id, title, category, description, video_url, sort_order)").eq("restaurant_id", link.restaurant_id).eq("enabled", true);
        const fundamentals = (choices ?? []).map((choice: any) => choice.training_library_videos).filter(Boolean).sort((a: any, b: any) => a.sort_order - b.sort_order);
        return { ok: true as const, restaurantName, linkId: link.id, cards: [], fundamentals };
      }

      const { data: wines } = await supabaseAdmin
        .from("wines")
        .select("id, name, internal_code, style, wine_type, region, country, sale_price, image_url, vintage, producer, volume, videos")
        .eq("restaurant_id", link.restaurant_id)
        .in("id", ids);

      const byId = new Map((wines ?? []).map((w) => [w.id, w]));
      const list = (cards ?? [])
        .map((c) => {
          const w = byId.get(c.wine_id);
          if (!w) return null;
          return {
            wine_id: c.wine_id,
            name: w.name as string,
            internal_code: (w.internal_code as string | null) ?? null,
            style: (w.style as string | null) ?? null,
            wine_type: (w.wine_type as string | null) ?? null,
            country: (w.country as string | null) ?? null,
            region: (w.region as string | null) ?? null,
            producer: (w.producer as string | null) ?? null,
            vintage: (w.vintage as number | null) ?? null,
            volume: (w.volume as string | null) ?? null,
            image_url: c.image_url || w.image_url
              ? `/api/public/training-image?token=${encodeURIComponent(parsed.data.token)}&wine=${encodeURIComponent(c.wine_id)}`
              : null,
            sale_price: Number(w.sale_price ?? 0),
            video_links: (Array.isArray(w.videos) ? (w.videos as { title?: string; url?: string }[]) : [])
              .filter((v) => typeof v?.url === "string" && v.url.trim().length > 0)
              .map((v, idx) => ({ title: v.title?.trim() || `Vídeo ${idx + 1}`, url: v.url as string })),
            compact_summary: c.compact_summary,
            grapes_line: c.grapes_line,
            making_line: c.making_line,
            origin_story: c.origin_story,
            name_meaning: c.name_meaning,
            mouthfeel: c.mouthfeel,
            pairings: (c.pairings ?? []) as string[],
            sales_pitch: c.sales_pitch,
            fun_fact: c.fun_fact,
            do_not_confuse: c.do_not_confuse,
            video_status: c.video_status,
            video_captions: c.video_published
              ? (
                  ((c.video_script as { scenes?: { caption?: string }[] } | null)?.scenes ?? []) as {
                    caption?: string;
                  }[]
                ).map((s) => s.caption ?? "")
              : [],
            video_urls: c.video_published
              ? ((c.video_paths ?? []) as string[]).map(
                  (path) => `/api/public/training-video?token=${encodeURIComponent(parsed.data.token)}&path=${encodeURIComponent(path)}`,
                )
              : [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a as { name: string }).name.localeCompare((b as { name: string }).name));

      const { data: choices } = await supabaseAdmin.from("restaurant_training_videos").select("training_library_videos(id, title, category, description, video_url, sort_order)").eq("restaurant_id", link.restaurant_id).eq("enabled", true);
      const fundamentals = (choices ?? []).map((choice: any) => choice.training_library_videos).filter(Boolean).sort((a: any, b: any) => a.sort_order - b.sort_order);
      return { ok: true as const, restaurantName, linkId: link.id, cards: list, fundamentals };
    } catch (e) {
      return fail(e);
    }
  });

/** Harmonizações publicadas para o link mobile do staff. */
export const getGuestMenuPairings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { token?: string; kind?: string })
  .handler(async ({ data }) => {
    try {
      const parsed = TokenSchema.safeParse(data);
      if (!parsed.success) {
        return fail({ code: "invalid", message: "Link inválido ou incompleto." });
      }
      const { link, restaurantName } = await resolveAccess(parsed.data.token, parsed.data.kind);
      if (link.scope !== "pairings") {
        return fail({ code: "scope", message: "Link sem permissão para as harmonizações." });
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: guide } = await supabaseAdmin
        .from("restaurant_menu_pairing_guides")
        .select("title, dishes, results, published_at, updated_at")
        .eq("restaurant_id", link.restaurant_id)
        .maybeSingle();

      return {
        ok: true as const,
        restaurantName,
        linkId: link.id,
        title: guide?.title ?? "Harmonizações do cardápio",
        dishes: Array.isArray(guide?.dishes) ? guide.dishes : [],
        results: Array.isArray(guide?.results) ? guide.results : [],
        published_at: guide?.published_at ?? null,
        updated_at: guide?.updated_at ?? null,
      };
    } catch (e) {
      return fail(e);
    }
  });

/** Guarda a pontuação de um desafio feito pelo staff (sem dados pessoais). */
export const saveGuestQuizAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    TokenSchema.extend({
      score: z.number().int().min(0).max(100),
      total: z.number().int().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { link } = await resolveAccess(data.token, data.kind);
      if (link.scope !== "training") {
        return fail({ code: "scope", message: "Link sem permissão para o desafio." });
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("training_quiz_attempts").insert({
        restaurant_id: link.restaurant_id,
        link_id: link.id,
        score: data.score,
        total: data.total,
      });
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

/** Livro de Estudos publicado (índice + endereço do PDF) para o link de treinamento. */
export const getGuestTrainingBook = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { token?: string; kind?: string })
  .handler(async ({ data }) => {
    try {
      const parsed = TokenSchema.safeParse(data);
      if (!parsed.success) return fail({ code: "invalid", message: "Link inválido ou incompleto." });
      const { link, restaurantName } = await resolveAccess(parsed.data.token, parsed.data.kind);
      if (link.scope !== "training") return fail({ code: "scope", message: "Link sem permissão para o livro de estudos." });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: book } = await supabaseAdmin
        .from("training_books")
        .select("title, book_index, pdf_path, published_at")
        .eq("restaurant_id", link.restaurant_id)
        .maybeSingle();
      return {
        ok: true as const,
        restaurantName,
        book: book?.pdf_path
          ? {
              title: book.title as string,
              publishedAt: book.published_at as string | null,
              index: (book.book_index ?? []) as { producer: string; page: number; wines: { id: string; name: string; page: number }[] }[],
            }
          : null,
      };
    } catch (e) {
      return fail(e);
    }
  });
