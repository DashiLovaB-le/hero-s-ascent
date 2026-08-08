import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Shell Capacitor — Live URL (produção) na fase interna.
 * Trocar para assets embutidos na release de loja (ver PlanejamentoMobile-Capacitor.md §5).
 */
const config: CapacitorConfig = {
  appId: "com.vproject.app",
  appName: "V-Project",
  webDir: "www",
  server: {
    // Fase interna: carrega a web canônica (não danifica o build web).
    url: "https://v-project-rho.vercel.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#1B1B1B",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#1B1B1B",
  },
};

export default config;
