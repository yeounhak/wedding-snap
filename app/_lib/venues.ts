import sharp from "sharp";

import { createSupabaseAdminClient } from "./supabase/admin";

// Reads the shared wedding-snap-admin venue catalog (admin_places + admin_place_labels).
// The RLS policy `admin_place_labels_read_quality` exposes only rating>=4 to anon, but we
// read via the service-role admin client (matches gallery.ts) and filter rating>=4 in-query
// so only 4-star+ venues ever reach generation. Phase 0 spike validated venue-as-image-input.

export type ResolvedVenue = {
  id: number;
  title: string;
  category: string | null;
  rentalUrl: string | null;
  imageBytes: Buffer;
  mimeType: "image/jpeg";
};

const VENUE_SELECT =
  "id, title, category_main, url, main_image_path, images, rating_count, admin_place_labels!inner(rating)";
const VENUE_IMAGE_MAX_EDGE = 1536;
const CANDIDATE_POOL = 40;

type VenueRow = {
  id: number;
  title: string | null;
  category_main: string | null;
  url: string | null;
  main_image_path: string | null;
  images: unknown;
  rating_count: number | null;
};

// admin_places.id is an integer identity column (not a uuid). Some rows (spacecloud) use
// negative ids, so accept any nonzero integer.
export function parseVenueId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isInteger(n) && n !== 0 ? n : null;
}

// admin_places.images[] holds FULL CDN URLs; main_image_path is a RELATIVE hourplace path.
function resolveVenueImageUrl(row: VenueRow): string | null {
  const imgs = Array.isArray(row.images)
    ? (row.images.filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u),
      ) as string[])
    : [];
  if (imgs.length) return imgs[0];
  if (typeof row.main_image_path === "string" && row.main_image_path) {
    if (/^https?:\/\//i.test(row.main_image_path)) return row.main_image_path;
    return `https://img.hourplace.co.kr/${row.main_image_path.replace(/^\/+/, "")}?s=2000x2000&t=inside&q=80&e=webp`;
  }
  return null;
}

// Fetch + normalize to a clean JPEG bounded for OpenAI input. Returns null on any failure
// (dead/expired CDN URL) so callers can fall through to another candidate.
async function fetchVenueImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.byteLength === 0) return null;
    return await sharp(raw)
      .rotate()
      .resize({
        width: VENUE_IMAGE_MAX_EDGE,
        height: VENUE_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return null;
  }
}

async function resolveFromRow(row: VenueRow): Promise<ResolvedVenue | null> {
  if (!row.title) return null;
  const url = resolveVenueImageUrl(row);
  if (!url) return null;
  const imageBytes = await fetchVenueImage(url);
  if (!imageBytes) return null;
  return {
    id: row.id,
    title: row.title,
    category: row.category_main,
    rentalUrl: row.url,
    imageBytes,
    mimeType: "image/jpeg",
  };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Resolve a specific 4-star venue by id, with its image already fetched + normalized.
export async function getVenueById(
  venueId: string | number,
): Promise<ResolvedVenue | null> {
  const id = parseVenueId(venueId);
  if (id === null) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_places")
    .select(VENUE_SELECT)
    .gte("admin_place_labels.rating", 4)
    .eq("id", id)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return resolveFromRow(data as unknown as VenueRow);
}

// Quality-biased pool of 4-star+ venues, optionally excluding some ids.
async function queryVenuePool(
  excludeIds?: Array<string | number>,
): Promise<VenueRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("admin_places")
    .select(VENUE_SELECT)
    .gte("admin_place_labels.rating", 4)
    .is("removed_at", null)
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_POOL);

  const exclude = (excludeIds ?? [])
    .map(parseVenueId)
    .filter((id): id is number => id !== null);
  if (exclude.length) {
    query = query.not("id", "in", `(${exclude.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as VenueRow[];
}

// Auto-assign a 4-star venue WITH its image fetched + normalized, ready to feed into
// generation. Shuffles the pool and returns the first candidate whose image actually
// downloads — so a dead CDN URL never breaks generation.
export async function pickVenue(
  opts: { excludeIds?: Array<string | number> } = {},
): Promise<ResolvedVenue | null> {
  for (const row of shuffle(await queryVenuePool(opts.excludeIds))) {
    const resolved = await resolveFromRow(row);
    if (resolved) return resolved;
  }
  return null;
}

// Lightweight venue metadata + display image URL for the /generate UI — NO byte download.
// At generation time route.ts re-resolves the chosen id via getVenueById (which fetches
// + normalizes the bytes), so the previewed venue and the generated backdrop match.
export type VenuePreview = {
  id: number;
  title: string;
  category: string | null;
  rentalUrl: string | null;
  imageUrl: string;
};

export async function pickVenuePreview(
  opts: { excludeIds?: Array<string | number> } = {},
): Promise<VenuePreview | null> {
  for (const row of shuffle(await queryVenuePool(opts.excludeIds))) {
    if (!row.title) continue;
    const imageUrl = resolveVenueImageUrl(row);
    if (!imageUrl) continue;
    return {
      id: row.id,
      title: row.title,
      category: row.category_main,
      rentalUrl: row.url,
      imageUrl,
    };
  }
  return null;
}
