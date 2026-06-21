import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteSchema = z.object({
  supplier_id: z.string().uuid(),
  email: z.string().email(),
});

export const inviteSupplierUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    // verify caller is admin
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Invite (or look up existing) user
    let userId: string | undefined;
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email
    );
    if (invited?.user) {
      userId = invited.user.id;
    } else if (inviteErr) {
      // User may already exist — try to look up
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!found) throw new Error(inviteErr.message);
      userId = found.id;
    }
    if (!userId) throw new Error("Could not create or find user");

    // Ensure profile row exists
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
    });

    // Insert supplier role (idempotent via unique constraint)
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "supplier",
      supplier_id: data.supplier_id,
    });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    return { ok: true };
  });
