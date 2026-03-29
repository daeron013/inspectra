import { createRemoteJWKSet, jwtVerify } from "jose";

function normalizeIssuer(issuer) {
  if (!issuer) return null;
  return issuer.endsWith("/") ? issuer : `${issuer}/`;
}

function getIssuer() {
  const explicitIssuer = normalizeIssuer(process.env.AUTH0_ISSUER_BASE_URL);
  if (explicitIssuer) return explicitIssuer;

  const domain = process.env.VITE_AUTH0_DOMAIN || process.env.AUTH0_DOMAIN;
  if (!domain) return null;
  return normalizeIssuer(`https://${domain}`);
}

function getAudience() {
  return process.env.AUTH0_AUDIENCE || process.env.VITE_AUTH0_AUDIENCE || null;
}

/** SPA client id — ID tokens use this as `aud`. */
function getAuth0ClientId() {
  return process.env.AUTH0_CLIENT_ID || process.env.VITE_AUTH0_CLIENT_ID || null;
}

async function verifyBearerJwt(token) {
  const issuer = getIssuer();
  const audience = getAudience();
  const clientId = getAuth0ClientId();
  const jwks = getJwks();

  const strategies = [];
  if (audience) strategies.push({ issuer, audience });
  if (clientId) strategies.push({ issuer, audience: clientId });
  if (!audience) strategies.push({ issuer });

  let lastError = new Error("JWT verification failed");
  for (const opts of strategies) {
    try {
      return await jwtVerify(token, jwks, opts);
    } catch (err) {
      lastError = err instanceof Error ? err : lastError;
    }
  }
  throw lastError;
}

function requireOrganization() {
  const v = process.env.AUTH0_REQUIRE_ORGANIZATION;
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}

function getJwks() {
  const issuer = getIssuer();
  if (!issuer) {
    throw new Error("Auth0 issuer is not configured");
  }
  return createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));
}

function extractBearerToken(req) {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function isCompactJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

export function getRequestUser(req) {
  const payload = req.auth?.payload;
  if (!payload) return null;

  return {
    id: payload.sub,
    scopeId: payload.org_id || payload.sub,
    email: payload.email,
    name: payload.name,
    organizationId: payload.org_id || null,
    organizationName: payload.org_name || null,
  };
}

export async function requireAuth(req, res, next) {
  try {
    const issuer = getIssuer();
    const audience = getAudience();

    if (!issuer) {
      res.status(500).json({
        error:
          "Auth0 issuer is not configured. Set AUTH0_ISSUER_BASE_URL or AUTH0_DOMAIN (or VITE_AUTH0_DOMAIN) on the server.",
      });
      return;
    }

    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    if (!isCompactJwt(token)) {
      res.status(401).json({
        error:
          "Invalid bearer token. Expected a JWT. Ensure the app sends an access token for your Auth0 API or an ID token — see VITE_AUTH0_AUDIENCE and AUTH0_CLIENT_ID on server.",
      });
      return;
    }

    if (!audience) {
      console.warn(
        "[auth] AUTH0_AUDIENCE / VITE_AUTH0_AUDIENCE not set — accepting API JWT, ID token (aud=client id), or issuer-only verification. Prefer setting an API audience in production.",
      );
    }

    const { payload } = await verifyBearerJwt(token);

    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const orgId = typeof payload.org_id === "string" ? payload.org_id : null;

    req.auth = {
      token,
      payload,
      userId: sub,
      scopeId: orgId || sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      organizationId: orgId,
      organizationName: typeof payload.org_name === "string" ? payload.org_name : null,
    };

    if (!req.auth.userId) {
      res.status(401).json({ error: "Authenticated token is missing subject" });
      return;
    }

    if (requireOrganization() && !req.auth.organizationId) {
      res.status(403).json({
        error:
          "Organization login required. Sign in through an Auth0 Organization, or for local dev set AUTH0_REQUIRE_ORGANIZATION=false (records then scope to your user id).",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("auth failed", error);
    res.status(401).json({
      error: error instanceof Error ? error.message : "Authentication failed",
    });
  }
}
