"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { invalidateAllResults } from "@/lib/cache";
import { AdminInputError, fieldInt, fieldText, runAdminAction } from "@/lib/admin/action";
import type { ActionResult } from "@/lib/admin/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fix an event's display name, date or organizer. The year follows the date. */
export async function updateEventAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const id = fieldInt(fd, "event_id");
    const name = fieldText(fd, "name", 200);
    const date = fieldText(fd, "date_of_event", 10);
    const organizer = fieldText(fd, "organizer", 100) || null;
    if (!name) throw new AdminInputError("Name can't be empty.");
    if (date && (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date)))) throw new AdminInputError("Date must be YYYY-MM-DD.");

    const changes = { name, date_of_event: date || null, organizer, ...(date ? { year: Number(date.slice(0, 4)) } : {}) };
    const { error } = await adminClient().from("events").update(changes).eq("id", id);
    if (error) throw new Error(`Update failed: ${error.message}`);

    invalidateAllResults();
    await logAudit({ event_type: "admin_event_updated", user_id: admin.id, payload: { event_id: id, ...changes } });
    revalidatePath(`/admin/events/${id}`);
    return "Saved. Public pages refreshed.";
  });
}
