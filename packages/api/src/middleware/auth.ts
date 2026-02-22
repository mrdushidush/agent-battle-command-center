import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

/**
 * API Key Authentication Middleware
 *
 * Validates API key from X-API-Key header or api_key query parameter.
 * Rejects requests without valid API key unless endpoint is public.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = config.auth.apiKey;

  // Reject all requests if no API key is configured (security hardening)
  if (!expectedKey) {
    console.error('SECURITY: API_KEY not configured — rejecting request. Set API_KEY env var.');
    res.status(500).json({
      error: 'Server misconfiguration',
      message: 'API authentication is not configured. Contact administrator.',
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Provide via X-API-Key header.',
    });
    return;
  }

  if (apiKey !== expectedKey) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * Optional API Key middleware (allows unauthenticated access)
 * Use for endpoints that support both authenticated and public access
 */
export function optionalApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = config.auth.apiKey;

  if (expectedKey && apiKey && apiKey === expectedKey) {
    // Valid API key provided
    (req as any).authenticated = true;
  } else {
    // No key or invalid key - still allow, but mark as unauthenticated
    (req as any).authenticated = false;
  }

  next();
}
