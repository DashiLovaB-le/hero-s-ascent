import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Send, Sparkles, Swords, Check, X, Target } from "lucide-react";
import { toast } from "sonner";

import {
  ensureMentorPresence,
  sendMentorMessage,
  updateMentorChallenge,
} from "@/mentor/functions";
import { mentorThreadQueryOptions, type MentorThreadData } from "@/mentor/queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

type Msg = MentorThreadData["messages"][number];
type Challenge = MentorThreadData["challenges"][number];
type Objective = MentorThreadData["objective"];
type PendingQuestion = MentorThreadData["pendingQuestion"];

const OPTIMISTIC_PREFIX = "optimistic-";

export function MentorPage() {
  const { data } = useSuspenseQuery(mentorThreadQueryOptions());
  const qc = useQueryClient();
  const sendFn = useServerFn(sendMentorMessage);
  const presenceFn = useServerFn(ensureMentorPresence);
  const challengeFn = useServerFn(updateMentorChallenge);

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>(data.messages);
  const [challenges, setChallenges] = useState<Challenge[]>(data.challenges);
  const [objective, setObjective] = useState<Objective>(data.objective);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion>(data.pendingQuestion);
  const [presencePending, setPresencePending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const presenceStarted = useRef(false);

  useEffect(() => {
    setMessages((prev) => {
      const optimistic = prev.filter((m) => m.id.startsWith(OPTIMISTIC_PREFIX));
      if (optimistic.length === 0) return data.messages;
      const serverContents = new Set(data.messages.map((m) => m.content));
      const stillPending = optimistic.filter((m) => !serverContents.has(m.content));
      return [...data.messages, ...stillPending];
    });
    setChallenges(data.challenges);
    setObjective(data.objective);
    setPendingQuestion(data.pendingQuestion);
  }, [data.messages, data.challenges, data.objective, data.pendingQuestion]);

  const onPresence = useEffectEvent(async () => {
    if (presenceStarted.current) return;
    presenceStarted.current = true;
    setPresencePending(true);
    try {
      const res = await presenceFn({ data: undefined as unknown as never });
      if (res.created && res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!],
        );
        if (res.challenge) {
          setChallenges((prev) => [
            res.challenge!,
            ...prev.filter((c) => c.id !== res.challenge!.id),
          ]);
        }
        if (res.pendingQuestion) setPendingQuestion(res.pendingQuestion);
        if (res.objective) setObjective(res.objective);
        void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPresencePending(false);
    }
  });

  useEffect(() => {
    if (!data.onboardingCompleto) return;
    void onPresence();
  }, [data.onboardingCompleto]);

  const sendM = useMutation({
    mutationFn: (content: string) => sendFn({ data: { content } }),
    onMutate: async (content) => {
      const optimistic: Msg = {
        id: `${OPTIMISTIC_PREFIX}${Date.now()}`,
        role: "user",
        kind: "chat",
        content,
        metadata: {},
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");
      setPendingQuestion(null);
      return { optimisticId: optimistic.id };
    },
    onSuccess: (res, _content, ctx) => {
      setMessages((prev) => {
        const withoutOptimistic = ctx?.optimisticId
          ? prev.filter((m) => m.id !== ctx.optimisticId)
          : prev;
        const next = [...withoutOptimistic];
        if (!next.some((m) => m.id === res.userMessage.id)) next.push(res.userMessage);
        if (!next.some((m) => m.id === res.assistantMessage.id)) next.push(res.assistantMessage);
        return next;
      });
      if (res.challenge) {
        setChallenges((prev) => [
          res.challenge!,
          ...prev.filter((c) => c.id !== res.challenge!.id),
        ]);
        toast.message("Novo desafio de Charlie", { description: res.challenge.titulo });
      }
      if (res.pendingQuestion) setPendingQuestion(res.pendingQuestion);
      else setPendingQuestion(null);
      if (res.objective) setObjective(res.objective);
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
    },
    onError: (e, content, ctx) => {
      if (ctx?.optimisticId) {
        setMessages((prev) => prev.filter((m) => m.id !== ctx.optimisticId));
      }
      setDraft(content);
      toast.error(e.message);
    },
  });

  const challengeM = useMutation({
    mutationFn: (input: { id: string; action: "complete" | "decline" }) =>
      challengeFn({ data: input }),
    onSuccess: (res) => {
      setChallenges((prev) => prev.map((c) => (c.id === res.challenge.id ? res.challenge : c)));
      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!],
        );
      }
      if (res.pendingQuestion) setPendingQuestion(res.pendingQuestion);
      if (res.xpGanho > 0) {
        toast.success(`Desafio concluído · +${res.xpGanho} XP`);
        void qc.invalidateQueries({ queryKey: ["journey"] });
        void qc.invalidateQueries({ queryKey: ["mentor-challenges-completed"] });
      } else {
        toast.message("Desafio encerrado.");
      }
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const charlieTyping = sendM.isPending || presencePending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, charlieTyping, pendingQuestion]);

  if (!data.onboardingCompleto) {
    return (
      <div className="cp-modal cp-brackets mx-auto max-w-lg border border-transparent bg-card p-8 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-hero">Charlie</p>
        <h1 className="mt-3 font-display text-2xl">Ainda não.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete o chamado antes de encontrar Charlie.
        </p>
        <Link to="/onboarding" className="mt-6 inline-block">
          <Button className="shadow-hero">Ir ao onboarding</Button>
        </Link>
      </div>
    );
  }

  const activeChallenges = challenges.filter((c) => c.status === "ativo");

  function submit(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || sendM.isPending) return;
    sendM.mutate(content);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-end gap-4">
        <div className="relative shrink-0">
          <img
            src="/charlie.png"
            alt="Charlie"
            className="h-16 w-16 object-cover object-top shadow-hero sm:h-20 sm:w-20"
            style={{
              clipPath:
                "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.28em] text-hero">Presença viva</p>
          <h1 className="font-display text-2xl font-bold tracking-wide sm:text-3xl">Charlie</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ele conhece sua jornada, {data.heroName}. Fale com verdade.
          </p>
        </div>
      </header>

      {objective && (
        <div className="flex items-start gap-3 border-l-2 border-hero/70 bg-surface/60 px-4 py-3">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-hero" />
          <div className="min-w-0">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">
              Objetivo do mentor
            </p>
            <p className="mt-0.5 text-sm font-medium leading-snug">{objective.titulo}</p>
            {objective.motivo && (
              <p className="mt-1 text-xs text-muted-foreground">{objective.motivo}</p>
            )}
          </div>
        </div>
      )}

      {activeChallenges.length > 0 && (
        <section className="space-y-3">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Desafios ativos
          </p>
          {activeChallenges.map((c) => {
            const linked = Boolean(c.habit_id);
            const done = c.completions_done ?? 0;
            const needed = c.completions_required ?? 1;
            const ready = !linked || done >= needed;
            const endsLabel = c.ends_at
              ? ` · até ${new Date(c.ends_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })}`
              : "";

            return (
              <div key={c.id} className="cp-panel border border-transparent bg-card/90 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center bg-surface-elevated text-hero">
                    <Swords className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">Desafio</p>
                    <h2 className="font-display text-lg leading-tight">{c.titulo}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{c.descricao}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.duracao_dias} dia{c.duracao_dias > 1 ? "s" : ""} · {c.xp_recompensa} XP
                      {c.titulo_recompensa ? ` · ${c.titulo_recompensa}` : ""}
                      {endsLabel}
                    </p>
                    {linked && (
                      <p className="mt-2 text-xs text-hero/90">
                        Hábito: {c.habit_titulo ?? "vinculado"} · {done}/{needed} conclusões
                        {!ready ? " — complete o hábito para liberar" : " — pronto para concluir"}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="shadow-hero"
                        disabled={challengeM.isPending || !ready}
                        onClick={() => challengeM.mutate({ id: c.id, action: "complete" })}
                      >
                        <Check className="h-4 w-4" /> Concluir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={challengeM.isPending}
                        onClick={() => challengeM.mutate({ id: c.id, action: "decline" })}
                      >
                        <X className="h-4 w-4" /> Deixar para depois
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="cp-modal cp-brackets flex h-[min(62dvh,640px)] flex-col overflow-hidden border border-transparent bg-card/95">
        <ScrollArea className="h-full flex-1 px-4 py-5 sm:px-5">
          <div className="space-y-4">
            {messages.length === 0 && !charlieTyping && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Sparkles className="h-6 w-6 text-hero" />
                <p className="max-w-xs text-sm text-muted-foreground">
                  Charlie está chegando. Aguarde a primeira palavra — ou escreva o que trouxe você
                  até aqui.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {charlieTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 bg-background/40 p-3 sm:p-4">
          {pendingQuestion && !sendM.isPending && (
            <div className="mb-3 space-y-2 border-l-2 border-hero/50 pl-3">
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">
                Charlie pergunta
              </p>
              <p className="text-sm leading-snug">{pendingQuestion.prompt}</p>
              {pendingQuestion.options && pendingQuestion.options.length >= 2 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {pendingQuestion.options.map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={sendM.isPending}
                      onClick={() => submit(opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                pendingQuestion
                  ? "Responda à pergunta de Charlie…"
                  : "Fale com Charlie…"
              }
              rows={2}
              disabled={sendM.isPending}
              className="min-h-[2.75rem] resize-none bg-surface"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0 shadow-hero"
              disabled={sendM.isPending || !draft.trim()}
              onClick={() => submit()}
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[0.65rem] tracking-wide text-muted-foreground">
            Enter envia · Shift+Enter quebra linha
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Charlie está respondendo">
      <div
        className="flex items-center gap-3 bg-surface px-4 py-3"
        style={{
          clipPath:
            "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
        }}
      >
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="mentor-typing-dot" style={{ animationDelay: "0ms" }} />
          <span className="mentor-typing-dot" style={{ animationDelay: "160ms" }} />
          <span className="mentor-typing-dot" style={{ animationDelay: "320ms" }} />
        </span>
        <span className="text-xs text-muted-foreground">Charlie escreve…</span>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  const kindLabel =
    message.kind === "morning"
      ? "Amanhecer"
      : message.kind === "evening"
        ? "Anoitecer"
        : message.kind === "return"
          ? "Retorno"
          : message.kind === "welcome"
            ? "Primeiro encontro"
            : null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] px-4 py-3 sm:max-w-[80%] ${
          isUser ? "bg-hero text-hero-foreground" : "bg-surface text-foreground"
        }`}
        style={{
          clipPath: isUser
            ? "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))"
            : "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
        }}
      >
        {!isUser && kindLabel && (
          <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-hero">{kindLabel}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
