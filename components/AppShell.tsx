import Link from "next/link";
import { logout } from "@/app/actions";
import { ReactNode } from "react";

export default function AppShell({ userName, children }: { userName: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-[#22262b] text-white sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold tracking-tight">Procyra</Link>
            <nav className="flex gap-4 text-sm text-gray-300">
              <Link className="hover:text-white" href="/dashboard">Dashboard</Link>
              <Link className="hover:text-white" href="/projects">Projects</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-300 hidden sm:inline">{userName}</span>
            <form action={logout}><button className="text-gray-300 hover:text-white underline">Log out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
