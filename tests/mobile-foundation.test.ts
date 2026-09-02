import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, isApiError } from '../src/services/ApiError';

test('ApiError retains safe, structured failure information', () => {
  const error = new ApiError('Request failed', {
    kind: 'http',
    status: 429,
    details: { retry_after_seconds: 30 },
  });

  assert.equal(error.name, 'ApiError');
  assert.equal(error.message, 'Request failed');
  assert.equal(error.kind, 'http');
  assert.equal(error.status, 429);
  assert.equal(error.code, 429);
  assert.deepEqual(error.details, { retry_after_seconds: 30 });
  assert.equal(isApiError(error), true);
  assert.equal(isApiError(new Error('other')), false);
});
