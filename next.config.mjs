/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy. Kept compatible with Next's App Router (which emits
// inline bootstrap scripts) and Recharts (inline styles), and with product
// images served from third-party retailer CDNs over https. 'unsafe-eval' and the
// HMR websocket are only allowed in development.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  // fonts.gstatic / fonts.googleapis allow the bundled /trade-demo static app to
  // load its editorial webfonts (Fraunces / IBM Plex) under the portal's CSP.
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws:" : ""}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The "Customs Gap" demo is a self-contained Vite SPA served from
  // public/trade-demo/. afterFiles runs after static files resolve, so real
  // assets (/trade-demo/assets/*, /trade-demo/data/*) are served directly and
  // only client-router paths fall through to the SPA's index.html.
  async rewrites() {
    return {
      afterFiles: [
        { source: "/trade-demo", destination: "/trade-demo/index.html" },
        { source: "/trade-demo/:path*", destination: "/trade-demo/index.html" },
      ],
    };
  },
};

export default nextConfig;
