export function authErrorPt(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  if (msg.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("already registered") || msg.includes("already exists"))
    return "Este e-mail já está cadastrado. Use \"Entrar\" ou \"Esqueci minha senha\".";
  if (msg.includes("weak") || msg.includes("easy to guess"))
    return "Escolha outra senha com pelo menos 6 caracteres.";
  if (msg.includes("at least") && msg.includes("characters"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (msg.includes("same") && msg.includes("password"))
    return "A nova senha deve ser diferente da anterior.";
  if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("security purposes"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (msg.includes("invalid") && msg.includes("email")) return "E-mail inválido.";
  if (msg.includes("expired") || msg.includes("invalid token") || msg.includes("session"))
    return "O link expirou ou é inválido. Solicite um novo e-mail de redefinição.";
  if (msg.includes("network") || msg.includes("fetch")) return "Falha de conexão. Verifique sua internet.";
  return "Não foi possível concluir. Tente novamente.";
}
