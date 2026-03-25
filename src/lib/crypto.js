import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

// Use Buffer.from with specific encoding. We expect a 64-char hex string (32 bytes).
// If it's plain text 32 chars, we could use utf8, but hex is safer for keys.
let keyBuffer;
if (process.env.ENCRYPTION_KEY) {
  keyBuffer = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  if (keyBuffer.length !== 32) {
    // Fallback if not valid hex, just use a 32 byte hash of whatever it is
    keyBuffer = crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY)).digest();
  }
} else {
  // Fallback for dev strictly (unsafe for prod)
  keyBuffer = crypto.randomBytes(32);
  console.warn("WARNING: ENCRYPTION_KEY not set. Using random bytes.");
}

export function encrypt(text) {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text) {
  if (!text) return text;
  
  const parts = text.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '***';
  
  const prefixMatch = key.match(/^([a-zA-Z]+-)/);
  const prefixLength = prefixMatch ? prefixMatch[0].length : 3;
  
  const prefix = key.substring(0, prefixLength);
  const suffix = key.substring(key.length - 4);
  return `${prefix}...${suffix}`;
}
