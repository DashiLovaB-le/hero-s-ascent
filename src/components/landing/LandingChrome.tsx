import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SlashLabel({
  children,
  className,
  bar = true,
}: {
  children: ReactNode;
  className?: string;
  bar?: boolean;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-hero",
        className,
      )}
    >
      {bar ? <span className="inline-block h-0.5 w-7 shrink-0 bg-hero" aria-hidden /> : null}
      {children}
    </p>
  );
}

export function TechMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-hero/80",
        className,
      )}
      aria-hidden
    >
      <span className="h-1.5 w-1.5 bg-hero" />
      SYS // ONLINE
    </span>
  );
}

export function CheckItem({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.ComponentPropsWithoutRef<"li">) {
  return (
    <li
      className={cn(
        "flex gap-2.5 text-[13px] leading-snug text-[#FFE7D0]/85 sm:text-sm",
        className,
      )}
      {...rest}
    >
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-hero"
        style={{
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        }}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}
