import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createManualAccessInvite } from "@/lib/access-invite.server";

const roleValues = ["rest_owner", "staff", "supplier"] as const;
const adminRoleValues = ["rest_admin", "rest_owner", "staff", "supplier"] as const;

async function assertCanManage(context: any, restaurantId: string) {
  const { data: ok } = await context.supabase.rpc("can_manage_restaurant", {
    _user_id: context.userId,
    _restaurant_id: restaurantId,
  });
  if (!ok) throw new Error("Forbidden");
}
async function assertAdmin(context: any) {
  const { data: ok } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!ok) throw new Error("Forbidden");
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().max(120).optional().nullable(),
  group_id: z.string().uuid().nullable().optional(),
  new_group_name: z.string().trim().max(120).nullable().optional(),
});

export const createRestaurantWithAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let groupId: string | null = data.group_id ?? null;
    if (!groupId && data.new_group_name && data.new_group_name.trim()) {
      const { data: g, error: gErr } = await supabaseAdmin
        .from("restaurant_groups")
        .insert({ name: data.new_group_name.trim(), owner_id: context.userId })
        .select("id")
        .single();
      if (gErr) throw new Error(gErr.message);
      groupId = g.id;
    }
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .insert({
        name: data.name,
        city: data.city ?? null,
        owner_id: context.userId,
        group_id: groupId,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      role: "rest_admin",
      restaurant_id: rest.id,
    });
    return { id: rest.id, group_id: groupId };
  });

const InviteSchema = z
  .object({
    restaurant_id: z.string().uuid(),
    email: z.string().trim().email(),
    role: z.enum(roleValues),
    supplier_id: z.string().uuid().optional().nullable(),
    redirect_origin: z.string().url().optional().nullable(),
  })
  .refine((d) => d.role !== "supplier" || !!d.supplier_id, {
    message: "Selecione o fornecedor",
    path: ["supplier_id"],
  });

export const inviteRestaurantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se for fornecedor, valida que o supplier está ligado a este restaurante
    // (via restaurant_supplier_access ou via wines.supplier_id).
    if (data.role === "supplier") {
      const selectedSupplierId = data.supplier_id;
      if (!selectedSupplierId) throw new Error("Selecione o fornecedor");
      const [{ data: acc }, { data: wineSup }] = await Promise.all([
        supabaseAdmin
          .from("restaurant_supplier_access")
          .select("supplier_id")
          .eq("restaurant_id", data.restaurant_id)
          .eq("supplier_id", selectedSupplierId)
          .maybeSingle(),
        supabaseAdmin
          .from("wines")
          .select("supplier_id")
          .eq("restaurant_id", data.restaurant_id)
          .eq("supplier_id", selectedSupplierId)
          .limit(1)
          .maybeSingle(),
      ]);
      if (!acc && !wineSup) {
        throw new Error("Fornecedor não vinculado a este restaurante.");
      }
    }

    const invite = await createManualAccessInvite(
      supabaseAdmin,
      data.email,
      data.redirect_origin,
    );

    await supabaseAdmin.from("profiles").upsert({ id: invite.user_id, email: invite.email });

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: invite.user_id,
      role: data.role,
      restaurant_id: data.restaurant_id,
      supplier_id: data.role === "supplier" ? data.supplier_id ?? null : null,
    });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }

    if (data.role === "supplier") {
      const selectedSupplierId = data.supplier_id;
      if (!selectedSupplierId) throw new Error("Selecione o fornecedor");
      await supabaseAdmin.from("restaurant_supplier_access").upsert(
        {
          restaurant_id: data.restaurant_id,
          supplier_id: selectedSupplierId,
          enabled: true,
        },
        { onConflict: "restaurant_id,supplier_id" },
      );
    }
    return invite;
  });

const RemoveSchema = z.object({ user_role_id: z.string().uuid() });

export const removeRestaurantAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, restaurant_id")
      .eq("id", data.user_role_id)
      .single();
    if (error || !row) throw new Error("Vínculo não encontrado");
    if (!row.restaurant_id) throw new Error("Vínculo inválido");
    await assertCanManage(context, row.restaurant_id);
    // impedir remover o último rest_admin
    if (row.role === "rest_admin") {
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("restaurant_id", row.restaurant_id)
        .eq("role", "rest_admin");
      if ((admins?.length ?? 0) <= 1) {
        throw new Error("Não é possível remover o último administrador da unidade.");
      }
    }
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("id", data.user_role_id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

const ListSchema = z.object({ restaurant_id: z.string().uuid() });

export const listRestaurantAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, supplier_id, created_at")
      .eq("restaurant_id", data.restaurant_id);
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const supIds = Array.from(
      new Set((rows ?? []).map((r) => r.supplier_id).filter(Boolean) as string[]),
    );
    const profiles: Record<string, { email: string | null; full_name: string | null }> = {};
    const suppliers: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: pRows } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      for (const p of pRows ?? []) {
        profiles[p.id] = { email: p.email, full_name: p.full_name };
      }
    }
    if (supIds.length > 0) {
      const { data: sRows } = await supabaseAdmin
        .from("suppliers")
        .select("id, name")
        .in("id", supIds);
      for (const s of sRows ?? []) suppliers[s.id] = s.name;
    }
    return (rows ?? []).map((r) => ({
      user_role_id: r.id,
      user_id: r.user_id,
      role: r.role,
      created_at: r.created_at,
      email: profiles[r.user_id]?.email ?? null,
      full_name: profiles[r.user_id]?.full_name ?? null,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_id ? suppliers[r.supplier_id] ?? null : null,
    }));
  });

export const listAllAccessMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, restaurant_id, supplier_id, created_at")
      .order("created_at", { ascending: false });
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const restIds = Array.from(
      new Set((rows ?? []).map((r) => r.restaurant_id).filter(Boolean) as string[]),
    );
    const [profRes, restRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      restIds.length
        ? supabaseAdmin
            .from("restaurants")
            .select("id, name, city, group_id, cnpj")
            .in("id", restIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profiles: Record<string, any> = {};
    for (const p of profRes.data ?? []) profiles[p.id] = p;
    const restaurants: Record<string, any> = {};
    for (const r of restRes.data ?? []) restaurants[r.id] = r;
    return (rows ?? []).map((r) => ({
      user_role_id: r.id,
      user_id: r.user_id,
      email: profiles[r.user_id]?.email ?? null,
      full_name: profiles[r.user_id]?.full_name ?? null,
      role: r.role,
      restaurant_id: r.restaurant_id,
      restaurant_name: r.restaurant_id ? restaurants[r.restaurant_id]?.name ?? null : null,
      restaurant_cnpj: r.restaurant_id ? restaurants[r.restaurant_id]?.cnpj ?? null : null,
      supplier_id: r.supplier_id,
      created_at: r.created_at,
    }));
  });

const AdminInviteSchema = z.object({
  restaurant_id: z.string().uuid(),
  email: z.string().trim().email(),
  role: z.enum(adminRoleValues),
  redirect_origin: z.string().url().optional().nullable(),
});

export const adminInviteAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdminInviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const invite = await createManualAccessInvite(
      supabaseAdmin,
      data.email,
      data.redirect_origin,
    );
    await supabaseAdmin.from("profiles").upsert({ id: invite.user_id, email: invite.email });
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: invite.user_id,
      role: data.role,
      restaurant_id: data.restaurant_id,
    });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }
    return invite;
  });

export const adminRemoveAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("id", data.user_role_id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Gestão de acessos existentes (alterar papel, senha, e-mail, reenviar convite)
// ---------------------------------------------------------------------------

const ChangeRoleSchema = z.object({
  user_role_id: z.string().uuid(),
  role: z.enum(adminRoleValues),
  supplier_id: z.string().uuid().nullable().optional(),
});

/** Altera o papel de um vínculo. Gestores do restaurante ou admin global. */
export const changeAccessRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChangeRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, restaurant_id")
      .eq("id", data.user_role_id)
      .maybeSingle();
    if (!row) throw new Error("Vínculo não encontrado");
    if (row.role === "admin") throw new Error("Não é possível alterar o admin global");

    const { data: isAdmin } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) {
      if (!row.restaurant_id) throw new Error("Forbidden");
      await assertCanManage(context, row.restaurant_id);
      if (data.role === "rest_admin") throw new Error("Somente o admin global define administradores");
    }
    if (data.role === "supplier" && !data.supplier_id) throw new Error("Selecione o fornecedor");

    // impedir deixar a unidade sem administrador
    if (row.role === "rest_admin" && data.role !== "rest_admin" && row.restaurant_id) {
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("restaurant_id", row.restaurant_id)
        .eq("role", "rest_admin");
      if ((admins?.length ?? 0) <= 1) {
        throw new Error("Não é possível remover o último administrador da unidade.");
      }
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({
        role: data.role,
        supplier_id: data.role === "supplier" ? data.supplier_id! : null,
      })
      .eq("id", data.user_role_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ResetSchema = z.object({ user_role_id: z.string().uuid() });

/** Envia e-mail de redefinição de senha ao usuário do vínculo. */
export const sendAccessPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, restaurant_id")
      .eq("id", data.user_role_id)
      .maybeSingle();
    if (!row) throw new Error("Vínculo não encontrado");
    const { data: isAdmin } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) {
      if (!row.restaurant_id) throw new Error("Forbidden");
      await assertCanManage(context, row.restaurant_id);
    }
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("Usuário sem e-mail");
    const site = process.env['SITE_URL'] ?? 'https://labodeguitavinhos.lovable.app';
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${site}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

const SetPasswordSchema = z.object({
  user_role_id: z.string().uuid(),
  password: z.string().min(8).max(72),
});

/** Define diretamente a senha do usuário. Somente admin global. */
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetPasswordSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("id", data.user_role_id)
      .maybeSingle();
    if (!row) throw new Error("Vínculo não encontrado");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ChangeEmailSchema = z.object({
  user_role_id: z.string().uuid(),
  email: z.string().trim().email(),
});

/** Substitui o e-mail de acesso do usuário. Somente admin global. */
export const adminChangeUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChangeEmailSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("id", data.user_role_id)
      .maybeSingle();
    if (!row) throw new Error("Vínculo não encontrado");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").upsert({ id: row.user_id, email: data.email });
    return { ok: true };
  });

const TransferSchema = z.object({
  user_role_id: z.string().uuid(),
  email: z.string().trim().email(),
});

/**
 * Transfere um vínculo para outra pessoa: convida/localiza o novo e-mail,
 * cria o mesmo papel para ele e remove o vínculo anterior.
 */
export const transferAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TransferSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, restaurant_id, supplier_id")
      .eq("id", data.user_role_id)
      .maybeSingle();
    if (!row) throw new Error("Vínculo não encontrado");
    if (row.role === "admin") throw new Error("Não é possível transferir o admin global");
    const { data: isAdmin } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) {
      if (!row.restaurant_id) throw new Error("Forbidden");
      await assertCanManage(context, row.restaurant_id);
    }

    let newUserId: string | undefined;
    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
    );
    if (invited?.user) newUserId = invited.user.id;
    else if (invErr) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!found) throw new Error(invErr.message);
      newUserId = found.id;
    }
    if (!newUserId) throw new Error("Não foi possível criar/localizar o usuário");
    if (newUserId === row.user_id) throw new Error("O e-mail informado já é o titular do acesso");

    await supabaseAdmin.from("profiles").upsert({ id: newUserId, email: data.email });
    const { error: insErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: row.role,
      restaurant_id: row.restaurant_id,
      supplier_id: row.supplier_id,
    });
    if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(insErr.message);
    }
    await supabaseAdmin.from("user_roles").delete().eq("id", row.id);
    return { ok: true, user_id: newUserId };
  });

const DeleteAccountSchema = z.object({ user_role_id: z.string().uuid() });

/**
 * Exclui completamente a conta de acesso (todos os vínculos, o perfil e o
 * login), liberando o e-mail para ser cadastrado novamente do zero.
 * Somente admin global.
 */
export const adminDeleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteAccountSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("id", data.user_role_id)
      .maybeSingle();
    if (!row) return { ok: true };
    if (row.user_id === context.userId) throw new Error("Não é possível excluir a própria conta.");

    const { data: isTargetAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: row.user_id });
    if (isTargetAdmin) throw new Error("Contas de administrador geral não podem ser excluídas aqui.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", row.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
