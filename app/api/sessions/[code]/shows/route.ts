import { deviceToken, fail, field, json, readBody } from "@/lib/http";
import { addShow } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await readBody(req);
    const result = await addShow(code.toLowerCase(), {
      title: field(body, "title"),
      name: field(body, "name"),
      deviceToken: deviceToken(req),
    });
    if (!result.ok) return json({ error: result.error, message: result.message }, result.error === "not_found" ? 404 : 400);
    return json({ view: result.view });
  } catch (error) {
    console.error(error);
    return fail("server", 500);
  }
}
