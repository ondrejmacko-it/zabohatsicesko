import { safeDecode } from "@/lib/params";
import { getCurrentUser } from "@/server/auth/session";
import { DomainError } from "@/server/services/errors";
import { readRecording } from "@/server/services/recordings";

// Autorizované přehrání nahrávky. Oprávnění se ověřuje při každém požadavku,
// odkaz nelze sdílet mimo přihlášenou session vedoucího nebo kontrolora.
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const eventId = safeDecode((await params).eventId);
  if (!eventId) return new Response(null, { status: 404 });
  try {
    const { data, mimeType } = await readRecording(user, eventId);
    return new Response(Buffer.from(data), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(data.byteLength),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    // Cizí akce i chybějící soubor vracejí stejnou odpověď.
    if (error instanceof DomainError) return new Response(null, { status: 404 });
    throw error;
  }
}
