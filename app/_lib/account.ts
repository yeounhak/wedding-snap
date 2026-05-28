import "server-only";

import { readJobRecord } from "./generate-jobs";
import { createSupabaseAdminClient } from "./supabase/admin";

const JOBS_BUCKET = process.env.WEDDING_SNAP_STORAGE_BUCKET ?? "wedding-snap-jobs";

/**
 * Permanently delete a user's account and all of their data.
 *
 * Order matters: jobs reference `auth.users` with ON DELETE SET NULL, so we
 * must collect and delete the user's jobs (and their storage objects) *before*
 * deleting the auth user — otherwise the user_id link is lost. Deleting the
 * auth user then cascades credits, payment orders, and login unlocks.
 */
export async function deleteAccount(userId: string) {
  const admin = createSupabaseAdminClient();

  // 1. Jobs the user owns (credit_clean) plus any job they unlocked at login —
  //    both contain their (and their partner's) photos.
  const [owned, unlocks] = await Promise.all([
    admin.from("generation_jobs").select("id").eq("user_id", userId),
    admin.from("job_unlocks").select("job_id").eq("user_id", userId),
  ]);
  if (owned.error) throw owned.error;
  if (unlocks.error) throw unlocks.error;

  const jobIds = new Set<string>();
  for (const row of owned.data ?? []) jobIds.add(row.id as string);
  for (const row of unlocks.data ?? []) jobIds.add(row.job_id as string);

  // 2. Remove the uploaded originals and generated results from storage.
  const objectPaths: string[] = [];
  for (const jobId of jobIds) {
    const record = await readJobRecord(jobId).catch(() => null);
    if (!record) continue;
    if (record.input.maleObjectPath) {
      objectPaths.push(record.input.maleObjectPath);
    }
    if (record.input.femaleObjectPath) {
      objectPaths.push(record.input.femaleObjectPath);
    }
    if (record.result) {
      objectPaths.push(
        record.result.cleanObjectPath,
        record.result.watermarkedObjectPath,
      );
    }
  }
  if (objectPaths.length > 0) {
    const { error } = await admin.storage.from(JOBS_BUCKET).remove(objectPaths);
    if (error) throw error;
  }

  // 3. Delete the job rows (cascades job_unlocks for these jobs; nulls any
  //    credit ledger back-reference).
  if (jobIds.size > 0) {
    const { error } = await admin
      .from("generation_jobs")
      .delete()
      .in("id", [...jobIds]);
    if (error) throw error;
  }

  // 4. Delete the auth user — cascades generation_credits, payment_orders, and
  //    remaining job_unlocks via their ON DELETE CASCADE foreign keys.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
