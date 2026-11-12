import Link from "next/link";
import { RoleSwitch } from "@/components/RoleSwitch";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-sheet">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5">
        <div className="flex items-center">
          <Link href="/" className="mr-2 text-[0.9375rem] font-semibold tracking-tight text-ink">
            BriefPay
          </Link>
          <nav className="flex items-center">
            <Link href="/jobs" className="nav-link">
              Jobs
            </Link>
            <Link href="/jobs/new" className="nav-link">
              New job
            </Link>
          </nav>
        </div>
        <RoleSwitch />
      </div>
    </header>
  );
}
