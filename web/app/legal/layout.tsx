import Link from "next/link";

const SECTIONS = [
  { href: "/legal/terms",   label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy"   },
  { href: "/legal/refund",  label: "Refund Policy"    },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <nav className="flex md:flex-col gap-x-5 text-sm border-b-2 border-rule md:border-b-0 md:border-t-2">
          {SECTIONS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="py-2 md:border-b text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <article
        className={[
          "max-w-3xl text-foreground leading-relaxed",
          "[&_h1]:headline [&_h1]:text-5xl [&_h1]:mt-0 [&_h1]:mb-2",
          "[&_h2]:headline [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3",
          "[&_p]:my-4 [&_p]:text-sm",
          "[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:text-sm [&_ul]:space-y-1.5",
          "[&_li]:marker:text-muted-foreground",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80",
          "[&_strong]:font-semibold [&_strong]:text-foreground",
        ].join(" ")}
      >
        {children}
      </article>
    </div>
  );
}
