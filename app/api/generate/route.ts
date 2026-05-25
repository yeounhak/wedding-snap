import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_RESULTS = [
  "/samples/sample-5.jpg",
  "/samples/sample-3.jpg",
  "/samples/sample-1.jpg",
];

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const male = formData.get("male");
  const female = formData.get("female");
  if (!(male instanceof File) || !(female instanceof File)) {
    return Response.json(
      { error: "남자 사진과 여자 사진이 모두 필요합니다" },
      { status: 400 },
    );
  }

  // TODO: replace mock with real image generation call.
  //
  // Example shape for when the user wires this up:
  //   const apiKey = process.env.OPENAI_API_KEY
  //   const model = process.env.IMAGE_MODEL ?? "gpt-image-1"
  //   const body = new FormData()
  //   body.append("model", model)
  //   body.append("prompt", "A wedding portrait of the two people in the reference photos...")
  //   body.append("image[]", male)
  //   body.append("image[]", female)
  //   const r = await fetch("https://api.openai.com/v1/images/edits", {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${apiKey}` },
  //     body,
  //   })
  //   const data = await r.json()
  //   return Response.json({ url: `data:image/png;base64,${data.data[0].b64_json}` })

  await new Promise((resolve) => setTimeout(resolve, 3200));

  const url = MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)];
  return Response.json({ url, mock: true });
}
