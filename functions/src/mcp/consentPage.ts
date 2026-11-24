/**
 * The consent page of the MCP server's sign-in (OAuth "authorize" step).
 *
 * An assistant (Claude, for instance) asks to connect; the owner lands here,
 * on the site's own domain (/mcp/oauth/authorize, rewritten to the `mcp`
 * function by firebase.json), signs in with Google as on the site, and
 * approves or refuses. The page talks to the function only through
 * /mcp/oauth/approve and /mcp/oauth/deny; the function checks the ID token
 * and that the account is the owner's (owner.ts) before it issues anything.
 *
 * The Firebase web configuration comes from /__/firebase/init.json, which
 * Firebase Hosting serves for the project the site belongs to: the page works
 * as is on production and on staging. Signed in on the site, the owner is
 * already signed in here (same origin, same API key, same stored account).
 *
 * Pure module (no firebase-functions, no MCP SDK): the site's unit tests read
 * it (src/__tests__/mcpServer.test.ts).
 */

/** The Firebase JS SDK the page loads, the major version the site uses. */
export const FIREBASE_JS_VERSION = "12.15.0";

export interface ConsentPageInput {
  /** The pending request's id: the only thing the page sends back. */
  requestId: string;
  /** The name the client registered with (untrusted: shown escaped). */
  clientName: string;
  /** Where the browser goes back once done, shown so the owner can check it. */
  redirectHost: string;
  /** What will be granted, in words (scopes.ts). */
  scopeLabels: string[];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON safe to put inside a <script> element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// The site's colors (docs/design.md): page background, surface, text, and
// the blue that carries white for the main button.
const STYLE = `
  :root { color-scheme: light dark; --bg: #fff9f3; --surface: #ffffff; --ink: #35312a; --muted: #6d6759; --line: #d6c4b8; --action: #328cdc; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111827; --surface: #1f2937; --ink: #f3f4f6; --muted: #9ca3af; --line: #273244; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--ink); font: 16px/1.5 Manrope, system-ui, sans-serif; }
  main { width: 100%; max-width: 440px; background: var(--surface); border: 1px solid var(--line); padding: 24px; }
  h1 { font: 400 1.5rem/1.25 "Playfair Display", Georgia, serif; margin: 0 0 12px; }
  ul { padding-left: 20px; }
  p.muted, #status { color: var(--muted); font-size: 0.9rem; }
  .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
  button { font: inherit; border-radius: 999px; padding: 10px 18px; border: 1px solid var(--line); background: transparent; color: var(--ink); cursor: pointer; }
  button.primary { background: var(--action); border-color: var(--action); color: #ffffff; }
  button[hidden] { display: none; }
  button:disabled { opacity: 0.5; cursor: default; }
`;

export function renderConsentPage(input: ConsentPageInput): string {
  const scopes = input.scopeLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join("");
  const config = scriptJson({ request: input.requestId, firebase: FIREBASE_JS_VERSION });
  const sdk = `https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Connecter un assistant | Petite Jérusalem</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Connecter un assistant</h1>
  <p><strong>${escapeHtml(input.clientName || "Un assistant")}</strong> demande à accéder à Petite Jérusalem pour :</p>
  <ul>${scopes}</ul>
  <p class="muted">Il sera renvoyé vers ${escapeHtml(input.redirectHost)}. Seul le compte propriétaire peut autoriser cet accès.</p>
  <p id="status">Vérification de la connexion…</p>
  <div class="actions">
    <button id="allow" class="primary" disabled>Autoriser</button>
    <button id="signin" hidden>Se connecter avec Google</button>
    <button id="deny">Refuser</button>
  </div>
</main>
<script type="application/json" id="pj-mcp">${config}</script>
<script type="module">
  import { initializeApp } from "${sdk}/firebase-app.js";
  import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "${sdk}/firebase-auth.js";

  const { request } = JSON.parse(document.getElementById("pj-mcp").textContent);
  const status = document.getElementById("status");
  const allow = document.getElementById("allow");
  const signin = document.getElementById("signin");
  const deny = document.getElementById("deny");

  async function post(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error_description || "La demande a échoué.");
    return json;
  }

  function busy(on) {
    for (const button of [allow, signin, deny]) button.disabled = on;
  }

  deny.addEventListener("click", async () => {
    busy(true);
    try {
      const { redirect } = await post("/mcp/oauth/deny", { request });
      location.assign(redirect);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  try {
    const config = await (await fetch("/__/firebase/init.json")).json();
    const auth = getAuth(initializeApp({ ...config, authDomain: location.hostname }));
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    onAuthStateChanged(auth, (user) => {
      allow.disabled = !user;
      signin.hidden = false;
      signin.textContent = user ? "Changer de compte" : "Se connecter avec Google";
      status.textContent = user
        ? "Connecté avec " + (user.email || "un compte sans adresse") + "."
        : "Connectez-vous avec le compte propriétaire pour autoriser.";
    });

    signin.addEventListener("click", async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch {
        status.textContent = "La connexion n'a pas abouti.";
      }
    });

    allow.addEventListener("click", async () => {
      busy(true);
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const { redirect } = await post("/mcp/oauth/approve", { request, idToken });
        status.textContent = "Accès accordé, retour à l'assistant…";
        location.assign(redirect);
      } catch (error) {
        status.textContent = error.message;
        busy(false);
      }
    });
  } catch {
    status.textContent = "Impossible de charger la connexion. Ouvrez cette page depuis le site.";
  }
</script>
</body>
</html>`;
}

/** A dead end the owner may meet (expired or already used request). */
export function renderMessagePage(title: string, message: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | Petite Jérusalem</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</main>
</body>
</html>`;
}
