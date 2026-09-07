const test = require('node:test');
const assert = require('node:assert/strict');

process.env.INSTITUTION_CREDENTIAL_SECRET = 'test-only-secret';

const {
  ALPHABET,
  generateInstitutionPassword,
  encryptPassword,
  decryptPassword
} = require('../utils/institutionPassword');

test('institution password alphabet excludes O, o and zero', () => {
  assert.doesNotMatch(ALPHABET, /[Oo0]/);
});

test('generated institution passwords have the requested shape', () => {
  for (let i = 0; i < 250; i += 1) {
    const password = generateInstitutionPassword();
    assert.equal(password.length, 10);
    assert.match(password, /^[A-NP-Za-np-z1-9]+$/);
    assert.match(password, /[A-Za-z]/);
    assert.match(password, /[1-9]/);
    assert.doesNotMatch(password, /[Oo0]/);
  }
});

test('admin credential encryption round-trips without storing plaintext', () => {
  const password = 'Abc123xyz9';
  const encrypted = encryptPassword(password);
  assert.notEqual(encrypted, password);
  assert.equal(decryptPassword(encrypted), password);
});
