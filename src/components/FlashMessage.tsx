"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "wiki-flash";

/**
 * Potvrzení akce, která zavřela dialog nebo přesměrovala na jinou stránku. Hláška přežije jednu navigaci
 * v rámci záložky (sessionStorage) a zobrazí se nahoře v obsahu, dokud ji uživatel nezavře nebo neodejde jinam.
 */
export function flash(message: string | undefined) {
  if (!message) return;
  try {
    sessionStorage.setItem(KEY, message);
    window.dispatchEvent(new Event(KEY));
  } catch {
    // Bez úložiště se potvrzení jen nezobrazí, akce sama proběhla.
  }
}

export function FlashMessage() {
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const stored = sessionStorage.getItem(KEY);
        if (stored) {
          sessionStorage.removeItem(KEY);
          setMessage(stored);
        }
      } catch {
        // Úložiště nedostupné.
      }
    };
    read();
    window.addEventListener(KEY, read);
    return () => window.removeEventListener(KEY, read);
  }, [pathname]);
  if (!message) return null;
  return (
    <div className="notice notice-ok flash" role="status">
      <span>{message}</span>
      <button type="button" className="btn btn-small" onClick={() => setMessage(null)}>
        Zavřít
      </button>
    </div>
  );
}
