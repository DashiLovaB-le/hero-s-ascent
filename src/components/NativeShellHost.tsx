import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { initNativeShell, isNativePlatform } from "@/lib/platform";
import { attachNativeOAuthDeepLinkListener } from "@/lib/native-oauth";
import { attachNativePushTapHandler } from "@/notifications/push-native-client";
import { attachCharlieCallListeners } from "@/lib/charlie-call/client";

/** Boot do shell Capacitor — no-op no browser. */
export function NativeShellHost() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePlatform()) return;
    void initNativeShell();
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/") {
      void router.navigate({ to: "/journey", replace: true });
    }
  }, [router]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let dispose: (() => void) | undefined;
    void (async () => {
      dispose = await attachCharlieCallListeners({
        onAnswered: (e) => {
          void router.navigate({
            to: "/alarm/ritual",
            search: {
              callId: e.callId,
              audioKey: e.audioKey || "classic",
              mode: e.mode || "alarm",
            },
            replace: true,
          } as never);
        },
      });
    })();
    return () => dispose?.();
  }, [router]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let dispose: (() => void) | undefined;
    void (async () => {
      dispose = await attachNativeOAuthDeepLinkListener({
        onSuccess: () => {
          void router.navigate({ to: "/auth", replace: true } as never);
        },
        onError: (message) => {
          toast.error(message);
          void router.navigate({ to: "/auth", replace: true } as never);
        },
      });
    })();
    return () => dispose?.();
  }, [router]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let dispose: (() => void) | undefined;
    void (async () => {
      dispose = await attachNativePushTapHandler((href) => {
        void router.navigate({ to: href as never });
      });
    })();
    return () => dispose?.();
  }, [router]);

  return null;
}
