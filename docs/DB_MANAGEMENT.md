# Database Management Functions

Utility functions for testing and administration. Run in Supabase SQL Editor.

---

## delete_user_by_email

Fully removes a user and all related data (claims, coins, strava tokens, audit logs, etc.). Resets `runners.claimed_by` for any claimed profiles.

```sql
SELECT delete_user_by_email('user@example.com');
-- → 'Deleted user user@example.com (550e8400-...)'
```

**Source:** `migrations/fn_delete_user.sql`

---

## award_coins_once

Idempotently awards coins for an action. Safe to run multiple times — skips if already awarded. Pass `NULL` email to run for all users.

```sql
-- Single user
SELECT * FROM award_coins_once('user@example.com', 10, 'claim_approved', 42);
SELECT * FROM award_coins_once('user@example.com', 20, 'strava_connected');
SELECT * FROM award_coins_once('user@example.com', 20, 'event_participation', 7);

-- All users
SELECT * FROM award_coins_once(NULL, 20, 'strava_connected');
```

| Parameter | Description |
|-----------|-------------|
| `p_email` | User email, or `NULL` for all users |
| `p_amount` | Coins to award |
| `p_reason` | `'claim_approved'`, `'strava_connected'`, or `'event_participation'` |
| `p_ref_id` | Optional reference (claim_id, event_id). Used for dedup |

**Source:** `migrations/fn_award_coins.sql`
