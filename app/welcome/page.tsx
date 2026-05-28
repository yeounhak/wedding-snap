import type { Metadata } from "next";

import AppShell from "../_components/AppShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wedding Snap",
  description: "두 사람의 사진으로 만드는 웨딩 사진",
};

export default function WelcomePage() {
  return <AppShell />;
}
