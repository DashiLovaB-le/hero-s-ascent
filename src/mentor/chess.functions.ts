import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyChessGameResult,
  clampChessLevel,
  defaultChessProgress,
  isSelectableChessLevel,
  type ChessProgress,
  type ChessTerminalStatus,
  CHESS_MAX_LEVEL,
  CHESS_MIN_LEVEL,
} from "@/mentor/chess-progress";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const statusSchema = z.enum(["active", "paused", "won", "lost", "draw"]);
const levelSchema = z.number().int().min(CHESS_MIN_LEVEL).max(CHESS_MAX_LEVEL);

export type CharlieChessGame = {
  id: string;
  fen: string;
  pgn: string;
  status: z.infer<typeof statusSchema>;
  player_color: "w" | "b";
  result_reason: string | null;
  difficulty_level: number;
  updated_at: string;
};

export type CharlieChessProgress = ChessProgress;

const GAME_COLS =
  "id, fen, pgn, status, player_color, result_reason, difficulty_level, updated_at";

function mapRow(row: Record<string, unknown>): CharlieChessGame {
  const difficulty = clampChessLevel(Number(row.difficulty_level) || 1);
  return {
    id: String(row.id),
    fen: String(row.fen ?? START_FEN),
    pgn: String(row.pgn ?? ""),
    status: statusSchema.parse(row.status ?? "active"),
    player_color: row.player_color === "b" ? "b" : "w",
    result_reason: typeof row.result_reason === "string" ? row.result_reason : null,
    difficulty_level: difficulty,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapProgress(row: Record<string, unknown> | null | undefined): ChessProgress {
  if (!row) return defaultChessProgress();
  return {
    level: clampChessLevel(Number(row.level) || 1),
    wins_at_level: Math.max(0, Math.min(3, Number(row.wins_at_level) || 0)),
    wins_total: Math.max(0, Number(row.wins_total) || 0),
    losses_total: Math.max(0, Number(row.losses_total) || 0),
    draws_total: Math.max(0, Number(row.draws_total) || 0),
  };
}

async function ensureProgress(userId: string): Promise<ChessProgress> {
  const { data, error } = await supabaseAdmin
    .from("charlie_chess_progress")
    .select("level, wins_at_level, wins_total, losses_total, draws_total")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !/does not exist|charlie_chess_progress|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }
  if (data) return mapProgress(data as Record<string, unknown>);

  const { data: created, error: cErr } = await supabaseAdmin
    .from("charlie_chess_progress")
    .upsert(
      {
        user_id: userId,
        level: 1,
        wins_at_level: 0,
        wins_total: 0,
        losses_total: 0,
        draws_total: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("level, wins_at_level, wins_total, losses_total, draws_total")
    .single();

  if (cErr) {
    if (/does not exist|charlie_chess_progress|schema cache/i.test(cErr.message)) {
      return defaultChessProgress();
    }
    throw new Error(cErr.message);
  }
  return mapProgress(created as Record<string, unknown>);
}

async function persistProgress(userId: string, progress: ChessProgress): Promise<void> {
  const { error } = await supabaseAdmin.from("charlie_chess_progress").upsert(
    {
      user_id: userId,
      level: progress.level,
      wins_at_level: progress.wins_at_level,
      wins_total: progress.wins_total,
      losses_total: progress.losses_total,
      draws_total: progress.draws_total,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error && !/does not exist|charlie_chess_progress|schema cache/i.test(error.message)) {
    console.error("[chess] persist progress", error.message);
  }
}

async function applyTerminalResult(
  userId: string,
  game: { status: string; difficulty_level: number },
  nextStatus: ChessTerminalStatus,
): Promise<{ progress: ChessProgress; leveledUp: boolean } | null> {
  if (game.status === "won" || game.status === "lost" || game.status === "draw") {
    return null;
  }
  const prev = await ensureProgress(userId);
  const applied = applyChessGameResult(prev, {
    status: nextStatus,
    difficultyLevel: game.difficulty_level,
  });
  const { leveledUp, previousLevel: _prevLevel, ...progress } = applied;
  void _prevLevel;
  await persistProgress(userId, progress);
  return { progress, leveledUp };
}

export const getChessProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CharlieChessProgress> => {
    return ensureProgress(context.userId);
  });

/** Carrega partida aberta (active/paused) ou cria uma nova no nível atual. */
export const getOrCreateChessGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CharlieChessGame> => {
    const { supabase, userId } = context;
    const progress = await ensureProgress(userId);

    const { data: open, error } = await supabase
      .from("charlie_chess_games")
      .select(GAME_COLS)
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && !/charlie_chess_games|schema cache|does not exist/i.test(error.message)) {
      throw new Error(error.message);
    }
    if (open) return mapRow(open as Record<string, unknown>);

    const { data: created, error: cErr } = await supabase
      .from("charlie_chess_games")
      .insert({
        user_id: userId,
        fen: START_FEN,
        pgn: "",
        status: "active",
        player_color: "w",
        difficulty_level: progress.level,
      })
      .select(GAME_COLS)
      .single();

    if (cErr) throw new Error(cErr.message);
    return mapRow(created as Record<string, unknown>);
  });

export const saveChessGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        fen: z.string().min(10).max(120),
        pgn: z.string().max(20_000).optional(),
        status: statusSchema.optional(),
        result_reason: z.string().max(40).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    try {
      // eslint-disable-next-line no-new
      new Chess(data.fen);
    } catch {
      throw new Error("Posição de xadrez inválida.");
    }

    const { data: existing, error: eErr } = await supabase
      .from("charlie_chess_games")
      .select("id, status, difficulty_level")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!existing) throw new Error("Partida não encontrada.");

    const patch: {
      fen: string;
      updated_at: string;
      pgn?: string;
      status?: z.infer<typeof statusSchema>;
      result_reason?: string | null;
    } = {
      fen: data.fen,
      updated_at: new Date().toISOString(),
    };
    if (data.pgn !== undefined) patch.pgn = data.pgn;
    if (data.status !== undefined) patch.status = data.status;
    if (data.result_reason !== undefined) patch.result_reason = data.result_reason;

    let progressUpdate: { progress: ChessProgress; leveledUp: boolean } | null = null;
    if (data.status === "won" || data.status === "lost" || data.status === "draw") {
      progressUpdate = await applyTerminalResult(
        userId,
        {
          status: String(existing.status),
          difficulty_level: clampChessLevel(Number(existing.difficulty_level) || 1),
        },
        data.status,
      );
    }

    const { data: row, error } = await supabase
      .from("charlie_chess_games")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(GAME_COLS)
      .single();

    if (error) throw new Error(error.message);
    return {
      game: mapRow(row as Record<string, unknown>),
      progress: progressUpdate?.progress ?? null,
      leveledUp: progressUpdate?.leveledUp ?? false,
    };
  });

export const startNewChessGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        difficultyLevel: levelSchema.optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<CharlieChessGame> => {
    const { supabase, userId } = context;
    const progress = await ensureProgress(userId);
    const chosen = data.difficultyLevel ?? progress.level;
    if (!isSelectableChessLevel(progress.level, chosen)) {
      throw new Error("Escolha um nível que você já desbloqueou.");
    }

    await supabase
      .from("charlie_chess_games")
      .update({
        status: "draw",
        result_reason: "abandoned",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .in("status", ["active", "paused"]);

    const { data: created, error } = await supabase
      .from("charlie_chess_games")
      .insert({
        user_id: userId,
        fen: START_FEN,
        pgn: "",
        status: "active",
        player_color: "w",
        difficulty_level: chosen,
      })
      .select(GAME_COLS)
      .single();

    if (error) throw new Error(error.message);
    return mapRow(created as Record<string, unknown>);
  });
