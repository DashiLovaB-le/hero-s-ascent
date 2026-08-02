import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Swords,
  Check,
  X,
  Target,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";

import { CharliePersonalityPicker } from "@/mentor/CharliePersonalityPicker";
import {
  ensureMentorPresence,
  respondMentorHabitSuggestion,
  sendMentorMessage,
  updateMentorChallenge,
} from "@/mentor/functions";
import { parseMentorAiPayload } from "@/mentor/context";
import { mentorThreadQueryOptions, type MentorThreadData } from "@/mentor/queries";
import { readMentorFocusMode, writeMentorFocusMode } from "@/mentor/focus-mode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ATRIBUTO_LABELS } from "@/lib/journey";

type Msg = MentorThreadData["messages"][number];
type Challenge = MentorThreadData["challenges"][number];
type Objective = MentorThreadData["objective"];
type PendingQuestion = MentorThreadData["pendingQuestion"];
type PendingHabitSuggestion = MentorThreadData["pendingHabitSuggestion"];

const OPTIMISTIC_PREFIX = "optimistic-";

export function MentorPage() {
  const { data } = useSuspenseQuery(mentorThreadQueryOptions());
  const qc = useQueryClient();
  const sendFn = useServerFn(sendMentorMessage);
  const presenceFn = useServerFn(ensureMentorPresence);
  const challengeFn = useServerFn(updateMentorChallenge);
  const habitSuggestFn = useServerFn(respondMentorHabitSuggestion);

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>(data.messages);
  const [challenges, setChallenges] = useState<Challenge[]>(data.challenges);
  const [objective, setObjective] = useState<Objective>(data.objective);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion>(data.pendingQuestion);
  const [pendingHabitSuggestion, setPendingHabitSuggestion] = useState<PendingHabitSuggestion>(
    data.pendingHabitSuggestion,
  );
  const [personality, setPersonality] = useState(
    data.personality ?? {
      slug: "classico",
      name: "Charlie Clássico",
      tagline: "Equilibrado. Faz perguntas. Incentiva sem pressionar.",
    },
  );
  const [presencePending, setPresencePending] = useState(false);
  const [focusMode, setFocusMode] = useState(() => readMentorFocusMode());
  const bottomRef = useRef<HTMLDivElement>(null);
  const presenceStarted = useRef(false);

  useEffect(() => {
    return () => {
      writeMentorFocusMode(false);
    };
  }, []);

  function scrollToLatest(behavior: ScrollBehavior = "auto") {
    const el = bottomRef.current;
    if (!el) return;
    const viewport = el.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (viewport) {
      if (behavior === "smooth") {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
      return;
    }
    el.scrollIntoView({ behavior, block: "end" });
  }

  function toggleFocusMode() {
    setFocusMode((prev) => {
      const next = !prev;
      writeMentorFocusMode(next);
      return next;
    });
  }

  useEffect(() => {
    if (!focusMode) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    const t1 = window.setTimeout(() => scrollToLatest("auto"), 50);
    const t2 = window.setTimeout(() => scrollToLatest("auto"), 200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [focusMode]);

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
    setPendingHabitSuggestion(data.pendingHabitSuggestion);
    if (data.personality) setPersonality(data.personality);
  }, [
    data.messages,
    data.challenges,
    data.objective,
    data.pendingQuestion,
    data.pendingHabitSuggestion,
    data.personality,
  ]);

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
        if (res.pendingHabitSuggestion) setPendingHabitSuggestion(res.pendingHabitSuggestion);
        if (res.objective) setObjective(res.objective);
        void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
        if (res.challenge || res.pendingHabitSuggestion) {
          void qc.invalidateQueries({ queryKey: ["notifications"] });
          void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        }
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
      if (res.pendingHabitSuggestion) {
        setPendingHabitSuggestion(res.pendingHabitSuggestion);
        toast.message("Charlie sugeriu um hábito", {
          description: res.pendingHabitSuggestion.titulo,
        });
      }
      if (res.pendingQuestion) setPendingQuestion(res.pendingQuestion);
      else setPendingQuestion(null);
      if (res.objective) setObjective(res.objective);
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
      if (res.challenge || res.pendingHabitSuggestion) {
        void qc.invalidateQueries({ queryKey: ["notifications"] });
        void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      }
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
      if (res.pendingHabitSuggestion) setPendingHabitSuggestion(res.pendingHabitSuggestion);
      if (res.xpGanho > 0) {
        toast.success(`Desafio concluído · +${res.xpGanho} XP`);
        void qc.invalidateQueries({ queryKey: ["journey"] });
        void qc.invalidateQueries({ queryKey: ["mentor-challenges-completed"] });
        void qc.invalidateQueries({ queryKey: ["notifications"] });
        void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      } else {
        toast.message("Desafio encerrado.");
      }
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const habitSuggestM = useMutation({
    mutationFn: (input: { messageId: string; action: "accept" | "decline" }) =>
      habitSuggestFn({ data: input }),
    onSuccess: (res) => {
      setPendingHabitSuggestion(null);
      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!],
        );
      }
      if (res.pendingQuestion) setPendingQuestion(res.pendingQuestion);
      if (res.pendingHabitSuggestion) setPendingHabitSuggestion(res.pendingHabitSuggestion);
      if (res.action === "accept" && res.habit) {
        toast.success("Hábito adicionado", { description: res.habit.titulo });
        void qc.invalidateQueries({ queryKey: ["journey"] });
        void qc.invalidateQueries({ queryKey: ["habits"] });
      } else {
        toast.message("Sugestão encerrada.");
      }
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const charlieTyping = sendM.isPending || presencePending;

  useEffect(() => {
    scrollToLatest("smooth");
  }, [messages.length, charlieTyping, pendingQuestion, pendingHabitSuggestion]);

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
    <div className={cn("mx-auto flex max-w-3xl flex-col", focusMode ? "gap-0" : "gap-4")}>
      {!focusMode && (
        <>
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
              <CharliePersonalityPicker current={personality} />
              {data.mlRiskLine && (
                <p className="mt-2 text-xs text-hero/90">{data.mlRiskLine}</p>
              )}
            </div>
          </header>

          {objective && (
            <div className="flex items-start gap-3 border-l-2 border-hero/70 bg-surface/60 px-4 py-3">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-hero" />
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">
                  Objetivo do mentor
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug break-words">
                  {objective.titulo}
                </p>
                {objective.motivo && (
                  <p className="mt-1 text-xs text-muted-foreground break-words">{objective.motivo}</p>
                )}
              </div>
            </div>
          )}

          {pendingHabitSuggestion && (
            <section className="space-y-3">
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                Sugestão de hábito
              </p>
              <div className="cp-panel border border-transparent bg-card/90 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center bg-surface-elevated text-hero">
                    <Repeat className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">
                      Novo hábito
                    </p>
                    <h2 className="font-display text-lg leading-tight break-words">
                      {pendingHabitSuggestion.titulo}
                    </h2>
                    {pendingHabitSuggestion.descricao && (
                      <p className="mt-1 text-sm text-muted-foreground break-words">
                        {pendingHabitSuggestion.descricao}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ATRIBUTO_LABELS[pendingHabitSuggestion.atributo] ??
                        pendingHabitSuggestion.atributo}{" "}
                      · +{pendingHabitSuggestion.xp_recompensa} XP
                      {pendingHabitSuggestion.categoria
                        ? ` · ${pendingHabitSuggestion.categoria}`
                        : ""}
                    </p>
                    <p className="mt-2 text-xs text-hero/90">
                      Aceite para adicionar à sua lista de hábitos.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="shadow-hero"
                        disabled={habitSuggestM.isPending}
                        onClick={() =>
                          habitSuggestM.mutate({
                            messageId: pendingHabitSuggestion.messageId,
                            action: "accept",
                          })
                        }
                      >
                        <Check className="h-4 w-4" /> Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={habitSuggestM.isPending}
                        onClick={() =>
                          habitSuggestM.mutate({
                            messageId: pendingHabitSuggestion.messageId,
                            action: "decline",
                          })
                        }
                      >
                        <X className="h-4 w-4" /> Agora não
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
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
                        <h2 className="font-display text-lg leading-tight break-words">{c.titulo}</h2>
                        <p className="mt-1 text-sm text-muted-foreground break-words">{c.descricao}</p>
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
        </>
      )}

      <div
        className={cn(
          focusMode &&
            "fixed inset-0 z-50 flex items-center justify-center bg-background/55 p-3 backdrop-blur-[2px] sm:p-5",
        )}
      >
        <div
          className={cn(
            "cp-modal cp-brackets flex min-w-0 flex-col overflow-hidden border border-transparent bg-card/95",
            focusMode
              ? "h-[min(92dvh,860px)] w-full max-w-3xl"
              : "h-[min(62dvh,640px)] w-full",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-1.5 sm:px-4">
            <p className="truncate text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              {focusMode ? "Modo foco" : "Conversa"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleFocusMode}
              aria-pressed={focusMode}
              aria-label={focusMode ? "Mostrar menu e navbar" : "Esconder menu e navbar"}
              title={focusMode ? "Mostrar menu" : "Ampliar área do chat"}
            >
              <img
                src="/icons/full-screen-chat.png"
                alt=""
                className="mentor-focus-icon h-3.5 w-3.5 object-contain"
                aria-hidden
              />
              <span className="hidden sm:inline">
                {focusMode ? "Mostrar menu" : "Ampliar chat"}
              </span>
            </Button>
          </div>

          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div className="space-y-4 px-4 py-5 sm:px-5">
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

          <div className="shrink-0 border-t border-border/60 bg-background/40 p-3 sm:p-4">
            {pendingQuestion && !sendM.isPending && (
              <div className="mb-3 min-w-0 space-y-2 border-l-2 border-hero/50 pl-3">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">
                  Charlie pergunta
                </p>
                <p className="text-sm leading-snug break-words">{pendingQuestion.prompt}</p>
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

            <div className="flex min-w-0 items-end gap-2">
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
                className="min-h-[2.75rem] min-w-0 flex-1 resize-none bg-surface"
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

  const content = displayMentorContent(message.content, message.role);

  return (
    <div className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "min-w-0 max-w-[min(88%,24rem)] px-4 py-3 sm:max-w-[min(80%,28rem)]",
          isUser ? "bg-hero pr-5 text-hero-foreground" : "bg-surface pl-5 text-foreground",
        )}
        style={{
          clipPath: isUser
            ? "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))"
            : "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
        }}
      >
        {!isUser && kindLabel && (
          <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-hero">{kindLabel}</p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
          {content}
        </p>
      </div>
    </div>
  );
}

/** Evita mostrar JSON cru / lixo de truncamento em mensagens já salvas. */
function displayMentorContent(content: string, role: string) {
  if (role !== "assistant") return content;
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"message"')) {
    return parseMentorAiPayload(trimmed).message;
  }
  return trimmed.replace(/(?:<\/){2,}/g, "").replace(/<\/+$/g, "").trim() || content;
}
