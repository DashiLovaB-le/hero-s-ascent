import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout: lista (`users.index`) e detalhe (`users.$userId`) renderizam no Outlet. */
export const Route = createFileRoute("/dashitecnology/users")({
  ssr: false,
  component: () => <Outlet />,
});
