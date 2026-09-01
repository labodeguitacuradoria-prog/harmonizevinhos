/**
 * Endereço público do app, usado em links enviados a terceiros (chef, equipe).
 * O domínio de preview (id-preview--*.lovable.app) exige login da plataforma,
 * por isso links externos devem sempre usar o domínio publicado.
 */
export const PUBLISHED_ORIGIN = "https://harmonizevinhos.lovable.app";

export function publicOrigin(): string {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN;
  const host = window.location.hostname;
  const isPreview =
    host.includes("id-preview--") ||
    host.endsWith("-dev.lovable.app") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return isPreview ? PUBLISHED_ORIGIN : window.location.origin;
}
