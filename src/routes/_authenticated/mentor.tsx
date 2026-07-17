import { createFileRoute } from "@tanstack/react-router";
import { MentorPage } from "@/mentor/MentorPage";
import { mentorThreadQueryOptions } from "@/mentor/queries";

/** Rota fina — implementação completa em src/mentor/ */
export const Route = createFileRoute("/_authenticated/mentor")({
  loader: ({ context }) => context.queryClient.ensureQueryData(mentorThreadQueryOptions()),
  errorComponent: ({ error }) => (
    <div className="cp-panel border border-transparent bg-destructive/10 p-6 text-sm text-destructive">
      {error.message || String(error)}
    </div>
  ),
  component: MentorPage,
});
