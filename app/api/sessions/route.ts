import { fail, json } from "@/lib/http";
import { createSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { code } = await createSession();
    return json({ code });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
