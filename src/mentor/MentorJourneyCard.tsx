import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Card de entrada do Mentor na tela Jornada. */
export function MentorJourneyCard() {
  return (
    <Link to="/mentor" className="block">
      <Card className="cp-brackets group overflow-hidden border-transparent p-0 transition hover:brightness-110">
        <div className="flex items-stretch">
          <img
            src="/charlie.png"
            alt=""
            className="h-28 w-24 shrink-0 object-cover object-top sm:h-32 sm:w-28"
          />
          <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">Charlie</p>
            <h2 className="mt-1 font-display text-lg font-semibold">A voz da sua jornada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ele conhece seus padrões. Fale com ele.
            </p>
            <span className="mt-3 inline-flex items-center text-xs text-hero">
              Abrir conversa{" "}
              <ChevronRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
