import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <div className="sheet p-8">
        <h1 className="page-title">Page not found</h1>
        <p className="mt-2 leading-6 text-muted">Check the address, or go back to the job list.</p>
        <Link href="/" className="btn mt-6 w-fit">
          Home
        </Link>
      </div>
    </main>
  );
}
