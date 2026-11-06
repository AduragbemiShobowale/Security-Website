// Sends an approved operative their QR code by email (via Resend).
//
// Only signed-in admins (rows in public.admin_users) may call this.
// The QR image is generated here and attached to the email, so the
// operative's qr_token is never sent to a third-party QR service.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import QRCode from "npm:qrcode@1.5.4";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
      return respond({ error: "Email function secrets are not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // --- Caller must be a signed-in admin ---------------------------------
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = jwt
      ? await supabase.auth.getUser(jwt)
      : { data: { user: null }, error: null };

    if (userError || !userData?.user) {
      return respond({ error: "Sign in as an administrator." }, 401);
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (!admin) {
      return respond({ error: "Administrator access required." }, 403);
    }

    // --- Load the operative ----------------------------------------------
    const { operative_id } = await req.json().catch(() => ({}));

    if (!operative_id) {
      return respond({ error: "Operative ID is required." }, 400);
    }

    const { data: operative, error } = await supabase
      .from("operatives")
      .select("id, full_name, email, qr_token, status, units(name)")
      .eq("id", operative_id)
      .single();

    if (error || !operative) {
      return respond({ error: "Operative not found." }, 404);
    }
    if (operative.status !== "approved") {
      return respond({ error: "This operative has not been approved." }, 400);
    }
    if (!operative.email) {
      return respond({ error: "This operative has no email address." }, 400);
    }
    if (!operative.qr_token) {
      return respond({ error: "This operative has no QR token." }, 400);
    }

    const unitName = Array.isArray(operative.units)
      ? operative.units[0]?.name || "Not specified"
      : (operative.units as { name?: string } | null)?.name || "Not specified";

    // --- Build the QR image locally ----------------------------------------
    const qrPng: Uint8Array = await QRCode.toBuffer(String(operative.qr_token), {
      type: "png",
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
    });
    const qrBase64 = encodeBase64(qrPng);

    const name = escapeHtml(operative.full_name);
    const unit = escapeHtml(unitName);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [operative.email],
        subject: "Flaming Security — Registration Approved",
        attachments: [
          {
            filename: "Flaming-Security-QR.png",
            content: qrBase64,
            content_id: "operative-qr",
          },
        ],
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222;line-height:1.6">
            <div style="background:#24103b;color:white;padding:24px;text-align:center">
              <h1 style="margin:0">FLAMING SECURITY</h1>
              <p style="margin-bottom:0">Registration Approval</p>
            </div>
            <div style="padding:24px">
              <h2>Congratulations, ${name}!</h2>
              <p>Your registration with Flaming Security has been approved.</p>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Sub-unit:</strong> ${unit}</p>
              <h3>Your Operative QR Code</h3>
              <p>Keep this QR code safe and do not share it. It identifies you
              and records your attendance at designated programmes.</p>
              <div style="text-align:center;padding:16px">
                <img src="cid:operative-qr" alt="Your operative QR code"
                  width="250" height="250" style="max-width:100%;height:auto">
                <p>The QR code is also attached to this email as
                <strong>Flaming-Security-QR.png</strong>.</p>
              </div>
              <p>Present your QR code when requested by authorised
              Flaming Security personnel.</p>
              <p>Welcome to the team!</p>
              <p><strong>Flaming Security Administration</strong></p>
            </div>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json().catch(() => ({}));

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      return respond({ error: "The email provider could not send the email." }, 502);
    }

    return respond({ message: "Approval email sent successfully.", email_id: emailResult.id });
  } catch (error) {
    console.error("Function error:", error);
    return respond({ error: "An unexpected error occurred." }, 500);
  }
});

function escapeHtml(value: string): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] as string);
}
