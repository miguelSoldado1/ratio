const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://accounts.spotify.com https://api.spotify.com https://*.ce2122099880570dc3d6f5908544bb21.r2.cloudflarestorage.com",
  "font-src 'self'",
  "form-action 'self' https://accounts.spotify.com https://accounts.google.com https://discord.com",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://assets.ratiomusic.live https://assets-dev.ratiomusic.live https://i.scdn.co https://mosaic.scdn.co https://image-cdn-ak.spotifycdn.com https://*.googleusercontent.com https://cdn.discordapp.com https://media.discordapp.net https://*.fbcdn.net",
  "manifest-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const permissionsPolicy = "camera=(), geolocation=(), microphone=(), payment=(), usb=()";

export function withSecurityHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Permissions-Policy", permissionsPolicy);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");

  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
