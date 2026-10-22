import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="py-10 sm:py-16 max-w-2xl">
      <p className="eyebrow">404</p>
      <h1 className="headline text-6xl sm:text-8xl mt-2">
        Did not <span className="text-primary">finish.</span>
      </h1>
      <p className="mt-6 text-muted-foreground">
        This page isn&apos;t on the results sheet. The race or runner may have been renamed or merged with another profile.
      </p>
      <ul className="mt-8 text-sm divide-y border-y max-w-sm">
        {[
          { href: "/runners", label: "Search runners" },
          { href: "/events", label: "Browse races" },
          { href: "/", label: "Home" },
        ].map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="flex justify-between py-2.5 hover:text-primary">
              {label} <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
