import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MeCreditsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  redirect(withSearchParams("/gallery/credits", await searchParams));
}

function withSearchParams(
  pathname: string,
  searchParams: { [key: string]: string | string[] | undefined },
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
