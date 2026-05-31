import type { Metadata } from "next";

import { getAdminUser } from "@/app/_lib/admin-auth";
import { describeOpenAIConfig, describePromptMatrix } from "@/app/_lib/prompts";
import { loadPromptTemplates } from "@/app/_lib/prompt-templates";

import PromptMatrix from "./_components/PromptMatrix";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "프롬프트 · Admin",
};

export default async function AdminPromptsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <AccessDenied />;
  }

  const store = await loadPromptTemplates();
  const matrix = describePromptMatrix(store);
  const openai = describeOpenAIConfig();

  return <PromptMatrix matrix={matrix} openai={openai} adminEmail={admin.email ?? ""} />;
}

function AccessDenied() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-base font-semibold text-neutral-900">접근 권한이 없습니다</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">
        이 페이지는 관리자 전용입니다. 관리자 계정으로 로그인했는지 확인해 주세요.
      </p>
      <a
        href="/gallery"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
      >
        앱으로 돌아가기
      </a>
    </div>
  );
}
