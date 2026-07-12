import AppShell from "@/components/AppShell";
import ProjectNav from "@/components/ProjectNav";
import { getSessionUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { terms } from "@/lib/terminology";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: {
  children: React.ReactNode; params: { projectId: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const T = terms(project.workspace.industry);
  const base = `/p/${project.id}`;

  const nav: { section: string; items: { label: string; href?: string; soon?: string }[] }[] = [
    {
      section: "Guided mode",
      items: [{ label: "Playbooks", href: `${base}/playbooks` }],
    },
    {
      section: "Measure & analyze",
      items: [
        { label: "Control charts (SPC)", href: `${base}/spc` },
        { label: "Process capability", href: `${base}/capability` },
        { label: "Time study", href: `${base}/timestudy` },
        { label: "Gage R&R / MSA", soon: "Phase 2" },
        { label: "DOE", soon: "Phase 2" },
      ],
    },
    {
      section: "Monitor & track",
      items: [
        { label: "OEE", href: `${base}/oee` },
        { label: `${T.defects} & Pareto`, href: `${base}/nc` },
        { label: "CAPA", href: `${base}/capa` },
        { label: "Yield / scrap", soon: "Phase 2" },
        { label: "SMED / changeover", soon: "Phase 2" },
      ],
    },
    {
      section: "Risk & compliance",
      items: [
        { label: "FMEA", href: `${base}/fmea` },
        { label: "Decision log", href: `${base}/decisions` },
        { label: "Acceptance sampling", soon: "Phase 2" },
        { label: "Control plans", soon: "Phase 2" },
        { label: "8D", soon: "Phase 2" },
        { label: `Audits (${T.qualityStandard})`, soon: "Phase 3" },
      ],
    },
    {
      section: "Plan & schedule",
      items: [
        { label: "Recurring tasks", href: `${base}/tasks` },
        { label: "Line balancing", soon: "Phase 2" },
        { label: "Capacity & bottlenecks", soon: "Phase 2" },
        { label: "Inventory (EOQ/ABC)", soon: "Phase 2" },
        { label: "Gantt / CPM", soon: "Phase 3" },
      ],
    },
  ];

  return (
    <AppShell userName={user.name} projectName={project.name} projectHref={base}>
      <div className="mb-4">
        <div className="eyebrow">{project.workspace.name} · {project.workspace.industry.replace("_", " ")}</div>
        <Link href={base} className="text-lg font-bold hover:underline">{project.name}</Link>
      </div>
      <div className="grid md:grid-cols-[220px,1fr] gap-6 print-stack">
        <ProjectNav groups={nav} />
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
