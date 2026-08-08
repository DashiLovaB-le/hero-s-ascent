import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { initNativeShell, isNativePlatform } from "@/lib/platform";
import { attachNativeOAuthDeepLinkListener } from "@/lib/native-oauth";
import { attachNativePushTapHandler } from "@/notifications/push-native-client";

/** Boot do shell Capacitor — no-op no browser. */
export function NativeShellHost() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePlatform()) return;
    void initNativeShell();
  }, []);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let dispose: (() => void) | undefined;
    void (async () => {
      dispose = await attachNativeOAuthDeepLinkListener({
        onSuccess: () => {
          void router.navigate({ to: "/auth", replace: true });
        },
        onError: (message) => {
          toast.error(message);
          void router.navigate({ to: "/auth", replace: true });
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
