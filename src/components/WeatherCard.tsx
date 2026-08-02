import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudSun, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { getJourneyWeather } from "@/lib/journey.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { runQueryFn } from "@/lib/safe-query";

function fmtTemp(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}°`;
}

/** Previsão do tempo (Open-Meteo) na Jornada — usa a região do perfil. */
export function WeatherCard() {
  const getFn = useServerFn(getJourneyWeather);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["journey-weather"],
    queryFn: () =>
      runQueryFn(() => getFn({ data: undefined as unknown as never }), "Falha ao carregar o clima."),
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-2">
        <CloudSun className="h-4 w-4 text-hero" />
        <h2 className="font-display text-lg font-semibold">Clima</h2>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">Consultando a previsão…</p>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o clima agora. Tente de novo em instantes.
        </p>
      )}

      {!isLoading && !isError && data && !data.configured && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Defina sua cidade no Perfil para ver a previsão do tempo aqui (e no Charlie).
          </p>
          <Link to="/profile">
            <Button size="sm" variant="outline" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Configurar região
            </Button>
          </Link>
        </div>
      )}

      {!isLoading && !isError && data?.configured && !data.weather && (
        <p className="text-sm text-muted-foreground">
          Previsão indisponível para {data.label ?? "sua região"} no momento.
        </p>
      )}

      {!isLoading && !isError && data?.weather && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 text-hero" />
                <span className="truncate">{data.weather.label}</span>
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-hero">
                {fmtTemp(data.weather.tempC)}
              </p>
              <p className="mt-0.5 text-sm capitalize text-foreground/90">
                {data.weather.condition}
              </p>
              {data.weather.feelsLikeC != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sensação {fmtTemp(data.weather.feelsLikeC)}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <p>
                Máx {fmtTemp(data.weather.todayMaxC)} · Mín {fmtTemp(data.weather.todayMinC)}
              </p>
              {data.weather.todayRainChance != null && (
                <p className="mt-1">Chuva {Math.round(data.weather.todayRainChance)}%</p>
              )}
              {data.weather.humidity != null && (
                <p className="mt-1">Umidade {Math.round(data.weather.humidity)}%</p>
              )}
              {data.weather.windKmh != null && (
                <p className="mt-1">Vento {Math.round(data.weather.windKmh)} km/h</p>
              )}
            </div>
          </div>

          {(data.weather.tomorrowMaxC != null || data.weather.tomorrowCondition) && (
            <div className="border-t border-border/70 pt-3 text-sm text-muted-foreground">
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-hero">Amanhã</span>
              <p className="mt-1">
                {fmtTemp(data.weather.tomorrowMinC)} – {fmtTemp(data.weather.tomorrowMaxC)}
                {data.weather.tomorrowCondition
                  ? ` · ${data.weather.tomorrowCondition}`
                  : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
