const API_BASE_URL =
  window.SVIDANIE_API_BASE_URL ||
  (location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3001/api"
    : `${location.origin}/api`);
const SUPABASE_URL = "https://wzlvkhchgtbchrqkszrr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_J3YrYM_RJCbSHEMZtlM3bA_FmceL8vz";

window.API_BASE_URL = API_BASE_URL;

// Yandex.Metrica. Left empty on purpose: nothing is loaded and no visitor is
// tracked until a counter id is put here, so the site ships without a
// third-party script by default. Get the id at https://metrika.yandex.ru/ and
// paste the number (e.g. "98765432"). Webvisor records sessions, which is what
// shows where people abandon the booking form.
window.SVIDANIE_METRIKA_ID = "";

if (window.supabase) {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
