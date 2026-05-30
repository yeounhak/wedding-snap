import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

export type GalleryItem = {
  jobId: string;
  createdAt: string;
  /** Clean (watermark-free) image endpoint. Authorized via the session cookie. */
  resultUrl: string;
  resultUrls: string[];
  venueTitle: string | null;
  venueRentalUrl: string | null;
};

type JobIdRow = {
  id: string;
  created_at: string;
  result_count: number | null;
  venue_title: string | null;
  venue_rental_url: string | null;
};

const GALLERY_SELECT = "id, created_at, result_count, venue_title, venue_rental_url";

function toItem(row: JobIdRow): GalleryItem {
  const resultUrls = Array.from(
    { length: normalizeResultCount(row.result_count) },
    (_, index) => `/api/generate/${row.id}/image?variant=clean&index=${index}`,
  );

  return {
    jobId: row.id,
    createdAt: row.created_at,
    resultUrl: resultUrls[0],
    resultUrls,
    venueTitle: row.venue_title ?? null,
    venueRentalUrl: row.venue_rental_url ?? null,
  };
}

/**
 * Photos a signed-in user can re-open without a watermark: the clean jobs they
 * generated with credits, plus the single anonymous job they unlocked at login.
 * Anonymous device-scoped jobs are intentionally excluded — they belong to the
 * device, not the account.
 */
export async function listUserGallery(userId: string): Promise<GalleryItem[]> {
  const admin = createSupabaseAdminClient();

  const [owned, unlocks] = await Promise.all([
    admin
      .from("generation_jobs")
      .select(GALLERY_SELECT)
      .eq("user_id", userId)
      .eq("status", "succeeded")
      .not("clean_object_path", "is", null)
      .order("created_at", { ascending: false }),
    admin.from("job_unlocks").select("job_id").eq("user_id", userId),
  ]);

  if (owned.error) throw owned.error;
  if (unlocks.error) throw unlocks.error;

  const items = new Map<string, GalleryItem>();
  for (const row of (owned.data ?? []) as JobIdRow[]) {
    items.set(row.id, toItem(row));
  }

  const unlockedJobIds = (unlocks.data ?? [])
    .map((row) => row.job_id as string)
    .filter((id) => !items.has(id));

  if (unlockedJobIds.length > 0) {
    const { data, error } = await admin
      .from("generation_jobs")
      .select(GALLERY_SELECT)
      .in("id", unlockedJobIds)
      .eq("status", "succeeded")
      .not("clean_object_path", "is", null);

    if (error) throw error;
    for (const row of (data ?? []) as JobIdRow[]) {
      items.set(row.id, toItem(row));
    }
  }

  return [...items.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function normalizeResultCount(count: number | null | undefined) {
  return Number.isInteger(count) && Number(count) > 0 ? Number(count) : 1;
}
