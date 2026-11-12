import type { Metadata } from "next";
import { RoleSwitch } from "@/components/RoleSwitch";
import { appPath } from "@/lib/base-path";

export const metadata: Metadata = { title: "Sori draft" };

export default function FailDeliveryPage() {
  return (
    <>
      <div data-briefpay-chrome className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sheet px-4 py-3 text-sm">
        <a href={appPath("/jobs")}>Back to BriefPay</a>
        <RoleSwitch />
      </div>
      <main data-delivery className="bg-[#f4f7f4] text-[#163028]">
        <section data-hero className="bg-moss-deep px-5 py-16 text-white sm:px-10">
          <p className="text-sm">Draft</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">Sori</h1>
          <p className="mt-4 max-w-xl text-lg leading-8">A practice-room introduction is in progress. Booking steps and prices are not set yet.</p>
        </section>
        <section data-pricing className="mx-auto max-w-xl px-5 py-14">
          <article data-plan className="rounded-2xl border border-[#c9d7ce] bg-white p-5">
            <h2 className="text-2xl font-semibold tracking-tight">Coming soon</h2>
            <p className="mt-3 text-sm leading-6">Only one plan is listed, and the price is blank.</p>
          </article>
        </section>
        <p className="px-5 pb-16 text-sm">This page is still a draft. It has no action button and no contact form.</p>
      </main>
    </>
  );
}
