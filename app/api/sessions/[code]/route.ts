import { deviceToken, fail, json } from "@/lib/http";
import { getSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const view = await getSession(code.toLowerCase(), deviceToken(req));
    if (!view) return fail("not_found", 404);
    return json({ view });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
