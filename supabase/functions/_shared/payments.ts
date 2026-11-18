// Shared helpers. Secrets live in Supabase (Edge Function secrets), NEVER in the website or GitHub.
import { createClient as sbClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createClient as monimeClient } from "npm:monime-package"; // UNOFFICIAL SDK: pin a version and review it before going live

export const PRICE = 30; // Le per 30 days
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
export const admin = () => sbClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export const configured = () =>
  !!(Deno.env.get("MONIME_SPACE_ID") && Deno.env.get("MONIME_ACCESS_TOKEN") && Deno.env.get("SITE_URL"));
export const monime = () =>
  monimeClient({ monimeSpaceId: Deno.env.get("MONIME_SPACE_ID")!, accessToken: Deno.env.get("MONIME_ACCESS_TOKEN")! });
export async function userId(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data } = await admin().auth.getUser(token);
  return data?.user?.id ?? null;
}
// CONFIRM these status words with one real test payment.
const PAID = ["completed", "paid", "succeeded", "success", "successful"];
const DEAD = ["expired", "failed", "cancelled", "canceled"];
// Never trust the browser or the webhook body: ask Monime directly.
export async function verify(row: any): Promise<string> {
  if (!row.provider_session_id) return row.status;
  const r = await monime().checkoutSession.retrieve(row.provider_session_id);
  if (!r.success) return row.status;
  const st = String(r.data?.status ?? "").toLowerCase(), sb = admin();
  if (PAID.includes(st)) {
    const li: any = r.data?.lineItems?.data?.[0];
    const paidMinor = li ? Number(li.price?.value) * Number(li.quantity ?? 1) : null;
    if (paidMinor !== null && paidMinor !== Math.round(Number(row.amount) * 100)) {
      await sb.from("verify_payments").update({ note: "Amount mismatch: review manually" }).eq("id", row.id);
      return row.status;
    }
    await sb.rpc("finalize_verify_payment", { p_id: row.id });
    return "successful";
  }
  if (DEAD.includes(st)) { await sb.from("verify_payments").update({ status: "failed" }).eq("id", row.id).eq("status", "pending"); return "failed"; }
  return "pending";
}
