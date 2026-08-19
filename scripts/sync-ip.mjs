import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Sync IP script for StudioFlow
 * Automatically detects the current LAN IP and updates the .env file.
 * Useful when the modem restarts and changes your local IP.
 */

function getLocalIp() {
  const interfaces = networkInterfaces();
  let candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const addr = iface.address;
        // Skip Docker/Hyper-V virtual adapters (172.17.0.0 – 172.31.255.255)
        if (addr.startsWith('172.')) {
          const secondOctet = parseInt(addr.split('.')[1], 10);
          if (secondOctet >= 17 && secondOctet <= 31) continue;
        }
        if (addr.startsWith('192.') || addr.startsWith('172.') || addr.startsWith('10.')) {
          candidates.push({ addr, name });
        }
      }
    }
  }

  // Prefer interface with a default gateway (real network)
  const gateways = new Set();
  try {
    const output = execSync('route print -4', { encoding: 'utf8' });
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('0.0.0.0')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) gateways.add(parts[parts.length - 1]);
      }
    }
  } catch (_) {}

  if (gateways.size > 0) {
    for (const { addr, name } of candidates) {
      if (gateways.has(addr)) return addr;
    }
  }

  // Fallback: first valid candidate
  return candidates.length > 0 ? candidates[0].addr : null;
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

// Sync allowedDevOrigins in next.config.ts (wildcard "*" tidak bekerja di matchWildcardDomain)
const configPath = join(process.cwd(), 'next.config.ts');
try {
  let configContent = readFileSync(configPath, 'utf8');
  const updatedConfig = configContent.replace(
    /allowedDevOrigins: \[[^\]]*\]/,
    `allowedDevOrigins: ["${newIp}", "localhost:3000"]`
  );
  if (configContent === updatedConfig) {
    console.log('✅ next.config.ts is already up to date.');
  } else {
    writeFileSync(configPath, updatedConfig);
    console.log('🚀 next.config.ts has been successfully updated with the new IP!');
  }
} catch (error) {
  console.error('❌ Error updating next.config.ts:', error.message);
}
