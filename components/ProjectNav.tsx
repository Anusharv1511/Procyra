"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href?: string; soon?: string };
type NavGroup = { section: string; items: NavItem[] };

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden className="shrink-0">
      <path
        d="M4 7V5a4 4 0 0 1 8 0v2M3.5 7h9a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProjectNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-4 text-sm md:sticky md:top-20 self-start">
      {groups.map(g => (
        <div key={g.section}>
          <div className="eyebrow mb-1">{g.section}</div>
          <ul className="space-y-0.5">
            {g.items.map(item => {
              const active = !!item.href && (pathname === item.href || pathname?.startsWith(item.href + "/"));
              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded px-2 py-1 border-l-2 transition-colors ${
                        active
                          ? "border-accent bg-white shadow-sm font-semibold text-ink"
                          : "border-transparent hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className="flex items-center justify-between gap-2 rounded px-2 py-1 border-l-2 border-transparent text-steel cursor-default"
                      title={`Planned for ${item.soon} — not yet functional`}
                    >
                      <span>{item.label}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-steel">
                        <LockIcon />{item.soon}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
