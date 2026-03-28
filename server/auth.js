import { createRemoteJWKSet, jwtVerify } from "jose";

function normalizeIssuer(value) {
  if (!value) return null;
  const issuer = value.startsWith("http") ? value : `https://${value}`;
  return issuer.endsWith("/") ? issuer : `${issuer}/`;
}

function getIssuer() {
  return normalizeIssuer(process.env.AUTH0_ISSUER_BASE_URL || process.env.VITE_AUTH0_DOMAIN);
}

function getAudience() {
  return process.env.AUTH0_AUDIENCE || process.env.VITE_AUTH0_AUDIENCE || undefined;
}

let jwks;

function getJwks() {
  if (!jwks) {
    const issuer = getIssuer();
    if (!issuer) {
      throw new Error("Auth0 issuer is not configured");
    }
    jwks = createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));
  }
  return jwks;
}

function extractBearerToken(req) {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function isCompactJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

export async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const issuer = getIssuer();
    if (!issuer) {
      res.status(500).json({ error: "Auth0 issuer is not configured" });
      return;
    }

    const audience = getAudience();
    if (!isCompactJwt(token)) {
      res.status(401).json({
        error: audience
          ? "Received a non-JWT access token. Re-login and confirm Auth0 is issuing a JWT for the configured API audience."
          : "Received a non-JWT access token. Configure AUTH0_AUDIENCE/VITE_AUTH0_AUDIENCE so Auth0 issues a JWT for your API.",
      });
      return;
    }

    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
      ...(audience ? { audience } : {}),
    });

    req.auth = {
      token,
      payload,
      userId: typeof payload.sub === "string" ? payload.sub : null,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };

    if (!req.auth.userId) {
      res.status(401).json({ error: "Token does not include a subject" });
      return;
    }

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("auth failed", message);
    res.status(401).json({ error: "Invalid or expired Auth0 JWT" });
  }
}

export function getRequestUser(req) {
  if (!req.auth?.userId) {
    throw new Error("Authenticated user missing from request");
  }

  return {
    id: req.auth.userId,
    email: req.auth.email || null,
    name: req.auth.name || null,
  };
}
