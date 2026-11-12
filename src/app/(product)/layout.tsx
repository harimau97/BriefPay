import { SiteHeader } from "@/components/SiteHeader";

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6">{children}</div>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-xs leading-5 text-faint">
        Funds stay on a PayPal authorization hold and are captured only after review. This is not licensed escrow.
        An authorization hold usually must be captured or released within about 29 days.
      </footer>
    </>
  );
}
