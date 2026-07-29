import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminTriggerEdgeJob, adminTriggerJob } from "@/admin/functions";
import { AdminShell, Panel } from "@/admin/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashitecnology/jobs")({
  component: JobsAdminPage,
});

const JOBS = [
  {
    id: "notification-jobs" as const,
    title: "Notification jobs",
    desc: "Reminders de hábitos, streak risk, expire challenges.",
  },
  {
    id: "ml-features-job" as const,
    title: "ML features job",
    desc: "Recomputa features + scores heuristic (até 200 usuários).",
  },
  {
    id: "agent-initiatives-job" as const,
    title: "Agent initiatives job",
    desc: "CF + iniciativas do agente.",
  },
];

function JobsAdminPage() {
  const triggerFn = useServerFn(adminTriggerJob);
  const edgeFn = useServerFn(adminTriggerEdgeJob);
  const [last, setLast] = useState<string>("");

  const local = useMutation({
    mutationFn: async (job: (typeof JOBS)[number]["id"]) =>
      triggerFn({ data: { job, force: true } }),
    onSuccess: (r) => {
      const res = r as { job: string; result: unknown };
      toast.success(`${res.job} OK`);
      setLast(JSON.stringify(res.result, null, 2));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edge = useMutation({
    mutationFn: async (job: (typeof JOBS)[number]["id"]) =>
      edgeFn({ data: { job } }),
    onSuccess: (r) => {
      const res = r as { status: number; body: unknown };
      toast.success(`Edge OK (${res.status})`);
      setLast(JSON.stringify(res.body, null, 2));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Jobs"
      subtitle="Dispare jobs localmente (service role) ou via Edge Function (CRON_SECRET)."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {JOBS.map((job) => (
          <Panel key={job.id} title={job.title}>
            <p className="mb-4 text-sm text-white/50">{job.desc}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={local.isPending}
                onClick={() => local.mutate(job.id)}
                className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
              >
                Rodar local
              </Button>
              <Button
                variant="outline"
                disabled={edge.isPending}
                onClick={() => edge.mutate(job.id)}
              >
                Edge remota
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      {last ? (
        <Panel className="mt-6" title="Último resultado">
          <pre className="max-h-80 overflow-auto text-xs text-white/70">{last}</pre>
        </Panel>
      ) : null}
    </AdminShell>
  );
}
