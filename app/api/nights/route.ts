import { fail, json } from "@/lib/http";
import { summarizeNights } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const codes = (url.searchParams.get("codes") ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    const nights = await summarizeNights(codes);
    return json({ nights });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
