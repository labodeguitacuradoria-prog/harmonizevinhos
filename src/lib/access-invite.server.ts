const DEFAULT_SITE_URL = "https://labodeguitavinhos.lovable.app";

export type ManualAccessInvite = {
  ok: true;
  user_id: string;
  email: string;
  invite_url: string | null;
  login_url: string;
  is_existing_user: boolean;
};

function safeOrigin(origin?: string | null) {
  if (!origin) return DEFAULT_SITE_URL;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return DEFAULT_SITE_URL;
    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export async function createManualAccessInvite(
  supabaseAdmin: any,
  email: string,
  redirectOrigin?: string | null,
): Promise<ManualAccessInvite> {
  const normalizedEmail = email.trim().toLowerCase();
  const origin = safeOrigin(redirectOrigin);
  const loginUrl = `${origin}/auth`;
  const redirectTo = `${origin}/reset-password`;

  const { data: generated, error: generateError } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: normalizedEmail,
    options: { redirectTo },
  });

  const generatedUserId = generated?.user?.id as string | undefined;
  if (generatedUserId) {
    return {
      ok: true,
      user_id: generatedUserId,
      email: normalizedEmail,
      invite_url: generated?.properties?.action_link ?? loginUrl,
      login_url: loginUrl,
      is_existing_user: false,
    };
  }

  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const found = list?.users.find(
    (user: { email?: string | null }) => user.email?.toLowerCase() === normalizedEmail,
  );
  if (!found) {
    throw new Error(generateError?.message ?? "Não foi possível criar o convite.");
  }

  return {
    ok: true,
    user_id: found.id,
    email: normalizedEmail,
    invite_url: null,
    login_url: loginUrl,
    is_existing_user: true,
  };
}