import Link from "next/link";
import { logout } from "@/app/actions";
import { ReactNode } from "react";

export default function AppShell({ userName, children, projectName, projectHref }: {
  userName: string; children: ReactNode; projectName?: string; projectHref?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-[#22262b] text-white sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/dashboard" className="font-bold tracking-tight hover:text-gray-200 shrink-0">Procyra</Link>
            <nav className="flex gap-4 text-sm text-gray-300 shrink-0">
              <Link className="hover:text-white transition-colors" href="/dashboard">Dashboard</Link>
              <Link className="hover:text-white transition-colors" href="/projects">Projects</Link>
            </nav>
            {projectName && (
              <>
                <span className="text-gray-600 hidden sm:inline">/</span>
                {projectHref ? (
                  <Link
                    href={projectHref}
                    className="hidden sm:inline text-sm font-semibold text-gray-100 hover:text-white hover:underline truncate"
                    title={projectName}
                  >
                    {projectName}
                  </Link>
                ) : (
                  <span className="hidden sm:inline text-sm font-semibold text-gray-100 truncate" title={projectName}>{projectName}</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="text-gray-300 hidden sm:inline">{userName}</span>
            <form action={logout}><button className="text-gray-300 hover:text-white transition-colors underline">Log out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
