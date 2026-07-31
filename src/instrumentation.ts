/**
 * OpenTelemetry — API leve sempre disponível; SDK pesado só sob demanda.
 * No Vite DEV o NodeSDK/auto-instrumentations travam o SSR (fetchModule timeout).
 * Ative no local com OTEL_ENABLED=true se precisar testar telemetria.
 */
import {
  SpanStatusCode,
  trace,
  type Span,
} from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";

type OtelSdk = {
  start: () => void;
  shutdown: () => Promise<void>;
};

let sdk: OtelSdk | undefined;
let startAttempted = false;

function envFlag(name: string): string {
  return (process.env[name] ?? "").trim().toLowerCase();
}

function shouldStartOtel(): boolean {
  // Vite SSR: NodeSDK/auto-instrumentations travam o module-runner (fetchModule 60s).
  // Telemetria local: use build/preview, não `vite dev`.
  if (import.meta.env.DEV) return false;
  if (envFlag("OTEL_ENABLED") === "false") return false;
  return true;
}

function baseUrl(): string {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  return endpoint.replace(/\/$/, "");
}

export async function startOpenTelemetry(): Promise<void> {
  if (startAttempted || sdk || !shouldStartOtel()) return;
  startAttempted = true;

  try {
    const [
      { DiagConsoleLogger, DiagLogLevel, diag },
      { getNodeAutoInstrumentations },
      { OTLPLogExporter },
      { OTLPMetricExporter },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { BatchLogRecordProcessor },
      { PeriodicExportingMetricReader },
      { NodeSDK },
      semconv,
    ] = await Promise.all([
      import("@opentelemetry/api"),
      import("@opentelemetry/auto-instrumentations-node"),
      import("@opentelemetry/exporter-logs-otlp-http"),
      import("@opentelemetry/exporter-metrics-otlp-http"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/sdk-logs"),
      import("@opentelemetry/sdk-metrics"),
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/semantic-conventions"),
    ]);

    if (envFlag("OTEL_DEBUG") === "true") {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    const url = baseUrl();
    const serviceName = process.env.OTEL_SERVICE_NAME ?? "hero-s-ascent";
    const environment =
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

    const resource = resourceFromAttributes({
      [semconv.ATTR_SERVICE_NAME]: serviceName,
      [semconv.ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
      [semconv.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    });

    const instance = new NodeSDK({
      resource,
      traceExporter: new OTLPTraceExporter({ url: `${url}/v1/traces` }),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${url}/v1/metrics` }),
          exportIntervalMillis: 10_000,
        }),
      ],
      logRecordProcessors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: `${url}/v1/logs` }),
        }),
      ],
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-dns": { enabled: false },
          "@opentelemetry/instrumentation-net": { enabled: false },
        }),
      ],
    });

    instance.start();
    sdk = instance;

    const shutdown = async () => {
      try {
        await sdk?.shutdown();
      } catch (error) {
        console.error("[otel] shutdown failed", error);
      }
    };

    process.once("SIGTERM", () => void shutdown());
    process.once("SIGINT", () => void shutdown());

    console.info(`[otel] exporting to ${url} as ${serviceName}`);
  } catch (error) {
    console.error("[otel] failed to start", error);
  }
}

export function recordExceptionOnActiveSpan(error: unknown): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  recordExceptionOnSpan(span, error);
}

export function recordExceptionOnSpan(span: Span, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

  try {
    const logger = logs.getLogger("hero-s-ascent");
    logger.emit({
      severityText: "ERROR",
      body: err.message,
      attributes: {
        "exception.type": err.name,
        "exception.message": err.message,
        "exception.stacktrace": err.stack ?? "",
      },
    });
  } catch {
    // Logger may be unavailable before SDK starts.
  }
}
