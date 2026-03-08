import Link from "next/link";
import { HeadToHead } from "@/components/head-to-head";

export const metadata = { title: "Head to Head" };

export default function HeadToHeadPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/runners"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← All runners
        </Link>
        <h1 className="text-3xl font-bold">Head to Head</h1>
        <p className="text-muted-foreground mt-1">
          Compare two runners side by side
        </p>
      </div>

      <HeadToHead />
    </div>
  );
}
