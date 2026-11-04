import { deviceToken, fail, field, json, readBody } from "@/lib/http";
import { getSession, renameSession } from "@/lib/sessions";

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

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await readBody(req);
    const result = await renameSession(code.toLowerCase(), field(body, "name"), deviceToken(req));
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
