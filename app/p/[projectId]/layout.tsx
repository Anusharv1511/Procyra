import AppShell from "@/components/AppShell";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
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
      items: [
        { label: "Playbooks", href: `${base}/playbooks` },
        { label: "A3 report", href: `${base}/report` },
      ],
    },
    {
      section: "Measure & analyze",
      items: [
        { label: "Control charts (SPC)", href: `${base}/spc` },
        { label: "Process capability", href: `${base}/capability` },
        { label: "Time study", href: `${base}/timestudy` },
        { label: "Gage R&R / MSA", href: `${base}/gagerr` },
        { label: "DOE", href: `${base}/doe` },
      ],
    },
    {
      section: "Monitor & track",
      items: [
        { label: "OEE", href: `${base}/oee` },
        { label: `${T.defects} & Pareto`, href: `${base}/nc` },
        { label: "CAPA", href: `${base}/capa` },
        { label: "Yield / scrap", href: `${base}/yield` },
        { label: "SMED / changeover", href: `${base}/smed` },
      ],
    },
    {
      section: "Risk & compliance",
      items: [
        { label: "FMEA", href: `${base}/fmea` },
        { label: "Decision log", href: `${base}/decisions` },
        { label: "Acceptance sampling", href: `${base}/sampling` },
        { label: "Control plans", href: `${base}/controlplans` },
        { label: "8D", href: `${base}/8d` },
        { label: `Audits (${T.qualityStandard})`, href: `${base}/audit` },
      ],
    },
    {
      section: "Plan & schedule",
      items: [
        { label: "Recurring tasks", href: `${base}/tasks` },
        { label: "Line balancing", href: `${base}/linebalance` },
        { label: "Capacity & bottlenecks", href: `${base}/capacity` },
        { label: "Inventory (EOQ/ABC)", href: `${base}/inventory` },
        { label: "Gantt / CPM", href: `${base}/gantt` },
      ],
    },
  ];

  return (
    <AppShell userName={user.name} projectName={project.name} projectHref={base}>
      <KeyboardShortcuts />
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
