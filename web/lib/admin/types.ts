/** What an admin form action returns; shown under the form. */
export type ActionResult = { ok: boolean; message: string } | null;

export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
