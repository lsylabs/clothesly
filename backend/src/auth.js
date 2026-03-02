import { createRemoteJWKSet, jwtVerify } from 'jose';

import { config } from './config.js';

const issuer = `${config.supabaseUrl}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

const parseBearer = (authorizationHeader) => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
};

export async function verifyAccessToken(accessToken) {
  const { payload } = await jwtVerify(accessToken, jwks, {
    issuer,
    audience: config.supabaseJwtAudience
  });

  return payload;
}

export async function requireAuth(req, res, next) {
  try {
    const token = parseBearer(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const payload = await verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      role: typeof payload.role === 'string' ? payload.role : null,
      accessToken: token,
      payload
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid access token',
      message: error instanceof Error ? error.message : 'Unknown token verification error'
    });
  }
}
