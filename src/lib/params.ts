/** Dekóduje parametr z URL. Poškozené kódování vrací null místo výjimky. */
export function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
