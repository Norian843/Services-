
import { NhostClient } from '@nhost/nhost-js';

// Nhost project configuration based on user-provided information
const NHOST_SUBDOMAIN = 'nxnydnbhwbmfuqxfzbcx';
const NHOST_REGION = 'us-east-1';

// Initialize the Nhost client with subdomain and region for explicit configuration
export const nhost = new NhostClient({
  subdomain: NHOST_SUBDOMAIN,
  region: NHOST_REGION,
  // Other NhostClient options can be added here if needed, e.g.:
  // autoSignIn: true,
  // autoRefreshToken: true,
});

console.log(`Nhost client initialized for subdomain: '${NHOST_SUBDOMAIN}', region: '${NHOST_REGION}'`);
