import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // The editable sorting demo executes user code inside its existing worker.
  // Only that public page needs eval; auth/cabinet pages prohibit it.
  const evalSource = request.nextUrl.pathname === "/" || process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
  const analytics = request.nextUrl.pathname === "/" ? "https://mc.yandex.ru https://mc.yandex.com https://www.google-analytics.com https://www.googletagmanager.com" : "";
  const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalSource}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${analytics}; font-src 'self'; connect-src 'self' ${apiOrigin} ${analytics}; frame-src 'self' ${analytics}; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-public-analytics", request.nextUrl.pathname === "/" ? "1" : "0");
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!api/|_next/static|_next/image|icons/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|js|css|woff2|mp4)$).*)"] };
