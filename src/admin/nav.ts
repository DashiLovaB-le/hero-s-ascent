/** Nav da sala de controle /dashitecnology */
export type AdminNavItem = {
  to: string;
  label: string;
  exact?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/dashitecnology", label: "Cockpit", exact: true },
  { to: "/dashitecnology/users", label: "Heróis" },
  { to: "/dashitecnology/habits", label: "Hábitos" },
  { to: "/dashitecnology/goals", label: "Metas" },
  { to: "/dashitecnology/gamification", label: "Gamificação" },
  { to: "/dashitecnology/levels", label: "Níveis" },
  { to: "/dashitecnology/wallpapers", label: "Wallpapers" },
  { to: "/dashitecnology/tokens", label: "Tokens IA" },
  { to: "/dashitecnology/charlie", label: "Charlie" },
  { to: "/dashitecnology/ml", label: "ML" },
  { to: "/dashitecnology/agent", label: "Agente" },
  { to: "/dashitecnology/notifications", label: "Notificações" },
  { to: "/dashitecnology/telegram", label: "Telegram" },
  { to: "/dashitecnology/jobs", label: "Jobs" },
  { to: "/dashitecnology/checkins", label: "Check-ins" },
  { to: "/dashitecnology/content", label: "Conteúdo" },
  { to: "/dashitecnology/system", label: "Sistema" },
  { to: "/dashitecnology/analytics", label: "Analytics" },
];
