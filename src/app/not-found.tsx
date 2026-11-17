import Link from "next/link";
import { GateShell } from "@/components/GateShell";

export default function NotFound() {
  return (
    <GateShell title="Stránka nenalezena">
      <p className="gate-lead">Stránka neexistuje nebo k ní nemáte přístup.</p>
      <p>
        <Link className="btn" href="/">
          Na úvod
        </Link>
      </p>
    </GateShell>
  );
}
