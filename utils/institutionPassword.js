const crypto = require('crypto');

// O/o and zero are deliberately omitted as requested. Passwords always contain
// at least one English letter and one number.
const LETTERS = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz';
const DIGITS = '123456789';
const ALPHABET = LETTERS + DIGITS;

function randomCharacter(characters) {
  return characters[crypto.randomInt(0, characters.length)];
}

function generateInstitutionPassword(length = 10) {
  if (!Number.isInteger(length) || length < 2) {
    throw new TypeError('Password length must be an integer of at least 2');
  }

  const characters = [randomCharacter(LETTERS), randomCharacter(DIGITS)];
  while (characters.length < length) characters.push(randomCharacter(ALPHABET));

  // Fisher-Yates with crypto.randomInt keeps the forced character positions random.
  for (let i = characters.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
}

function getEncryptionKey() {
  const secret = process.env.INSTITUTION_CREDENTIAL_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('INSTITUTION_CREDENTIAL_SECRET or SESSION_SECRET must be configured');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptPassword(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptPassword(payload) {
  const [ivText, tagText, encryptedText] = String(payload || '').split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted password');

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivText, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

module.exports = {
  ALPHABET,
  generateInstitutionPassword,
  encryptPassword,
  decryptPassword
};
