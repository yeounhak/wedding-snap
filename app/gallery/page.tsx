import type { Metadata } from "next";

import { getCreditBalance, getCurrentUser } from "@/app/_lib/access-control";
import { listUserGallery } from "@/app/_lib/gallery";

import GalleryClient from "./_components/GalleryClient";
import GalleryLoggedOut from "./_components/GalleryLoggedOut";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "갤러리 · Wedding Snap",
};

export default async function GalleryPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <GalleryLoggedOut />;
  }

  const [items, credits] = await Promise.all([
    listUserGallery(user.id),
    getCreditBalance(user.id).catch(() => 0),
  ]);

  return (
    <GalleryClient items={items} credits={credits} userLabel={userLabel(user)} />
  );
}

function userLabel(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const candidate =
    metadata.full_name ??
    metadata.name ??
    metadata.nickname ??
    metadata.preferred_username ??
    user?.email ??
    user?.id.slice(0, 8);

  return typeof candidate === "string" ? candidate : "내 계정";
}
