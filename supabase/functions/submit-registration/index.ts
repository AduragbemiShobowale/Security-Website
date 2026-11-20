import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://security-website-fawn.vercel.app",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }

  const origin = req.headers.get("origin") || "";

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("APP_SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    return jsonResponse(
      req,
      { error: "Server configuration error." },
      500,
    );
  }

  const contentLength = Number(
    req.headers.get("content-length") || "0",
  );

  if (contentLength > 100 * 1024) {
    return jsonResponse(req, { error: "Request too large." }, 413);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const body = await req.json();
    const application = body?.application;

    if (
      !application ||
      typeof application !== "object" ||
      Array.isArray(application)
    ) {
      return jsonResponse(
        req,
        { error: "Invalid registration data." },
        400,
      );
    }

    if (
      !application.full_name ||
      !application.phone ||
      !application.unit_id ||
      application.declaration !== true ||
      application.registration_consent !== true
    ) {
      return jsonResponse(
        req,
        { error: "Please complete the required registration fields." },
        400,
      );
    }

    const { data, error } = await supabase.rpc(
      "submit_operative_registration",
      {
        p_application: application,
      },
    );

    if (error) {
      console.error(
        "Registration submission failed:",
        error.code,
      );

      if (error.code === "23505") {
        return jsonResponse(
          req,
          { error: "An application with these details already exists." },
          409,
        );
      }

      return jsonResponse(
        req,
        {
          error: "We could not submit your registration. Please try again.",
        },
        400,
      );
    }

    return jsonResponse(
      req,
      {
        success: true,
        message: "Registration received and awaiting review.",
        application_id: data,
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected registration error:", error);

    return jsonResponse(
      req,
      { error: "An unexpected error occurred. Please try again." },
      500,
    );
  }
});