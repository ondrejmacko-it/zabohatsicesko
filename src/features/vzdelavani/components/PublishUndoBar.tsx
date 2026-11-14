"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { UndoablePublish } from "@/server/services/events";
import { sendHeldInvitesAction, unpublishAction } from "../actions";

const plural = (count: number) => `${count} ${count < 5 ? "akce" : "akcí"}`;

/** Jak dlouho zůstane vidět výsledek vrácení. */
const RESULT_MS = 6000;

/**
 * Pruh po zveřejnění: pozvánky odejdou až po krátké lhůtě a do té doby jde krok jedním klikem vrátit.
 * Lhůtu drží server (`inviteHoldUntil`), pruh ji jen odpočítává a po jejím konci požádá o odeslání.
 */
export function PublishUndoBar({ items }: { items: UndoablePublish[] }) {
  // Nové zveřejnění (jiná sada akcí) začíná nový odpočet.
  const batch = items.map((item) => item.id).join(",");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), RESULT_MS);
    return () => clearTimeout(timer);
  }, [result]);

  if (items.length) return <Countdown key={batch} items={items} onResult={setResult} />;
  if (!result) return null;
  return (
    <div className="undo-bar" role="status">
      <p className="undo-text">
        <strong>{result.ok ? "Vráceno" : "Nevráceno"}</strong>
        <span>{result.text}</span>
      </p>
    </div>
  );
}

function Countdown({ items, onResult }: { items: UndoablePublish[]; onResult: (result: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const total = Math.max(...items.map((item) => item.remainingMs));
  const [seconds, setSeconds] = useState(Math.max(1, Math.ceil(total / 1000)));
  const [pending, startTransition] = useTransition();
  const done = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => Math.max(1, s - 1)), 1000);
    // Malá rezerva, aby lhůta na serveru už jistě uplynula.
    const send = setTimeout(() => {
      if (done.current) return;
      done.current = true;
      void sendHeldInvitesAction().finally(() => router.refresh());
    }, total + 600);
    return () => {
      clearInterval(tick);
      clearTimeout(send);
    };
  }, [total, router]);

  const undo = () => {
    if (done.current) return;
    done.current = true;
    startTransition(async () => {
      const outcome = await unpublishAction(items.map((item) => item.id));
      onResult(outcome.ok ? { ok: true, text: outcome.message ?? "" } : { ok: false, text: outcome.error });
    });
  };

  const single = items.length === 1 ? items[0] : null;
  return (
    <div className="undo-bar" role="status">
      <p className="undo-text">
        <strong>{single ? `Zveřejněno: ${single.topicTitle ?? single.label}` : `Zveřejněno: ${plural(items.length)}`}</strong>
        <span>
          {single ? "Pozvánka" : "Pozvánky"} do Kalendáře {single ? "odejde" : "odejdou"} za {seconds} s.
        </span>
      </p>
      <button type="button" className="btn btn-small undo-button" onClick={undo} disabled={pending}>
        {pending ? "Vracím…" : "Vrátit zpět"}
      </button>
    </div>
  );
}
