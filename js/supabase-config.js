const SUPABASE_URL = "https://zhxkwivfvxqrnlfvxcum.supabase.co";

const SUPABASE_KEY = "sb_publishable_RyxqpWZa4ZjTVbSt5pY8vQ_myKplV7A";

// Only pages that load the supabase-js library get a client; pages that just
// call Edge Functions with fetch() (registration, biodata) only need the URL and key.
const supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;
