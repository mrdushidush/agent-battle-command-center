import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

// This package is ESM ("type": "module" + extensionsToTreatAsEsm). `jest.mock`
// is not hoisted for ES modules and silently does nothing - which is why these
// tests were dead weight even once collected: `config.auth.apiKey` stayed
// undefined and every request took the "not configured" 500 branch.
// `unstable_mockModule` + a dynamic import is the ESM equivalent, and the
// import must happen after the mock is registered.
jest.unstable_mockModule('../config.js', () => ({
  config: {
    auth: {
      apiKey: 'test-api-key-12345',
    },
  },
}));

const { requireApiKey, optionalApiKey } = await import('./auth.js');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      query: {},
      path: '/api/tasks',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Partial<Response>;
    nextFunction = jest.fn();
  });

  describe('requireApiKey', () => {
    it('should allow health check without API key', () => {
      mockRequest = { headers: {}, query: {}, path: '/health' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject requests without API key', () => {
      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: expect.stringContaining('API key required'),
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid API key', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-key' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow requests with valid API key in header', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-12345' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should not accept an API key from the query param', () => {
      // Query-param auth was removed deliberately: keys in a URL leak into
      // access logs, Referer headers and browser history. Only X-API-Key is
      // honoured, so a request carrying the correct key here is still 401.
      mockRequest.query = { api_key: 'test-api-key-12345' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should authenticate from the header and ignore the query param', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-12345' };
      mockRequest.query = { api_key: 'wrong-key' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalApiKey', () => {
    it('should mark request as authenticated with valid key', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-12345' };

      optionalApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).authenticated).toBe(true);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should mark request as unauthenticated without key', () => {
      optionalApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).authenticated).toBe(false);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should mark request as unauthenticated with invalid key', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-key' };

      optionalApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).authenticated).toBe(false);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
