import { fail, field, json, readBody } from "@/lib/http";
import { cleanNightName } from "@/lib/text";
import { createSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const parsed = cleanNightName(field(body, "name"));
    if (!parsed.ok) return fail("bad_night_name");
    const { code } = await createSession(parsed.name);
    return json({ code });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
