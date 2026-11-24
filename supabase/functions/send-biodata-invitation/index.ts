import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(value: string): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] as string);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");

    if (!supabaseUrl || !serviceRoleKey) {
      return respond({ error: "Server configuration is incomplete." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify administrator
    const jwt = (req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "");

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

    // Read operative ID
    const body = await req.json().catch(() => ({}));
    const operativeId = body.operative_id;

    if (
      typeof operativeId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operativeId)
    ) {
      return respond({ error: "A valid operative ID is required." }, 400);
    }

    // Confirm applicant is approved
    const { data: operative, error: operativeError } = await supabase
      .from("operatives")
      .select("id, full_name, email, status")
      .eq("id", operativeId)
      .maybeSingle();

    if (operativeError || !operative) {
      return respond({ error: "Operative not found." }, 404);
    }

    if (operative.status !== "approved") {
      return respond({
        error: "Biodata invitations can only be sent to approved applicants.",
      }, 400);
    }

    if (!operative.email) {
      return respond({
        error: "This applicant does not have a registered email address.",
      }, 400);
    }

    // Revoke any previous unused invitation
    const { error: revokeError } = await supabase
      .from("biodata_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("operative_id", operative.id)
      .is("used_at", null)
      .is("revoked_at", null);

    if (revokeError) {
      console.error("Invitation revocation error:", revokeError);
      return respond({ error: "Could not prepare a new invitation." }, 500);
    }

    // Generate secure invitation
    const token = generateToken();
    const tokenHash = await hashToken(token);

    const expiresAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    ).toISOString();

    const { data: invitation, error: insertError } = await supabase
      .from("biodata_invitations")
      .insert({
        operative_id: operative.id,
        email: operative.email,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertError || !invitation) {
      console.error("Invitation creation error:", insertError);
      return respond({ error: "Could not create the invitation." }, 500);
    }

    const baseUrl = (
      Deno.env.get("APP_BASE_URL") ||
      "https://security-website-fawn.vercel.app"
    ).replace(/\/+$/, "");

    const invitationUrl =
      `${baseUrl}/biodata.html?token=${encodeURIComponent(token)}`;

    // Development mode: no email is sent until email settings are ready.
    if (!resendApiKey || !emailFrom) {
      return respond({
        message: "Invitation created. Email is not configured yet.",
        preview: true,
        invitation_url: invitationUrl,
        expires_at: expiresAt,
      });
    }

    // Send invitation through Resend
    const name = escapeHtml(operative.full_name);

    const emailResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [operative.email],
          subject: "Flaming Security — Complete Your Biodata",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222;line-height:1.7">
              <div style="background:#24103b;color:white;padding:24px;text-align:center">
                <h1 style="margin:0">FLAMING SECURITY</h1>
                <p style="margin-bottom:0">Biodata Completion</p>
              </div>

              <div style="padding:24px">
                <h2>Hello ${name},</h2>

                <p>Your registration with Flaming Security has been approved.</p>

                <p>Please complete your biodata using the secure link below.</p>

                <div style="text-align:center;margin:30px 0">
                  <a href="${invitationUrl}"
                    style="background:#6d35a5;color:white;padding:14px 25px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
                    Complete My Biodata
                  </a>
                </div>

                <p><strong>Important:</strong></p>
                <ul>
                  <li>This invitation expires in 48 hours.</li>
                  <li>The link can only be used once.</li>
                  <li>Do not share this link with anyone.</li>
                </ul>

                <p>If you did not expect this email, please contact Flaming Security Administration.</p>

                <p>Regards,<br><strong>Flaming Security Administration</strong></p>
              </div>
            </div>
          `,
        }),
      }
    );

    const emailResult = await emailResponse.json().catch(() => ({}));

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);

      await supabase
        .from("biodata_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return respond({
        error: "Invitation was created, but the email could not be sent.",
      }, 502);
    }

    // Record successful email delivery request
    const { error: updateError } = await supabase
      .from("biodata_invitations")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Invitation update error:", updateError);
    }

    return respond({
      message: "Biodata invitation email sent successfully.",
      expires_at: expiresAt,
      email_id: emailResult.id,
    });

  } catch (error) {
    console.error("Function error:", error);

    return respond({
      error: "An unexpected error occurred.",
    }, 500);
  }
});
