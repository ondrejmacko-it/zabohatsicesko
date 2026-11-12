import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Šifrování tajemství uložených v databázi (obnovovací tokeny). AES-256-GCM s náhodným IV.
// Kontext (organizace a poskytovatel) je součástí ověření, takže šifru nejde přenést do jiného řádku.

const VERSION = "v1";

export function sealSecret(plain: string, key: Buffer, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Vrací null, pokud šifra nejde ověřit (jiný klíč, jiný kontext, poškozená data). */
export function openSecret(sealed: string, key: Buffer, context: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
