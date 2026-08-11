"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { Pause, Play, RotateCcw, X } from "lucide-react";

import {
  getChessProgress,
  getOrCreateChessGame,
  saveChessGame,
  startNewChessGame,
  type CharlieChessGame,
  type CharlieChessProgress,
} from "@/mentor/chess.functions";
import { outcomeFromGame, pickCharlieMove } from "@/mentor/chess-engine";
import {
  CHESS_WINS_TO_ADVANCE,
  defaultChessProgress,
  selectableChessLevels,
} from "@/mentor/chess-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function statusLabel(
  status: CharlieChessGame["status"] | null,
  thinking: boolean,
  booting: boolean,
  selected: boolean,
): string {
  if (booting) return "Carregando partida…";
  if (thinking) return "Charlie está pensando…";
  switch (status) {
    case "won":
      return "Você venceu o Charlie.";
    case "lost":
      return "Charlie venceu desta vez.";
    case "draw":
      return "Empate.";
    case "paused":
      return "Partida pausada — continue quando quiser.";
    default:
      return selected
        ? "Agora toque na casa de destino."
        : "Toque numa peça branca e depois no destino.";
  }
}

export function CharlieChessModal({ open, onOpenChange }: Props) {
  const getFn = useServerFn(getOrCreateChessGame);
  const saveFn = useServerFn(saveChessGame);
  const newFn = useServerFn(startNewChessGame);
  const progressFn = useServerFn(getChessProgress);

  const [gameRow, setGameRow] = useState<CharlieChessGame | null>(null);
  const [progress, setProgress] = useState<CharlieChessProgress>(defaultChessProgress);
  const [chosenLevel, setChosenLevel] = useState(1);
  const [fen, setFen] = useState(START_FEN);
  const [booting, setBooting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [boardWidth, setBoardWidth] = useState(320);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(new Chess(START_FEN));
  const gameRowRef = useRef<CharlieChessGame | null>(null);
  const thinkingRef = useRef(false);
  const fenRef = useRef(START_FEN);

  useEffect(() => {
    gameRowRef.current = gameRow;
  }, [gameRow]);

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  const finished =
    gameRow?.status === "won" || gameRow?.status === "lost" || gameRow?.status === "draw";
  const canPlay =
    Boolean(gameRow) && !finished && gameRow?.status !== "paused" && !thinking && !booting;
  const levels = useMemo(() => selectableChessLevels(progress.level), [progress.level]);

  const syncBoardSize = useCallback(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const w = Math.min(el.clientWidth - 8, 520);
    setBoardWidth(Math.max(240, Math.floor(w)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(syncBoardSize, 50);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncBoardSize) : null;
    if (boardWrapRef.current && ro) ro.observe(boardWrapRef.current);
    window.addEventListener("resize", syncBoardSize);
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", syncBoardSize);
    };
  }, [open, syncBoardSize]);

  const persistNow = useCallback(
    async (next: {
      fen: string;
      pgn?: string;
      status?: CharlieChessGame["status"];
      result_reason?: string | null;
    }) => {
      const current = gameRowRef.current;
      if (!current) return;
      try {
        const res = await saveFn({
          data: {
            id: current.id,
            fen: next.fen,
            pgn: next.pgn,
            status: next.status,
            result_reason: next.result_reason,
          },
        });
        gameRowRef.current = res.game;
        setGameRow(res.game);
        if (res.progress) {
          setProgress(res.progress);
          setChosenLevel((prev) => Math.min(prev, res.progress!.level));
        }
        if (res.leveledUp && res.progress) {
          toast.success(`Nível ${res.progress.level} desbloqueado.`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao salvar partida.");
      }
    },
    [saveFn],
  );

  const persistDebounced = useCallback(
    (next: {
      fen: string;
      pgn?: string;
      status?: CharlieChessGame["status"];
      result_reason?: string | null;
    }) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void persistNow(next);
      }, 400);
    },
    [persistNow],
  );

  const runCharlieMove = useCallback(
    (fromFen: string) => {
      const current = gameRowRef.current;
      if (!current || thinkingRef.current) return;
      thinkingRef.current = true;
      setThinking(true);
      setSelectedSquare(null);
      const level = current.difficulty_level || 1;

      window.setTimeout(() => {
        try {
          const move = pickCharlieMove(fromFen, "b", level);
          const chess = new Chess(fromFen);
          if (move) chess.move(move);
          const nextFen = chess.fen();
          gameRef.current = chess;
          fenRef.current = nextFen;
          setFen(nextFen);

          const out = outcomeFromGame(chess, current.player_color);
          if (out) {
            const updated = {
              ...current,
              fen: nextFen,
              status: out.status,
              result_reason: out.reason,
            };
            gameRowRef.current = updated;
            setGameRow(updated);
            persistDebounced({
              fen: nextFen,
              pgn: chess.pgn(),
              status: out.status,
              result_reason: out.reason,
            });
          } else {
            const updated = { ...current, fen: nextFen, status: "active" as const };
            gameRowRef.current = updated;
            setGameRow(updated);
            persistDebounced({ fen: nextFen, pgn: chess.pgn(), status: "active" });
          }
        } catch (e) {
          console.error("[charlie-chess]", e);
          toast.error("Charlie falhou no lance. Tente de novo.");
        } finally {
          thinkingRef.current = false;
          setThinking(false);
        }
      }, 400);
    },
    [persistDebounced],
  );

  const applyPlayerMove = useCallback(
    (from: Square, to: Square): boolean => {
      const current = gameRowRef.current;
      if (!current) return false;

      const chess = new Chess(fenRef.current);
      if (chess.turn() !== "w") return false;

      let moved;
      try {
        moved = chess.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!moved) return false;

      const nextFen = chess.fen();
      gameRef.current = chess;
      fenRef.current = nextFen;
      setFen(nextFen);
      setSelectedSquare(null);

      const out = outcomeFromGame(chess, current.player_color);
      if (out) {
        const updated = {
          ...current,
          fen: nextFen,
          status: out.status,
          result_reason: out.reason,
        };
        gameRowRef.current = updated;
        setGameRow(updated);
        persistDebounced({
          fen: nextFen,
          pgn: chess.pgn(),
          status: out.status,
          result_reason: out.reason,
        });
        return true;
      }

      const updated = { ...current, fen: nextFen, status: "active" as const };
      gameRowRef.current = updated;
      setGameRow(updated);
      persistDebounced({ fen: nextFen, pgn: chess.pgn(), status: "active" });
      runCharlieMove(nextFen);
      return true;
    },
    [persistDebounced, runCharlieMove],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setBooting(true);
    setError(null);
    setSelectedSquare(null);

    void (async () => {
      try {
        const [row, prog] = await Promise.all([
          getFn({ data: undefined as unknown as never }),
          progressFn({ data: undefined as unknown as never }),
        ]);
        if (cancelled) return;
        const chess = new Chess(row.fen);
        gameRef.current = chess;
        gameRowRef.current = row;
        fenRef.current = chess.fen();
        setGameRow(row);
        setFen(chess.fen());
        setProgress(prog);
        setChosenLevel(row.difficulty_level || prog.level);
        if (row.status === "active" && chess.turn() === "b" && !chess.isGameOver()) {
          runCharlieMove(chess.fen());
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[charlie-chess] boot", e);
        setError(e instanceof Error ? e.message : "Falha ao abrir o xadrez.");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per open
  }, [open]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [] as Square[];
    const chess = new Chess(fen);
    return chess.moves({ square: selectedSquare, verbose: true }).map((m) => m.to as Square);
  }, [fen, selectedSquare]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, Record<string, string>> = {};
    if (selectedSquare) {
      styles[selectedSquare] = { background: "rgba(252,110,32,0.45)" };
    }
    for (const t of legalTargets) {
      styles[t] = { background: "rgba(252,110,32,0.22)" };
    }
    return styles;
  }, [legalTargets, selectedSquare]);

  function handleSquareClick({ square }: { square: string }) {
    if (!canPlay) return;
    const sq = square as Square;
    const chess = new Chess(fenRef.current);
    if (chess.turn() !== "w") return;

    if (selectedSquare) {
      if (selectedSquare === sq) {
        setSelectedSquare(null);
        return;
      }
      if (applyPlayerMove(selectedSquare, sq)) return;
    }
    const piece = chess.get(sq);
    if (piece?.color === "w") setSelectedSquare(sq);
    else setSelectedSquare(null);
  }

  function onPieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!canPlay || !targetSquare) return false;
    return applyPlayerMove(sourceSquare as Square, targetSquare as Square);
  }

  async function handlePause() {
    const current = gameRowRef.current;
    if (!current || finished) return;
    setSelectedSquare(null);
    await persistNow({
      fen: fenRef.current,
      pgn: gameRef.current.pgn(),
      status: "paused",
    });
    toast.message("Partida pausada.");
  }

  async function handleResume() {
    const current = gameRowRef.current;
    if (!current || current.status !== "paused") return;
    await persistNow({ fen: fenRef.current, status: "active" });
    const chess = new Chess(fenRef.current);
    if (chess.turn() === "b" && !chess.isGameOver()) {
      runCharlieMove(fenRef.current);
    }
  }

  async function handleNewGame() {
    setThinking(false);
    thinkingRef.current = false;
    setSelectedSquare(null);
    setBooting(true);
    setError(null);
    try {
      const row = await newFn({ data: { difficultyLevel: chosenLevel } });
      const chess = new Chess(row.fen);
      gameRef.current = chess;
      gameRowRef.current = row;
      fenRef.current = chess.fen();
      setGameRow(row);
      setFen(chess.fen());
      setChosenLevel(row.difficulty_level);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao criar partida.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBooting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      const current = gameRowRef.current;
      if (current && current.status === "active" && !finished) {
        void persistNow({
          fen: fenRef.current,
          pgn: gameRef.current.pgn(),
          status: "paused",
        });
      }
    }
    onOpenChange(next);
  }

  const winProgressLabel =
    progress.level >= 10
      ? "Nível máximo"
      : `${progress.wins_at_level}/${CHESS_WINS_TO_ADVANCE} vitórias no nível ${progress.level}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogContent
        className={cn(
          "z-[70] flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-hero/30 bg-[#14110e] p-0 !left-0 !top-0",
          "data-[state=open]:zoom-in-100",
          "[&>button.absolute]:hidden",
        )}
        style={{
          paddingTop: "max(0.5rem, var(--safe-area-inset-top, 0px))",
          paddingBottom: "max(0.5rem, var(--safe-area-inset-bottom, 0px))",
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const title = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
            "[data-chess-dialog-title]",
          );
          title?.focus();
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b border-border/40 px-4 py-3 text-left">
          <div className="min-w-0 pr-2">
            <DialogTitle
              data-chess-dialog-title
              tabIndex={-1}
              className="font-display text-base tracking-wide outline-none"
            >
              Partida com Charlie
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {statusLabel(gameRow?.status ?? null, thinking, booting, Boolean(selectedSquare))}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {gameRow?.status === "paused" ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => void handleResume()}>
                <Play className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Retomar</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!gameRow || finished || thinking || booting}
                onClick={() => void handlePause()}
              >
                <Pause className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Pausar</span>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={booting}
              onClick={() => void handleNewGame()}
            >
              <RotateCcw className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Nova</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Fechar"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-4">
          {error ? (
            <div className="max-w-md space-y-3 text-center">
              <p className="text-sm text-amber-200/90">{error}</p>
              <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex w-full max-w-[520px] flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  <p>
                    Seu nível:{" "}
                    <span className="font-semibold text-hero">{progress.level}</span>
                    {" · "}
                    {winProgressLabel}
                  </p>
                  <p className="mt-0.5">
                    Placar: {progress.wins_total}V · {progress.draws_total}E ·{" "}
                    {progress.losses_total}D
                    {gameRow ? ` · partida no nível ${gameRow.difficulty_level}` : null}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Jogar no nível
                  <select
                    className="rounded border border-border bg-surface px-2 py-1 text-foreground"
                    value={chosenLevel}
                    disabled={booting || thinking || (Boolean(gameRow) && !finished)}
                    onChange={(e) => setChosenLevel(Number(e.target.value))}
                    title={
                      gameRow && !finished
                        ? "Termine ou inicie uma nova partida para trocar o nível"
                        : undefined
                    }
                  >
                    {levels.map((n) => (
                      <option key={n} value={n}>
                        {n}
                        {n === progress.level ? " (atual)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div
                ref={boardWrapRef}
                className="relative w-full max-w-[520px] touch-manipulation select-none"
                style={{ touchAction: "none" }}
              >
                <Chessboard
                  options={{
                    id: "charlie-chess",
                    position: fen,
                    boardOrientation: "white",
                    allowDragging: canPlay,
                    dragActivationDistance: 4,
                    boardStyle: {
                      width: `${boardWidth}px`,
                      borderRadius: "0",
                      boxShadow: "0 0 0 1px rgba(252,110,32,0.35)",
                    },
                    darkSquareStyle: { backgroundColor: "#3a2a1f" },
                    lightSquareStyle: { backgroundColor: "#c4a574" },
                    squareStyles,
                    animationDurationInMs: 180,
                    canDragPiece: ({ piece }) => canPlay && piece.pieceType.startsWith("w"),
                    onPieceDrop,
                    onSquareClick: handleSquareClick,
                  }}
                />
                {booting || thinking ? (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-xs text-white/80">
                    {booting ? "Sincronizando…" : "Charlie pensando…"}
                  </div>
                ) : null}
              </div>
              <p className="max-w-md text-center text-xs text-muted-foreground">
                3 vitórias no nível atual desbloqueiam o próximo. Você pode revisitar níveis já
                conquistados ao iniciar uma nova partida.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
