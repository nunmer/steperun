# Database management

Supabase project `ddohlplxshswvbittecv`. Migrations are plain SQL that you run
by hand in the **SQL Editor**; nothing applies them automatically. All of them
are idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`).

## Migration order and status

Status checked against the live database on 2026-10-21.

| # | File | What it does | Applied |
|---|---|---|---|
| 0 | `schema.sql` | Core `events`, `runners`, `results`, view `v_results`, indexes | ✅ |
| 1 | `add_elo.sql` | `runners.elo_score`, `elo_level` | ✅ |
| 2 | `add_claims.sql` | Auth tables (`user_profiles`, `runner_claims`, `runner_claim_evidence`, `strava_tokens`, `disputes`, `claim_audit_log`, `rate_limit_log`), RLS, triggers | ✅ |
| 3 | `add_coins.sql` | `coin_transactions` ledger, `user_profiles.coins` | ✅ |
| 4 | `fn_award_coins.sql` | `award_coins_once()` admin helper (revoked from API roles) | ✅ |
| 5 | `fn_delete_user.sql` | `delete_user_by_email()` admin helper (revoked from API roles) | ✅ |
| 6 | `add_run_analyzer.sql` | `run_sessions`, `run_frames`, `run-frames` bucket policies | ✅ |
| 7 | `add_is_key_frame.sql` | `run_frames.is_key_frame` | ✅ |
| 8 | `001_perf_indexes_and_rpcs.sql` ⚠️ partly: `get_event_categories_by_id` was missing (re-created by 005) | Ranking/ELO indexes + RPCs (`get_event_years`, `get_rankings_by_distance`, `get_event_stats`, `get_runner_full`, …) | ✅ |
| 9 | `add_coin_packs.sql` | `coin_transactions.paddle_transaction_id` + partial unique index | ✅ |
| 10 | `fn_apply_coin_tx.sql` | `apply_coin_tx()`: atomic ledger + balance (needs #9) | ✅ |
| 11 | `002_security_hardening.sql` | Revokes admin functions from anon/authenticated, drops over-broad policies | ✅ |
| 12 | `add_session_coins_charged.sql` | `run_sessions.coins_charged` + `(user_id, status, updated_at)` index | ✅ |
| 13 | `003_enable_rls_core_tables.sql` | RLS on `runners`/`events`/`results`, `v_results` `security_invoker` | ✅ |
| 14 | `004_event_organizer.sql` | `events.organizer` + fill by source | ✅ |
| 15 | `005_site_audit_fixes.sql` | `get_event_categories_by_id` (was missing), `get_distance_options` (formalized), `get_rankings_page`, `fold_name` + `search_runners` (Latin/Cyrillic search), composite event-results index, drops 4 redundant indexes, null-year fix | ✅ |

**New migrations:** name them `NNN_description.sql` (next is `006_…`), add a row
here, and run the migration *before* deploying code that depends on it.
Otherwise queries that select a missing column return nothing, and pages show
up empty.

Quick checks:

```sql
-- Public tables without RLS (should return no rows)
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- API roles must not execute admin/ledger functions (all false)
SELECT has_function_privilege('anon', 'apply_coin_tx(uuid,int,text,int,text)', 'EXECUTE'),
       has_function_privilege('authenticated', 'apply_coin_tx(uuid,int,text,int,text)', 'EXECUTE');
```

## Access model

- **The web server uses the service role for every query.** The anon key is
  used only for browser auth and the signed video upload.
- RLS is enabled everywhere. The core tables have no anon policies, so anon
  reads return `[]`.
- `SECURITY DEFINER` functions always end with
  `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated; GRANT … TO service_role`.
- A policy without `TO <role>` applies to *all* roles. Always name the role.

## Storage buckets

| Bucket | Public | Limits | Contents |
|---|---|---|---|
| `run-frames` | yes | — | Key frames `<user>/<session>/<idx>_key_<phase>.jpg` |
| `run-videos` | no | 50 MB, `video/*` | Uploaded videos `<user>/<session>/video.<ext>`. Deleted right after extraction |

## Admin functions

Run these in the SQL Editor. They're revoked from the API roles, so the app
can't call them.

### delete_user_by_email

Fully removes a user and everything linked to them (claims, coins, Strava
tokens, audit logs, …), and resets `runners.claimed_by`.

```sql
SELECT delete_user_by_email('user@example.com');
```

### award_coins_once

Idempotent coin award, keyed on `(user, reason, ref_id)`. Pass `NULL` as the
email to run it for all users.

```sql
SELECT * FROM award_coins_once('user@example.com', 10, 'claim_approved', 42);
SELECT * FROM award_coins_once(NULL, 20, 'strava_connected');
```

| Parameter | Description |
|---|---|
| `p_email` | User email, or `NULL` for all users |
| `p_amount` | Coins to award |
| `p_reason` | `'claim_approved'`, `'strava_connected'`, `'event_participation'` |
| `p_ref_id` | Optional reference (claim_id, event_id), used for dedup |

### apply_coin_tx (used by the app)

`apply_coin_tx(user_id, amount, reason, ref_id, paddle_tx_id)` returns
`{"status": "ok" | "insufficient" | "duplicate" | "no_profile", …}`. It inserts
the ledger row and updates the balance in one transaction, and refuses to make
the balance negative.

## Useful queries

```sql
-- Events per organizer
SELECT organizer, count(*), sum(total_results) FROM events GROUP BY 1;

-- Events without results (scraper retries these)
SELECT slug, year FROM events WHERE coalesce(total_results, 0) = 0 ORDER BY year DESC;

-- Stuck run-analyzer sessions
SELECT id, user_id, status, updated_at FROM run_sessions
WHERE status IN ('extracting', 'analyzing') AND updated_at < now() - interval '15 minutes';
```
