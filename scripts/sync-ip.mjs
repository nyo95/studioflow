import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Sync IP script for StudioFlow
 * Automatically detects the current LAN IP and updates the .env file.
 * Useful when the modem restarts and changes your local IP.
 */

function getLocalIp() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Look for IPv4 and skip internal (loopback) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        // Typically we want the 172.x.x.x or 192.x.x.x address
        if (iface.address.startsWith('172.') || iface.address.startsWith('192.')) {
          return iface.address;
        }
      }
    }
  }
  return null;
}

const envPath = join(process.cwd(), '.env');
const newIp = getLocalIp();

if (!newIp) {
  console.error('❌ Could not detect local IP address.');
  process.exit(1);
}

console.log(`\n🔍 Detected Local IP: ${newIp}`);

try {
  let envContent = readFileSync(envPath, 'utf8');
  
  // Previous IP detection (looks for strings like http://172.16.1.xxx:3000)
  // Or just replace the specific lines we know.
  
  const updatedContent = envContent
    .replace(/(AUTH_URL="http:\/\/)(.*)(:3000")/g, `$1${newIp}$3`)
    .replace(/(NEXTAUTH_URL="http:\/\/)(.*)(:3000")/g, `$1${newIp}$3`)
    .replace(/(NEXT_PUBLIC_SITE_URL="http:\/\/)(.*)(:3000")/g, `$1${newIp}$3`);

  if (envContent === updatedContent) {
    console.log('✅ .env is already up to date or no matching patterns found.');
  } else {
    writeFileSync(envPath, updatedContent);
    console.log('🚀 .env has been successfully updated with the new IP!');
  }
} catch (error) {
  console.error('❌ Error updating .env:', error.message);
}

const nextConfigPath = join(process.cwd(), 'next.config.ts');
try {
  let configContent = readFileSync(nextConfigPath, 'utf8');
  const updatedConfig = configContent
    .replace(
      /allowedDevOrigins: \[.*\]/,
      `allowedDevOrigins: ["${newIp}", "localhost:3000"]`
    )
    .replace(
      /allowedOrigins: \[.*\]/,
      `allowedOrigins: ["localhost:3000", "${newIp}:3000"]`
    );

  if (configContent === updatedConfig) {
    console.log('✅ next.config.ts is already up to date.');
  } else {
    writeFileSync(nextConfigPath, updatedConfig);
    console.log('🚀 next.config.ts has been successfully updated with the new IP!');
  }
} catch (error) {
  console.error('❌ Error updating next.config.ts:', error.message);
}
