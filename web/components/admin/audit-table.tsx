import { RunnerLink, SheetTable, UserLink, fmtDateTime } from "./admin-ui";

export interface AuditRow {
  id: number;
  event_type: string;
  user_id: string | null;
  runner_id: number | null;
  claim_id: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export const AUDIT_COLUMNS = "id, event_type, user_id, runner_id, claim_id, payload, created_at";

/** Audit log rows; `names` maps user ids to display names. */
export function AuditTable({ rows, names }: { rows: AuditRow[]; names: Map<string, string> }) {
  return (
    <SheetTable head={["When", "Event", "User", "Runner", "Claim", "Details"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td className="time text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(r.created_at)}</td>
          <td className="time text-xs whitespace-nowrap">{r.event_type}</td>
          <td className="whitespace-nowrap"><UserLink id={r.user_id} name={r.user_id ? names.get(r.user_id) : null} /></td>
          <td><RunnerLink id={r.runner_id} /></td>
          <td className="time text-xs">{r.claim_id ?? "—"}</td>
          <td className="time text-[11px] text-muted-foreground max-w-[22rem] break-all">
            {r.payload ? JSON.stringify(r.payload).slice(0, 240) : ""}
          </td>
        </tr>
      ))}
    </SheetTable>
  );
}
