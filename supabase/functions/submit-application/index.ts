import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
"Access-Control-Allow-Origin": "https://security-website-fawn.vercel.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("APP_SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    return jsonResponse({ error: "Server configuration error." }, 500);
  }

  const contentLength = Number(req.headers.get("content-length") || "0");

  if (contentLength > 6 * 1024 * 1024) {
    return jsonResponse({ error: "Request too large." }, 413);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let uploadedPath: string | null = null;

  try {
    const formData = await req.formData();

    const applicationValue = formData.get("application");
    const biodataValue = formData.get("biodata");
    const welfareValue = formData.get("welfare");
    const passportPhoto = formData.get("passport_photo");

    if (
      typeof applicationValue !== "string" ||
      typeof biodataValue !== "string" ||
      typeof welfareValue !== "string" ||
      !(passportPhoto instanceof File)
    ) {
      return jsonResponse(
        { error: "Incomplete application or passport photo." },
        400,
      );
    }

    let application: any;
    let biodata: any;
    let welfare: any;

    try {
      application = JSON.parse(applicationValue);
      biodata = JSON.parse(biodataValue);
      welfare = JSON.parse(welfareValue);
    } catch {
      return jsonResponse({ error: "Invalid application data." }, 400);
    }

    if (
      !application ||
      typeof application !== "object" ||
      Array.isArray(application) ||
      !biodata ||
      typeof biodata !== "object" ||
      Array.isArray(biodata) ||
      !welfare ||
      typeof welfare !== "object" ||
      Array.isArray(welfare)
    ) {
      return jsonResponse({ error: "Invalid application data." }, 400);
    }

    if (
      !application.full_name ||
      !application.phone ||
      !application.unit_id ||
      application.declaration !== true ||
      biodata.consent_to_verification !== true ||
      biodata.information_accuracy_confirmed !== true
    ) {
      return jsonResponse(
        { error: "Please complete the required fields and declarations." },
        400,
      );
    }

    if (
      passportPhoto.size <= 0 ||
      passportPhoto.size > MAX_FILE_SIZE ||
      !allowedTypes[passportPhoto.type]
    ) {
      return jsonResponse(
        {
          error: "Passport photo must be JPEG, PNG, or WebP and not exceed 5 MB.",
        },
        400,
      );
    }

    const extension = allowedTypes[passportPhoto.type];
    const filePath = `${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("operative-passports")
      .upload(filePath, passportPhoto, {
        contentType: passportPhoto.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Passport upload failed:", uploadError.message);

      return jsonResponse(
        { error: "Passport photo upload failed. Please try again." },
        500,
      );
    }

    uploadedPath = filePath;
    biodata.passport_photo_path = uploadedPath;

    const { data, error } = await supabase.rpc(
      "submit_operative_application",
      {
        p_application: application,
        p_biodata: biodata,
        p_welfare: welfare,
      },
    );

    if (error) {
      console.error("Application submission failed:", error.code);

      await supabase.storage
        .from("operative-passports")
        .remove([uploadedPath]);

      uploadedPath = null;

      if (error.code === "23505") {
        return jsonResponse(
          { error: "An application with these details already exists." },
          409,
        );
      }

      return jsonResponse(
        { error: "We could not submit your application. Please try again." },
        400,
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Application received and awaiting review.",
        application_id: data,
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected submission error:", error);

    if (uploadedPath) {
      await supabase.storage
        .from("operative-passports")
        .remove([uploadedPath]);
    }

    return jsonResponse(
      { error: "An unexpected error occurred. Please try again." },
      500,
    );
  }
});