/** Redact emails, phones, INC ids, ad\\ usernames. Replace with space (not a hub token). */
export function redactText(s: string): string {
  if (!s) return s;
  let t = s;
  t = t.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, ' ');
  t = t.replace(/\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, ' ');
  t = t.replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, ' ');
  t = t.replace(/\bINC\d{7}\b/gi, ' ');
  t = t.replace(/\bad\\[A-Za-z0-9._\-]+\b/gi, ' ');
  return t;
}
