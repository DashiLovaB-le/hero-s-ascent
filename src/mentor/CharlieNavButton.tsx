import { Link, useRouterState } from "@tanstack/react-router";

/** Botão central elevado da bottom nav — abre Charlie (`/mentor`). */
export function CharlieNavButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === "/mentor" || pathname.startsWith("/mentor/");

  return (
    <div className="relative flex h-full items-end justify-center pb-2">
      <Link
        to="/mentor"
        preload="intent"
        aria-label="Charlie"
        className={[
          "absolute bottom-[22px] z-10 flex size-[56px] items-center justify-center overflow-hidden rounded-full bg-hero shadow-hero ring-[4px] ring-background transition-transform active:scale-95",
          active ? "scale-105 ring-hero/50" : "",
        ].join(" ")}
      >
        <img
          src="/charlie.png"
          alt=""
          aria-hidden
          className="size-full object-cover object-top"
        />
      </Link>
      <span
        className={[
          "text-[12px] leading-none",
          active ? "font-medium text-hero" : "text-muted-foreground",
        ].join(" ")}
      >
        Charlie
      </span>
    </div>
  );
}
