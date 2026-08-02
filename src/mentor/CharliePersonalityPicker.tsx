import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

type PersonalitySummary = {
  slug: string;
  name: string;
  tagline: string;
};

type Props = {
  current: PersonalitySummary;
};

/** Atalho para a loja de personalidades (`/store`). */
export function CharliePersonalityPicker({ current }: Props) {
  return (
    <Link
      to="/store"
      className="mt-2 inline-flex max-w-full items-center gap-1.5 text-left text-xs text-hero/90 hover:text-hero"
    >
      <Store className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        Configurar Personalidade do Charlie
        {current.name ? ` · ${current.name}` : ""}
      </span>
    </Link>
  );
}
