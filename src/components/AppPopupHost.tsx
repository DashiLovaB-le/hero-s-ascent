import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivePopupForPath } from "@/lib/popup.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISS_KEY = (id: string) => `vproject:popup:dismissed:${id}`;

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY(id)) === "1";
  } catch {
    return false;
  }
}

function markDismissed(id: string) {
  try {
    localStorage.setItem(DISMISS_KEY(id), "1");
  } catch {
    /* ignore */
  }
}

/** Normaliza pathname do router (sem trailing slash, exceto root). */
function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return pathname || "/";
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * Exibe pop-up de anúncio ativo para a rota atual (ao carregar a página).
 * Após "Entendi"/fechar, não reabre neste browser (localStorage por id).
 */
export function AppPopupHost() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const path = normalizePath(pathname);
  const getFn = useServerFn(getActivePopupForPath);

  const { data } = useQuery({
    queryKey: ["app-popup", path],
    queryFn: () => getFn({ data: { path } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const popup = data?.popup ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!popup) {
      setOpen(false);
      return;
    }
    if (isDismissed(popup.id)) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [popup?.id, path]);

  function dismiss() {
    if (popup) markDismissed(popup.id);
    setOpen(false);
  }

  if (!popup) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="cp-brackets max-w-md gap-4 border-transparent bg-[#1B1B1B] p-0 sm:max-w-md">
        {popup.image_url ? (
          <div className="overflow-hidden border-b border-white/10">
            <img src={popup.image_url} alt="" className="max-h-48 w-full object-cover" />
          </div>
        ) : null}
        <div className="space-y-3 px-6 pb-2 pt-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-display text-lg tracking-[0.04em] text-[#FFE7D0]">
              {popup.titulo}
            </DialogTitle>
            {popup.subtitulo ? (
              <p className="text-sm font-medium text-hero">{popup.subtitulo}</p>
            ) : null}
            <DialogDescription className="whitespace-pre-wrap text-sm leading-relaxed text-[#FFE7D0]/80">
              {popup.corpo}
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="border-t border-white/10 px-6 py-4 sm:justify-end">
          <Button type="button" onClick={dismiss} className="rounded-none shadow-hero">
            {popup.button_label || "Entendi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
