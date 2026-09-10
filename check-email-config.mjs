import dotenv from 'dotenv';
dotenv.config();

console.log('='.repeat(80));
console.log('EMAIL CONFIGURATION CHECK (Production Environment)');
console.log('='.repeat(80));
console.log('');

// Check RESEND_API_KEY presence
const hasResendKey = !!process.env.RESEND_API_KEY;
const resendKeyLength = process.env.RESEND_API_KEY?.length || 0;
console.log('1. RESEND_API_KEY:');
console.log(`   Present: ${hasResendKey}`);
console.log(`   Length: ${resendKeyLength} characters`);
console.log(`   Starts with "re_": ${process.env.RESEND_API_KEY?.startsWith('re_') || false}`);
console.log('');

// Check EMAIL_FROM (redact local part)
const emailFrom = process.env.EMAIL_FROM || '';
const hasEmailFrom = !!emailFrom;
console.log('2. EMAIL_FROM:');
console.log(`   Present: ${hasEmailFrom}`);
if (emailFrom) {
  const match = emailFrom.match(/<([^>]+)>/) || emailFrom.match(/([^\s]+@[^\s]+)/);
  const email = match ? match[1] : emailFrom;
  const [localPart, domain] = email.split('@');
  console.log(`   Format: ${emailFrom.includes('<') ? 'Display Name <email>' : 'bare email'}`);
  console.log(`   Domain: ${domain || '(parse failed)'}`);
  console.log(`   Local part: ${localPart ? localPart[0] + '***' + localPart[localPart.length - 1] : '(parse failed)'}`);
}
console.log('');

// Check APP_URL
const appUrl = process.env.APP_URL || '';
const hasAppUrl = !!appUrl;
console.log('3. APP_URL:');
console.log(`   Present: ${hasAppUrl}`);
if (appUrl) {
  try {
    const url = new URL(appUrl);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Hostname: ${url.hostname}`);
    console.log(`   Valid URL: true`);
  } catch (err) {
    console.log(`   Valid URL: false (${err.message})`);
  }
}
console.log('');

// Check AUTH_SECRET
const hasAuthSecret = !!process.env.AUTH_SECRET;
const authSecretLength = process.env.AUTH_SECRET?.length || 0;
console.log('4. AUTH_SECRET:');
console.log(`   Present: ${hasAuthSecret}`);
console.log(`   Length: ${authSecretLength} characters`);
console.log(`   Meets minimum (32): ${authSecretLength >= 32}`);
console.log('');

// Check DATABASE_URL
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const databaseUrl = process.env.DATABASE_URL || '';
console.log('5. DATABASE_URL:');
console.log(`   Present: ${hasDatabaseUrl}`);
if (databaseUrl) {
  const isNeon = databaseUrl.includes('neon.tech');
  console.log(`   Provider: ${isNeon ? 'Neon' : 'PostgreSQL'}`);
  if (isNeon) {
    const match = databaseUrl.match(/ep-[^.]+/);
    console.log(`   Endpoint: ${match ? match[0] : '(parse failed)'}`);
  }
}
console.log('');

console.log('='.repeat(80));
console.log('Configuration check complete. Ready for signup test.');
console.log('='.repeat(80));
