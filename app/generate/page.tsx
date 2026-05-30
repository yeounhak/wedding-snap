import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCreditBalance, getCurrentUser } from "@/app/_lib/access-control";

import GenerateStudio from "./_components/GenerateStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "웨딩 사진 만들기 · Wedding Snap",
};

export default async function GeneratePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/api/auth/kakao/login?next=${encodeURIComponent("/generate")}`);
  }

  const credits = await getCreditBalance(user.id).catch(() => 0);

  return <GenerateStudio initialCredits={credits} />;
}
