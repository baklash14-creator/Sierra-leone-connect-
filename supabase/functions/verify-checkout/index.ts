import { admin, configured, cors, json, monime, PRICE, userId } from "../_shared/payments.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!configured()) return json({ error: "Payments are not enabled yet." }, 503);
  const uid = await userId(req);
  if (!uid) return json({ error: "Login required" }, 401);
  const sb = admin();
  const { data: v } = await sb.from("verified_users").select("expires_at").eq("user_id", uid).maybeSingle();
  if (v && v.expires_at === null) return json({ error: "You are already verified." }, 400);
  // price comes from the server, never from the browser
  const { data: p, error: pe } = await sb.from("verify_payments").insert({ user_id: uid, amount: PRICE }).select().single();
  if (pe) return json({ error: "Could not start payment" }, 500);
  const site = Deno.env.get("SITE_URL")!;
  const r = await monime().checkoutSession.create({
    name: "SL Connect verified badge (30 days)".slice(0, 60),
    amount: Math.round(PRICE * 100), // minor units: confirm with the first real payment
    quantity: 1,
    successUrl: `${site}/?paid=verify`,
    cancelUrl: `${site}/`,
    description: "Verified badge for 30 days",
  });
  if (!r.success || !r.data?.redirectUrl) {
    await sb.from("verify_payments").update({ status: "failed", note: "checkout create failed" }).eq("id", p.id);
    return json({ error: "Payment provider error" }, 502);
  }
  await sb.from("verify_payments").update({ provider_session_id: r.data.id, provider_order: r.data.orderNumber }).eq("id", p.id);
  return json({ url: r.data.redirectUrl });
});
