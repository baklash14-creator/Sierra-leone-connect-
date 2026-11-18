import { admin, configured, json, verify } from "../_shared/payments.ts";
// Deploy with --no-verify-jwt. Monime calls this with our shared secret header; the body is ignored and every
// pending payment is confirmed directly with Monime.
Deno.serve(async (req) => {
  if (!configured()) return json({ error: "disabled" }, 503);
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data: rows } = await admin().from("verify_payments").select("*").eq("status", "pending").not("provider_session_id", "is", null).gte("created_at", since).limit(50);
  for (const r of rows ?? []) await verify(r);
  return json({ ok: true });
});
