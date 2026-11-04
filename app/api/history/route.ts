import { fail, json } from "@/lib/http";
import { listHistory, listLiveNights } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [nights, live] = await Promise.all([listHistory(), listLiveNights()]);
    return json({ nights, live });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
