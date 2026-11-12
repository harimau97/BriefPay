import type { Metadata } from "next";
import { RoleSwitch } from "@/components/RoleSwitch";
import { appPath } from "@/lib/base-path";

export const metadata: Metadata = { title: "Sori practice rooms" };

export default function PassDeliveryPage() {
  return (
    <>
      <div data-briefpay-chrome className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sheet px-4 py-3 text-sm">
        <a href={appPath("/jobs")}>Back to BriefPay</a>
        <RoleSwitch />
      </div>
      <main data-delivery className="bg-[#f4f7f4] text-[#163028]">
        <section data-hero className="bg-moss px-5 py-16 text-white sm:px-10">
          <p className="text-sm">Practice room booking</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">Sori</h1>
          <p className="mt-4 max-w-xl text-lg leading-8">Book a practice room by the hour. Compare soundproofing, pianos, and late-night rates on one page.</p>
          <a data-cta href="#pricing" className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-moss-deep">
            Browse rooms
          </a>
        </section>
        <section id="pricing" data-pricing className="mx-auto grid max-w-5xl gap-4 px-5 py-14 sm:grid-cols-3">
          <article data-plan className="rounded-2xl border border-[#c9d7ce] bg-white p-5">
            <h2 className="text-2xl font-semibold tracking-tight">Hourly</h2>
            <p className="mt-3 text-2xl">$12</p>
            <p className="mt-2 text-sm leading-6">1 hour, upright piano, weekday daytime booking.</p>
          </article>
          <article data-plan className="rounded-2xl border border-[#c9d7ce] bg-white p-5">
            <h2 className="text-2xl font-semibold tracking-tight">Membership</h2>
            <p className="mt-3 text-2xl">$89</p>
            <p className="mt-2 text-sm leading-6">8 visits a month, same room first, one late night included.</p>
          </article>
          <article data-plan className="rounded-2xl border border-[#c9d7ce] bg-white p-5">
            <h2 className="text-2xl font-semibold tracking-tight">Studio</h2>
            <p className="mt-3 text-2xl">$210</p>
            <p className="mt-2 text-sm leading-6">4 hours in the recording room, engineer optional.</p>
          </article>
        </section>
        <section className="mx-auto max-w-xl px-5 pb-16">
          <h2 className="text-3xl font-semibold tracking-tight">Contact</h2>
          <form data-contact className="mt-4 grid gap-3" action="#contact">
            <label className="grid gap-1 text-sm">
              Name
              <input className="field" name="name" required />
            </label>
            <label className="grid gap-1 text-sm">
              Email
              <input className="field" type="email" name="email" required />
            </label>
            <label className="grid gap-1 text-sm">
              Message
              <textarea className="field min-h-28" name="message" required />
            </label>
            <button className="inline-flex min-h-11 w-fit items-center rounded-xl bg-moss px-4 text-sm font-semibold text-white" type="submit">
              Send message
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
