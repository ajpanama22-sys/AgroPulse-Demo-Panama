import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Cada rol vive encerrado en su propia experiencia — esto no es solo un
// menú distinto, el middleware corta el paso a nivel de ruta. "campo" y
// "gerencial" NUNCA deben poder navegar al portal de escritorio completo,
// aunque conozcan la URL: ese es justo el tipo de límite que en FLOTIA se
// rompió a nivel de filas de base de datos (fuga entre tenants) — acá se
// aplica el mismo principio a nivel de rutas.
export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rol = req.auth.user?.rol;
  const path = req.nextUrl.pathname;

  if (rol === "campo" && !path.startsWith("/campo")) {
    return NextResponse.redirect(new URL("/campo", req.nextUrl.origin));
  }
  if (rol === "gerencial" && !path.startsWith("/ejecutivo")) {
    return NextResponse.redirect(new URL("/ejecutivo", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|brand|models|login|manifest-campo.json|manifest-ejecutivo.json|sw-campo.js|sw-ejecutivo.js).*)",
  ],
};
