import { deviceToken, fail, field, json, readBody } from "@/lib/http";
import { joinSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await readBody(req);
    const result = await joinSession(code.toLowerCase(), field(body, "name"), deviceToken(req));
    if (!result.ok) return json({ error: result.error, message: result.message }, result.error === "not_found" ? 404 : 400);
    return json({ view: result.view });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
