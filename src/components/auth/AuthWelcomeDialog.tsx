import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AuthWelcomeDialogProps = {
  open: boolean;
  onContinue: () => void;
};

export function AuthWelcomeDialog({ open, onContinue }: AuthWelcomeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onContinue();
      }}
    >
      <DialogContent
        className="auth-welcome-dialog cp-modal cp-brackets max-w-[min(26rem,calc(100vw-1.5rem))] gap-0 overflow-hidden border-transparent bg-card p-0 sm:max-w-md [&>button]:right-2.5 [&>button]:top-2.5 [&>button]:z-20 [&>button]:text-foreground/80"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="auth-welcome-dialog__scanlines pointer-events-none absolute inset-0 z-10" aria-hidden />

        <div className="relative z-[1] grid grid-cols-[7.25rem_1fr] sm:grid-cols-[8.5rem_1fr]">
          <div className="relative min-h-[11.5rem] overflow-hidden border-r border-hero/25 sm:min-h-[12.5rem]">
            <img
              src="/img-boasvindas.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[50%_18%]"
              draggable={false}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-card/80"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-hero/10"
              aria-hidden
            />
            <span
              className="absolute left-1.5 top-1.5 font-display text-[0.55rem] tracking-[0.28em] text-hero/90"
              aria-hidden
            >
              ID_01
            </span>
            <span
              className="auth-welcome-dialog__blink absolute bottom-1.5 left-1.5 h-1.5 w-1.5 bg-hero"
              aria-hidden
            />
          </div>

          <div className="relative flex min-w-0 flex-col justify-center gap-2.5 px-3.5 py-3.5 sm:gap-3 sm:px-4 sm:py-4">
            <div className="flex items-center gap-2">
              <span className="h-px w-4 bg-hero/70" aria-hidden />
              <p className="font-display text-[0.58rem] tracking-[0.32em] text-hero">V-PROJECT</p>
            </div>

            <DialogTitle className="font-display text-[1.05rem] leading-tight tracking-wide text-foreground sm:text-lg">
              Bem-vindo de volta, herói.
            </DialogTitle>

            <DialogDescription className="text-[0.75rem] leading-snug text-muted-foreground sm:text-[0.8rem]">
              A porta se abre. Disciplina, XP e o próximo capítulo te esperam.
            </DialogDescription>

            <Button
              type="button"
              className="mt-0.5 h-9 w-full shadow-hero sm:h-10"
              onClick={onContinue}
            >
              Abrir a porta
            </Button>

            <p
              className="font-display text-[0.5rem] tracking-[0.24em] text-muted-foreground/70"
              aria-hidden
            >
              SYS // ACCESS_GRANTED
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
