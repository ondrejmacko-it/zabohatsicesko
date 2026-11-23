// Sdílené hodnoty pro servery a testy Playwrightu. Jen pro lokální test, nikde neplatí.
export const DEMO_PORT = 3310;
export const LIVE_PORT = 3311;
// Ukázka se zapnutou individuální účastí (PARTICIPATION=on), viz e2e/ucast.spec.ts.
export const UCAST_PORT = 3313;
// HTTPS před ukázkou jen pro WebKit (E2E_WEBKIT=1), viz e2e/server.mjs.
export const DEMO_TLS_PORT = 3410;
// Falešný webhook Make.com pro zpětnou vazbu (e2e/server.mjs). Přijímá jen na 127.0.0.1.
export const FEEDBACK_HOOK_PORT = 3312;
export const FEEDBACK_HOOK_SECRET = "e2e-jen-test-feedback-secret-00000000";
export const DEMO_CODE = "e2e-pristupovy-kod";
