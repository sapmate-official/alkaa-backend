import assert from 'node:assert';
import { SECRET_USER_FIELDS, stripSecrets, sanitizeUser } from './src/util/sanitize.js';

console.log('Running sanitize regression tests...');

// Test 1: stripSecrets removes all sensitive fields
const dirtyUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    hashedPassword: '$2b$10$supersecretpasswordhash',
    refreshToken: 'ey.refresh.token.here',
    verificationToken: 'token123',
    verificationTokenExpiry: new Date(),
    status: 'active'
};

const stripped = stripSecrets(dirtyUser);
for (const secret of SECRET_USER_FIELDS) {
    assert.strictEqual(stripped[secret], undefined, `Expected ${secret} to be removed`);
}
assert.strictEqual(stripped.id, 'user-123');
assert.strictEqual(stripped.firstName, 'John');
assert.strictEqual(stripped.status, 'active');

// Test 2: sanitizeUser strips secrets and maps emails + nested manager
const userWithManager = {
    id: 'user-456',
    email: 'corp@example.com',
    personalEmail: 'personal@example.com',
    businessEmail: 'corp@example.com',
    hashedPassword: '$2b$10$hash',
    manager: {
        id: 'mgr-789',
        email: 'mgr@example.com',
        refreshToken: 'mgr-refresh-token'
    }
};

const sanitized = sanitizeUser(userWithManager);
assert.strictEqual(sanitized.hashedPassword, undefined);
assert.strictEqual(sanitized.personalEmail, 'personal@example.com');
assert.strictEqual(sanitized.businessEmail, 'corp@example.com');
assert.strictEqual(sanitized.manager.refreshToken, undefined);
assert.strictEqual(sanitized.manager.personalEmail, 'mgr@example.com');
assert.strictEqual(sanitized.manager.businessEmail, null);

// Test 3: Null and non-object safety
assert.strictEqual(stripSecrets(null), null);
assert.strictEqual(stripSecrets(undefined), undefined);
assert.strictEqual(sanitizeUser(null), null);
assert.strictEqual(sanitizeUser(undefined), undefined);

console.log('✓ All sanitize regression tests passed successfully!');
