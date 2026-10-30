import { deviceToken, fail, json } from "@/lib/http";
import { spinSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const result = await spinSession(code.toLowerCase(), deviceToken(req));
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      return json({ error: result.error, message: result.message }, status);
    }
    return json({ view: result.view, result: result.result, showId: result.showId });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
