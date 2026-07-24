import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateProfile } from "@/lib/journey.functions";
import {
  WALLPAPERS,
  wallpaperSrc,
  isWallpaperUnlocked,
  unlockHint,
  lockedWallpaperMessage,
  type WallpaperDef,
  type WallpaperProgress,
} from "@/lib/wallpapers";
import { writeStoredWallpaperId } from "@/lib/wallpaper-storage";
import type { JourneyData } from "@/lib/journey-queries";

type Props = {
  selectedId: string;
  progress: WallpaperProgress;
  onSelect?: (id: string) => void;
};

export function WallpaperSettings({ selectedId, progress, onSelect }: Props) {
  const updateFn = useServerFn(updateProfile);
  const qc = useQueryClient();
  const [locked, setLocked] = useState<WallpaperDef | null>(null);

  const m = useMutation({
    mutationFn: async (wallpaper_id: string) => {
      writeStoredWallpaperId(wallpaper_id);
      onSelect?.(wallpaper_id);
      try {
        await updateFn({ data: { wallpaper_id } });
      } catch {
        // Coluna wallpaper_id pode ainda não existir no banco — preferência local já salva.
      }
      return wallpaper_id;
    },
    onSuccess: (wallpaper_id) => {
      toast.success("Fundo de tela atualizado");
      qc.setQueryData<JourneyData>(["journey"], (old) =>
        old?.profile ? { ...old, profile: { ...old.profile, wallpaper_id } } : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  function onTileClick(w: WallpaperDef, unlocked: boolean) {
    if (!unlocked) {
      setLocked(w);
      return;
    }
    if (m.isPending || selectedId === w.id) return;
    m.mutate(w.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <ImageIcon className="h-4 w-4 text-hero" /> Fundo de tela
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Desbloqueie novos backgrounds conforme avança!
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {WALLPAPERS.map((w) => {
          const unlocked = isWallpaperUnlocked(w, progress);
          const active = selectedId === w.id;
          const src = wallpaperSrc(w.file);

          return (
            <button
              key={w.id}
              type="button"
              disabled={m.isPending && unlocked}
              onClick={() => onTileClick(w, unlocked)}
              className={[
                "group relative aspect-[4/3] overflow-hidden border text-left transition",
                active
                  ? "border-hero shadow-hero"
                  : unlocked
                    ? "border-border hover:border-hero/50"
                    : "border-border/40 opacity-70 hover:border-border",
                unlocked && !active ? "cursor-pointer" : unlocked ? "cursor-default" : "cursor-pointer",
              ].join(" ")}
              aria-label={unlocked ? `Usar fundo ${w.titulo}` : `${w.titulo} bloqueado`}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    w.id === "none"
                      ? "#1B1B1B"
                      : "linear-gradient(145deg, #323232 0%, #1B1B1B 55%, color-mix(in srgb, #FC6E20 28%, #1B1B1B) 100%)",
                }}
                aria-hidden
              />
              {src ? (
                <img
                  src={src}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0";
                  }}
                />
              ) : null}

              {!unlocked && (
                <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-1 bg-background/75 backdrop-blur-[2px]">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {unlockHint(w)}
                  </span>
                </div>
              )}

              {active && (
                <span className="absolute right-2 top-2 z-[2] grid h-6 w-6 place-items-center bg-hero text-hero-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-background/95 to-transparent px-2 pb-2 pt-6">
                <p className="truncate text-xs font-medium text-foreground">{w.titulo}</p>
                <p className="truncate text-[0.65rem] text-muted-foreground">{w.descricao}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={locked != null} onOpenChange={(open) => !open && setLocked(null)}>
        <DialogContent className="cp-brackets max-h-[50dvh] max-w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-y-auto border-transparent bg-card p-5 sm:max-w-sm">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-hero">
              <Lock className="h-4 w-4 shrink-0" />
              <span className="font-display text-[0.65rem] tracking-[0.22em] uppercase">
                Bloqueado
              </span>
            </div>
            <DialogTitle className="font-display text-lg leading-snug">
              {locked ? locked.titulo : "Fundo bloqueado"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {locked
                ? lockedWallpaperMessage(locked)
                : "Você ainda não desbloqueou este fundo."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 sm:justify-stretch">
            <Button type="button" className="w-full" onClick={() => setLocked(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
