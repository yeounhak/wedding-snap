export type ShareOutcome = { method: "share" | "copy"; url: string };

/**
 * Enable public sharing for a job and hand the link to the OS share sheet
 * (falling back to clipboard copy). Returns `null` if the user dismisses the
 * native share sheet. Throws if the share could not be enabled.
 */
export async function shareResultPhoto(
  jobId: string,
): Promise<ShareOutcome | null> {
  const response = await fetch(`/api/generate/${jobId}/share`, {
    method: "POST",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "공유 링크를 만들지 못했어요");
  }

  const { shareUrl } = (await response.json()) as { shareUrl: string };
  const absoluteUrl = new URL(shareUrl, window.location.origin).toString();

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "Wedding Snap",
        text: "AI로 만든 우리 웨딩 사진 묶음",
        url: absoluteUrl,
      });
      return { method: "share", url: absoluteUrl };
    } catch (error) {
      // User dismissed the share sheet — not an error worth surfacing.
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      // Any other share failure falls through to clipboard copy.
    }
  }

  await navigator.clipboard.writeText(absoluteUrl);
  return { method: "copy", url: absoluteUrl };
}
