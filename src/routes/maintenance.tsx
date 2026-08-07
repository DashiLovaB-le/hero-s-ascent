import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/maintenance")({
  ssr: false,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["maintenance", "status"],
      queryFn: () => runQueryFn(() => getMaintenanceStatus(), "Falha ao carregar status."),
      staleTime: 5_000,
    }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const { data } = useSuspenseQuery({
    queryKey: ["maintenance", "status"],
    queryFn: () => runQueryFn(() => getMaintenanceStatus(), "Falha ao carregar status."),
    staleTime: 5_000,
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(252,110,32,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(50,50,50,0.5),_transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,231,208,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,231,208,0.15) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 w-full max-w-lg text-center">
        <img
          src="/logo.png"
          alt="V-Project"
          className="mx-auto h-14 w-14 rounded-lg opacity-90"
        />
        <p className="mt-6 font-display text-[11px] uppercase tracking-[0.32em] text-[#FC6E20]">
          V-Project
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-wide text-[#FFE7D0] md:text-4xl">
          {data.title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/60 md:text-lg">{data.message}</p>
        {data.eta ? (
          <p className="mt-4 text-sm text-[#FC6E20]/90">{data.eta}</p>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-[#FC6E20] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#FC6E20]/90"
          >
            Tentar de novo
          </button>
        </div>

        <p className="mt-8 text-xs text-white/30">
          Sua jornada e progresso permanecem salvos.
        </p>
      </div>
    </div>
  );
}
