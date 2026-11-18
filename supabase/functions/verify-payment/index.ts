import { admin, configured, cors, json, userId, verify } from "../_shared/payments.ts";
// Called by the app after the member returns from Monime.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!configured()) return json({ error: "Payments are not enabled yet." }, 503);
  const uid = await userId(req);
  if (!uid) return json({ error: "Login required" }, 401);
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data: rows } = await admin().from("verify_payments").select("*").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: false }).limit(5);
  const out = [];
  for (const r of rows ?? []) out.push({ id: r.id, status: r.status === "pending" ? await verify(r) : r.status });
  return json({ payments: out });
});
