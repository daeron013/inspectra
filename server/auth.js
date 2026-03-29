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

    if (!issuer || !audience) {
      res.status(500).json({
        error: "Auth0 API audience is not configured on the server",
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
        error: "Invalid bearer token format. Configure Auth0 API audience so the app requests a JWT access token.",
      });
      return;
    }

    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
      audience,
    });

    req.auth = {
      token,
      payload,
      userId: typeof payload.sub === "string" ? payload.sub : null,
      scopeId: typeof payload.org_id === "string" ? payload.org_id : (typeof payload.sub === "string" ? payload.sub : null),
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      organizationId: typeof payload.org_id === "string" ? payload.org_id : null,
      organizationName: typeof payload.org_name === "string" ? payload.org_name : null,
    };

    if (!req.auth.userId) {
      res.status(401).json({ error: "Authenticated token is missing subject" });
      return;
    }

    if (!req.auth.organizationId) {
      res.status(403).json({
        error: "Organization login required. Sign in through an Auth0 Organization so records stay isolated to your company.",
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
