
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://security-website-fawn.vercel.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server configuration error." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const form = await req.formData();

    const token = form.get("token");
    const biodataValue = form.get("biodata");
    const welfareValue = form.get("welfare");
    const photo = form.get("passport_photo");

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return respond({ error: "Invalid invitation link." }, 400);
    }

    if (
      typeof biodataValue !== "string" ||
      typeof welfareValue !== "string"
    ) {
      return respond({
        error: "Biodata and welfare information are required.",
      }, 400);
    }

    let biodata: Record<string, unknown>;
    let welfare: Record<string, unknown>;

    try {
      biodata = JSON.parse(biodataValue);
      welfare = JSON.parse(welfareValue);

      if (
        !biodata ||
        typeof biodata !== "object" ||
        Array.isArray(biodata) ||
        !welfare ||
        typeof welfare !== "object" ||
        Array.isArray(welfare)
      ) {
        return respond({
          error: "Invalid biodata or welfare information.",
        }, 400);
      }
    } catch {
      return respond({
        error: "Invalid biodata or welfare information.",
      }, 400);
    }

    if (
      welfare.welfare_consent !== true &&
      welfare.welfare_consent !== "true"
    ) {
      return respond({
        error: "Welfare consent is required.",
      }, 400);
    }

    if (
      !photo ||
      typeof photo === "string" ||
      typeof photo.size !== "number"
    ) {
      return respond({
        error: "Passport photograph is required.",
      }, 400);
    }

    if (photo.size < 1 || photo.size > 5 * 1024 * 1024) {
      return respond({
        error: "Passport photograph must not exceed 5 MB.",
      }, 400);
    }

    const allowedTypes: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = allowedTypes[photo.type];

    if (!extension) {
      return respond({
        error: "Only JPEG, PNG and WebP photographs are accepted.",
      }, 400);
    }

    const tokenHash = await hashToken(token);

    // Check invitation before uploading anything.
    const { data: invitation, error: invitationError } = await supabase
      .from("biodata_invitations")
      .select("id, operative_id, expires_at, used_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (invitationError || !invitation) {
      return respond({ error: "Invalid invitation." }, 400);
    }

    if (
      invitation.used_at ||
      invitation.revoked_at ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      return respond({
        error: "This invitation has expired or already been used.",
      }, 400);
    }

    const { data: operative, error: operativeError } = await supabase
      .from("operatives")
      .select("id, status")
      .eq("id", invitation.operative_id)
      .maybeSingle();

    if (
      operativeError ||
      !operative ||
      operative.status !== "approved"
    ) {
      return respond({
        error: "This applicant is not approved.",
      }, 403);
    }

    // Store photograph in the existing private bucket.
    const photoPath =
      `${operative.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("operative-passports")
      .upload(photoPath, photo, {
        contentType: photo.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Photo upload error:", uploadError);

      return respond({
        error: "Could not upload passport photograph.",
      }, 500);
    }

    // Save biodata and welfare separately through the database function.
    const { data: operativeId, error: saveError } = await supabase.rpc(
      "complete_operative_biodata",
      {
        p_token_hash: tokenHash,
        p_biodata: biodata,
        p_welfare: welfare,
        p_passport_photo_path: photoPath,
      },
    );

    if (saveError) {
      console.error("Biodata and welfare save error:", saveError);

      // Remove uploaded photo if database submission fails.
      const { error: cleanupError } = await supabase.storage
        .from("operative-passports")
        .remove([photoPath]);

      if (cleanupError) {
        console.error("Photo cleanup error:", cleanupError);
      }

      return respond({
        error: "Your information could not be saved. Check your invitation and try again.",
      }, 400);
    }

    return respond({
      message: "Your biodata and welfare information have been submitted successfully.",
      operative_id: operativeId,
    });

  } catch (error) {
    console.error("Submission error:", error);

    return respond({
      error: "An unexpected error occurred.",
    }, 500);
  }
});
