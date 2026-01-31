/**
 * IP Utility Functions
 * Extract and validate IP addresses from requests
 */

/**
 * Get client IP address from Netlify function event
 * @param {import('@netlify/functions').HandlerEvent} event - Netlify function event
 * @returns {string | null} - Client IP address or null
 */
export function getClientIP(event) {
  if (!event || !event.headers) {
    return null;
  }

  // Netlify provides IP in multiple headers
  const ipHeaders = [
    'x-nf-client-connection-ip', // Netlify's primary IP header
    'x-forwarded-for',           // Proxied requests
    'x-real-ip',                 // Direct requests
    'client-ip',                 // Fallback
  ];

  for (const header of ipHeaders) {
    const value = event.headers[header] || event.headers[header.toLowerCase()];
    if (value) {
      // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2)
      // Take the first one (the original client)
      const ip = value.split(',')[0].trim();
      if (ip && isValidIP(ip)) {
        return ip;
      }
    }
  }

  return null;
}

/**
 * Basic IP validation
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid IP
 */
function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 validation (basic)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * Check if IP is from a known VPN/proxy service
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if likely VPN/proxy
 */
export function isLikelyVPN(ip) {
  if (!ip) return false;

  // Common VPN/cloud provider IP ranges (simplified)
  const vpnPatterns = [
    /^10\./, // Private network
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private network
    /^192\.168\./, // Private network
    /^127\./, // Localhost
  ];

  return vpnPatterns.some(pattern => pattern.test(ip));
}

/**
 * Hash IP address for privacy-preserving storage
 * @param {string} ip - IP address
 * @returns {string} - Hashed IP (first 3 octets only for IPv4)
 */
export function hashIPForPrivacy(ip) {
  if (!ip) return 'unknown';

  // For IPv4, only store first 3 octets for privacy
  // 192.168.1.100 -> 192.168.1.*
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
    }
  }

  // For IPv6, only store first 4 groups
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::*`;
    }
  }

  return ip;
}
