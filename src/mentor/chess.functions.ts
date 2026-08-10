import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const statusSchema = z.enum(["active", "paused", "won", "lost", "draw"]);

export type CharlieChessGame = {
  id: string;
  fen: string;
  pgn: string;
  status: z.infer<typeof statusSchema>;
  player_color: "w" | "b";
  result_reason: string | null;
  updated_at: string;
};

function mapRow(row: Record<string, unknown>): CharlieChessGame {
  return {
    id: String(row.id),
    fen: String(row.fen ?? START_FEN),
    pgn: String(row.pgn ?? ""),
    status: statusSchema.parse(row.status ?? "active"),
    player_color: row.player_color === "b" ? "b" : "w",
    result_reason: typeof row.result_reason === "string" ? row.result_reason : null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/** Carrega partida aberta (active/paused) ou cria uma nova. */
export const getOrCreateChessGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CharlieChessGame> => {
    const { supabase, userId } = context;

    const { data: open, error } = await supabase
      .from("charlie_chess_games")
      .select("id, fen, pgn, status, player_color, result_reason, updated_at")
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
      })
      .select("id, fen, pgn, status, player_color, result_reason, updated_at")
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
  .handler(async ({ context, data }): Promise<CharlieChessGame> => {
    const { supabase, userId } = context;

    // Valida FEN
    try {
      // eslint-disable-next-line no-new
      new Chess(data.fen);
    } catch {
      throw new Error("Posição de xadrez inválida.");
    }

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

    const { data: row, error } = await supabase
      .from("charlie_chess_games")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("id, fen, pgn, status, player_color, result_reason, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapRow(row as Record<string, unknown>);
  });

export const startNewChessGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CharlieChessGame> => {
    const { supabase, userId } = context;

    // Pausa/encerra abertas como abandoned draw? Preferimos marcar paused→lost? Better: set to draw abandoned or leave and create new.
    // Marca partidas abertas como draw/abandoned para liberar.
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
      })
      .select("id, fen, pgn, status, player_color, result_reason, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapRow(created as Record<string, unknown>);
  });
