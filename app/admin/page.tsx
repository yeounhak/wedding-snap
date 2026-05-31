import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /admin has no content of its own yet — send it to the prompts viewer.
export default function AdminIndexPage() {
  redirect("/admin/prompts");
}
