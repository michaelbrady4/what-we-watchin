import { fail, json } from "@/lib/http";
import { listHistory } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const nights = await listHistory();
    return json({ nights });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
