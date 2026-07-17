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
        className="cp-brackets max-w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-hidden border-transparent bg-card p-0 sm:max-w-sm [&>button]:right-3 [&>button]:top-3 [&>button]:text-foreground"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative overflow-hidden">
          <img
            src="/img-boasvindas.png"
            alt=""
            className="aspect-square w-full object-cover object-top"
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-card via-card/70 to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative space-y-4 px-5 pb-5 pt-1 text-center">
          <p className="font-display text-[0.65rem] tracking-[0.28em] text-hero">V-PROJECT</p>
          <DialogTitle className="font-display text-xl leading-tight tracking-wide text-foreground sm:text-2xl">
            Bem-vindo de volta, herói.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            A porta se abre. Sua jornada continua — disciplina, XP e o próximo capítulo te esperam.
          </DialogDescription>
          <Button type="button" className="w-full shadow-hero" size="lg" onClick={onContinue}>
            Abrir a porta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
