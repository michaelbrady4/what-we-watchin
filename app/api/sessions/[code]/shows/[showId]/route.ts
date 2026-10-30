import { deviceToken, fail, json } from "@/lib/http";
import { removeShow } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ code: string; showId: string }> }) {
  try {
    const { code, showId } = await ctx.params;
    const result = await removeShow(code.toLowerCase(), showId, deviceToken(req));
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      return json({ error: result.error, message: result.message }, status);
    }
    return json({ view: result.view });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
