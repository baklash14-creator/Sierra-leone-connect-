// Supabase Edge Function: admin-email
// Lets an admin email members through Brevo. The Brevo key stays on the server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL");
    const senderName = Deno.env.get("SENDER_NAME") ?? "SL Connect";
    const maxRecipients = Number(Deno.env.get("MAX_RECIPIENTS") ?? "300");
    if (!brevoKey || !senderEmail) {
      return json({ error: "Server is missing BREVO_API_KEY or SENDER_EMAIL secret." }, 500);
    }

    // Who is calling? Must be a signed-in admin.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const admin = createClient(url, serviceKey);
    const { data: who, error: whoErr } = await admin.auth.getUser(token);
    if (whoErr || !who.user) return json({ error: "Please sign in again." }, 401);
    const { data: isAdmin } = await admin.from("admins").select("user_id").eq("user_id", who.user.id).maybeSingle();
    if (!isAdmin) return json({ error: "Admins only." }, 403);

    const { audience, userId, subject, message, testOnly } = await req.json();
    if (!subject || !message) return json({ error: "Subject and message are required." }, 400);
    if (String(subject).length > 150 || String(message).length > 5000) return json({ error: "Message is too long." }, 400);

    // Work out the recipients
    let emails: string[] = [];
    if (testOnly) {
      emails = [who.user.email as string];
    } else if (audience === "one") {
      const { data, error } = await admin.auth.admin.getUserById(String(userId));
      if (error || !data.user?.email) return json({ error: "Member email not found." }, 404);
      emails = [data.user.email];
    } else {
      let posters: Set<string> | null = null;
      if (audience === "posters") {
        const { data } = await admin.from("posts").select("owner").limit(10000);
        posters = new Set((data ?? []).map((r: { owner: string }) => r.owner));
      }
      let page = 1;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) return json({ error: error.message }, 500);
        for (const u of data.users) {
          if (!u.email || !u.email_confirmed_at) continue;
          if (u.banned_until && new Date(u.banned_until) > new Date()) continue;
          if (posters && !posters.has(u.id)) continue;
          emails.push(u.email);
        }
        if (data.users.length < 1000) break;
        page++;
      }
    }
    emails = [...new Set(emails)];
    if (emails.length === 0) return json({ error: "No members to email." }, 400);
    if (emails.length > maxRecipients) {
      return json({ error: `That is ${emails.length} people, more than your limit of ${maxRecipients} per send. Choose a smaller group.` }, 400);
    }

    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden">
<div style="height:8px;background:linear-gradient(to right,#1EB53A 33%,#ffffff 33% 66%,#0072C6 66%)"></div>
<div style="padding:24px"><h2 style="color:#0072C6;margin-top:0">${esc(String(subject))}</h2>
<div style="color:#333;line-height:1.5">${esc(String(message)).replace(/\n/g, "<br>")}</div>
<p style="font-size:12px;color:#666;margin-top:24px">You received this because you have an SL Connect account.</p></div></div>`;

    let sent = 0, failed = 0;
    for (let i = 0; i < emails.length; i += 10) {
      const chunk = emails.slice(i, i + 10);
      const results = await Promise.all(chunk.map(async (to) => {
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject: String(subject),
            htmlContent: html,
          }),
        });
        return r.ok;
      }));
      for (const ok of results) ok ? sent++ : failed++;
    }
    return json({ sent, failed, total: emails.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
