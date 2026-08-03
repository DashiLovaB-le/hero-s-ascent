import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlashLabel, CheckItem } from "@/components/landing/LandingChrome";
import {
  AFFILIATE_CANAL_OPTIONS,
  submitAffiliateApplication,
  type AffiliateCanal,
} from "@/lib/affiliate.functions";

export const Route = createFileRoute("/parceiros")({
  ssr: false,
  component: ParceirosPage,
});

function ParceirosPage() {
  const submitFn = useServerFn(submitAffiliateApplication);
  const [done, setDone] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [canal, setCanal] = useState<AffiliateCanal | "">("");
  const [handle, setHandle] = useState("");
  const [audiencia, setAudiencia] = useState("");
  const [mensagem, setMensagem] = useState("");

  const m = useMutation({
    mutationFn: () => {
      if (!canal) throw new Error("Escolha o canal principal.");
      return submitFn({
        data: {
          nome,
          email,
          telefone: telefone || undefined,
          canal_principal: canal,
          handle_ou_url: handle,
          audiencia_aprox: audiencia || undefined,
          mensagem: mensagem || undefined,
        },
      });
    },
    onSuccess: () => {
      setDone(true);
      toast.success("Inscrição recebida");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#1B1B1B] text-[#FFE7D0]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(252,110,32,0.16),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(50,50,50,0.45),_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,231,208,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,231,208,0.15) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt=""
            className="h-7 w-7 object-cover shadow-hero sm:h-8 sm:w-8"
            style={{
              clipPath:
                "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}
          />
          <span className="font-display text-sm font-bold tracking-[0.1em] sm:text-base">
            V-PROJECT
          </span>
        </Link>
        <Link to="/auth">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-none px-3 text-xs text-[#FFE7D0]/80 hover:bg-white/10 hover:text-[#FFE7D0]"
          >
            Entrar
          </Button>
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-16 pt-4 sm:px-6 sm:pt-8">
        <SlashLabel>PARCEIROS // AFILIADOS</SlashLabel>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-[0.04em] sm:text-3xl">
          Ganhe dinheiro com a V-Project.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#FFE7D0]/70 sm:text-base">
          Cadastro gratuito para donos de página e influenciadores. A comissão e o link de afiliado
          ficam na Kiwify — aqui só registramos seu interesse para liberar o acesso ao programa.
        </p>

        <ul className="mt-6 max-w-xl space-y-2">
          <CheckItem>Inscrição free — sem custo para entrar no programa</CheckItem>
          <CheckItem>Comissão e pagamento via Kiwify (não misturado com a conta do app)</CheckItem>
          <CheckItem>Opcional: criar conta de herói para testar a V-Project e entender melhor como funciona a plataforma</CheckItem>
        </ul>

        {done ? (
          <div className="cp-panel cp-brackets mt-10 space-y-5 border-transparent bg-[#323232]/80 p-6 sm:p-8">
            <SlashLabel bar={false}>INSCRIÇÃO RECEBIDA</SlashLabel>
            <h2 className="font-display text-xl font-bold tracking-[0.04em]">
              Em breve falamos com você.
            </h2>
            <p className="text-sm leading-relaxed text-[#FFE7D0]/75">
              Vamos revisar sua inscrição e enviar o link/código de afiliado Kiwify quando aprovado.
              Isso <strong className="font-semibold text-[#FFE7D0]">não</strong> cria login no
              V-Project.
            </p>
            <div className="border border-hero/30 bg-hero/10 p-4">
              <p className="font-display text-sm tracking-[0.04em] text-hero">
                Quer validar o produto antes de oferecer?
              </p>
              <p className="mt-2 text-sm text-[#FFE7D0]/75">
                Crie uma conta normal de herói — igual a qualquer usuário — e teste a jornada por
                dentro. Separado do programa de afiliados.
              </p>
              <Link to="/auth" className="mt-4 inline-block">
                <Button className="rounded-none shadow-hero">Criar conta no V-Project</Button>
              </Link>
            </div>
            <Link
              to="/"
              className="inline-block text-xs uppercase tracking-[0.16em] text-[#FFE7D0]/50 hover:text-[#FFE7D0]"
            >
              Voltar à home
            </Link>
          </div>
        ) : (
          <form
            className="cp-panel cp-brackets mt-10 space-y-4 border-transparent bg-[#323232]/80 p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <SlashLabel bar={false}>FORMULÁRIO</SlashLabel>
            <p className="text-xs text-[#FFE7D0]/55">
              Campos com * são obrigatórios. Não é cadastro de usuário do app.
            </p>

            <div className="space-y-2">
              <Label htmlFor="aff-nome">Nome *</Label>
              <Input
                id="aff-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aff-email">E-mail *</Label>
              <Input
                id="aff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aff-tel">WhatsApp / telefone</Label>
              <Input
                id="aff-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                maxLength={40}
                placeholder="Opcional"
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Canal principal *</Label>
                <Select
                  value={canal || undefined}
                  onValueChange={(v) => setCanal(v as AffiliateCanal)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {AFFILIATE_CANAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aff-handle">@ / link / nome do canal *</Label>
                <Input
                  id="aff-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  maxLength={240}
                  required
                  placeholder="@seuusuario ou URL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aff-aud">Audiência aproximada</Label>
              <Input
                id="aff-aud"
                value={audiencia}
                onChange={(e) => setAudiencia(e.target.value)}
                maxLength={60}
                placeholder="Ex.: 8k no Instagram"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aff-msg">Mensagem</Label>
              <Textarea
                id="aff-msg"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                maxLength={800}
                rows={3}
                placeholder="Como você pretende divulgar? (opcional)"
              />
            </div>

            <Button
              type="submit"
              disabled={m.isPending}
              className="w-full rounded-none shadow-hero sm:w-auto"
            >
              {m.isPending ? "Enviando…" : "Enviar inscrição"}
            </Button>
          </form>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 py-5 text-center text-[10px] tracking-[0.12em] text-[#FFE7D0]/40 sm:text-xs">
        Programa de parceiros · separado da conta de herói · V-PROJECT
      </footer>
    </div>
  );
}
