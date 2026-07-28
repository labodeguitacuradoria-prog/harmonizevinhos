// Formata telefone no padrão brasileiro: +55 48 99125 3825 (celular) ou +55 48 3025 1234 (fixo).
// Aceita entrada com/sem +55, formatando progressivamente enquanto o usuário digita.
export function formatBRPhone(input: string): string {
  if (!input) return "";
  // Mantém apenas dígitos; se começar com 55 e tiver mais de 11 dígitos, assume DDI.
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  let out = "+55";
  if (ddd) out += " " + ddd;
  if (rest.length <= 4) {
    if (rest) out += " " + rest;
  } else if (rest.length <= 8) {
    // fixo: 4+4
    out += " " + rest.slice(0, 4) + " " + rest.slice(4);
  } else {
    // celular: 5+4
    out += " " + rest.slice(0, 5) + " " + rest.slice(5);
  }
  return out;
}
