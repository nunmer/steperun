export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { BackLink, PageHeader } from "@/components/sheet";
import { SectionHead, Stat, fmtDate, fmtDateTime } from "@/components/admin/admin-ui";
import { ActionForm, Field, inputClass } from "@/components/admin/action-form";
import { updateEventAction } from "../actions";

export const metadata = { title: "Event" };

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = adminClient();
  const [{ data: event, error }, organizers] = await Promise.all([
    db.from("events").select("*").eq("id", id).maybeSingle(),
    db.from("events").select("organizer").not("organizer", "is", null),
  ]);
  if (error) throw new Error(`[admin] event failed: ${error.message}`);
  if (!event) notFound();
  const organizerOptions = [...new Set((organizers.data ?? []).map((o) => o.organizer as string))].sort();

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={<BackLink href="/admin/events">Events</BackLink>}
        title={event.name}
        aside={
          <>
            <p className="time text-xs">{event.slug}</p>
            <Link href={`/events/${event.slug}`} target="_blank" className="text-xs hover:underline">Public page ↗</Link>
            {" · "}
            <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline">Source ↗</a>
          </>
        }
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-x-8">
        <Stat label="Results" value={(event.total_results ?? 0).toLocaleString()} />
        <Stat label="Race date" value={<span className="text-2xl">{fmtDate(event.date_of_event)}</span>} />
        <Stat label="Organizer" value={<span className="text-2xl">{event.organizer ?? "—"}</span>} />
        <Stat label="Imported" value={<span className="text-2xl">{fmtDateTime(event.scraped_at)}</span>} />
      </section>

      <section className="max-w-xl">
        <SectionHead title="Edit" />
        <ActionForm action={updateEventAction} label="Save" tone="primary" className="flex-col items-stretch sm:items-start">
          <input type="hidden" name="event_id" value={id} />
          <Field label="Name" className="w-full">
            <input name="name" defaultValue={event.name} required maxLength={200} className={inputClass} />
          </Field>
          <div className="flex gap-2 w-full">
            <Field label="Race date" className="flex-1">
              <input type="date" name="date_of_event" defaultValue={event.date_of_event ?? ""} className={inputClass} />
            </Field>
            <Field label="Organizer" className="flex-1">
              <input name="organizer" list="organizers" defaultValue={event.organizer ?? ""} maxLength={100} className={inputClass} />
              <datalist id="organizers">
                {organizerOptions.map((o) => <option key={o} value={o} />)}
              </datalist>
            </Field>
          </div>
        </ActionForm>
        <p className="text-xs text-muted-foreground mt-4">
          The scraper only re-imports events without results, but if this one is re-imported it overwrites the name
          and organizer (the date is kept). Fix results themselves at the source or with the scripts in{" "}
          <code className="time">scripts/</code>.
        </p>
      </section>
    </div>
  );
}
