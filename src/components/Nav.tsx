"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/actions";

const DASHBOARD_NAV = { href: "/", label: "Dashboard" };
const LOG_IT_NAV = { href: "/log", label: "Log it" };
const WORKLOAD_NAV = { href: "/workload", label: "Weekly Load" };
const SHOOT_SCHEDULE_NAV = { href: "/shoot-schedule", label: "Shoot Schedule" };
const ADMIN_NAV = { href: "/admin", label: "Admin" };

type NavUser = { name: string; roleLabel: string; isAdmin: boolean; isIpcs: boolean; isCohortLeader: boolean };

function items(user: NavUser) {
  const list = [DASHBOARD_NAV];
  if (user.isAdmin || user.isIpcs || user.isCohortLeader) list.push(LOG_IT_NAV);
  list.push(WORKLOAD_NAV, SHOOT_SCHEDULE_NAV);
  if (user.isAdmin) list.push(ADMIN_NAV);
  return list;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  return (
    <aside
      className="hidden md:flex md:flex-col md:w-[220px] shrink-0 border-r px-4 py-6 gap-1 sticky top-0 h-screen"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <div className="px-2 pb-5">
        <div className="text-[13px] font-extrabold leading-tight" style={{ color: "var(--brand-ink)" }}>
          Insomniacs
        </div>
        <div className="text-[13px] font-extrabold leading-tight" style={{ color: "var(--brand-ink)" }}>
          Kitchen
        </div>
      </div>
      {items(user).map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors"
            style={{
              background: active ? "var(--brand-ink)" : "transparent",
              color: active ? "#fff" : "var(--text-secondary)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto border-t pt-4 px-2" style={{ borderColor: "var(--border)" }}>
        <div className="text-[12px] font-bold">{user.name}</div>
        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {user.roleLabel}
        </div>
        <div className="flex gap-3 mt-2 text-[10.5px]">
          <Link href="/account/password" className="underline" style={{ color: "var(--text-secondary)" }}>
            Change password
          </Link>
          <form action={signOut}>
            <button type="submit" className="underline" style={{ color: "var(--brand-ink)" }}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ user }: { user: NavUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const list = items(user);
  const current = list.find((i) => isActive(pathname, i.href))?.href ?? "/";
  return (
    <div className="md:hidden sticky top-0 z-20 border-b px-4 py-2.5 flex gap-2" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <select
        value={current}
        onChange={(e) => router.push(e.target.value)}
        aria-label="Go to page"
        className="h-9 flex-1 rounded-lg border px-2.5 text-[12px] font-medium"
        style={{ borderColor: "var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)" }}
      >
        {list.map((item) => (
          <option key={item.href} value={item.href}>
            {item.label}
          </option>
        ))}
      </select>
      <form action={signOut}>
        <button type="submit" className="h-9 rounded-lg border px-3 text-[11px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--brand-ink)" }}>
          Sign out
        </button>
      </form>
    </div>
  );
}
