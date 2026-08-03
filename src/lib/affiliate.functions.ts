import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CANAIS = ["instagram", "youtube", "tiktok", "twitter", "pagina", "podcast", "outro"] as const;

const submitSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  canal_principal: z.enum(CANAIS),
  handle_ou_url: z.string().trim().min(2, "Informe @, link ou nome do canal").max(240),
  audiencia_aprox: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  mensagem: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  outros_canais: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type AffiliateCanal = (typeof CANAIS)[number];

export const AFFILIATE_CANAL_OPTIONS: { value: AffiliateCanal; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "X / Twitter" },
  { value: "pagina", label: "Página / blog" },
  { value: "podcast", label: "Podcast" },
  { value: "outro", label: "Outro" },
];

/**
 * Cadastro público no programa de parceiros (não cria conta Auth / herói).
 * Escrita via service role — RLS bloqueia anon na tabela.
 */
export const submitAffiliateApplication = createServerFn({ method: "POST" })
  .validator((i: unknown) => submitSchema.parse(i))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    const { data: existing, error: lookErr } = await supabaseAdmin
      .from("affiliate_applications")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (lookErr) {
      throw new Error(
        /affiliate_applications|schema cache|does not exist/i.test(lookErr.message)
          ? "Tabela de parceiros ainda não existe no banco. Rode a migration 20260803134500_affiliate_applications.sql."
          : lookErr.message,
      );
    }

    if (existing) {
      throw new Error(
        "Já recebemos uma inscrição com este e-mail. Em breve entraremos em contato.",
      );
    }

    const { error } = await supabaseAdmin.from("affiliate_applications").insert({
      nome: data.nome,
      email,
      telefone: data.telefone,
      canal_principal: data.canal_principal,
      handle_ou_url: data.handle_ou_url,
      audiencia_aprox: data.audiencia_aprox,
      mensagem: data.mensagem,
      outros_canais: data.outros_canais,
      status: "pending",
    });

    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        throw new Error(
          "Já recebemos uma inscrição com este e-mail. Em breve entraremos em contato.",
        );
      }
      throw new Error(error.message);
    }

    return { ok: true as const };
  });
