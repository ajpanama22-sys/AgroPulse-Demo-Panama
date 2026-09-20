import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { usuarios } from "./db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      rol: "admin" | "gerencial" | "campo";
      empresaId: string | null;
      ubicacionId: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
        if (!user || !user.activo) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.nombre,
          email: user.email,
          rol: user.rol,
          empresaId: user.empresaId,
          ubicacionId: user.ubicacionId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as { rol: string; empresaId: string | null; ubicacionId: string | null };
        token.rol = u.rol;
        token.empresaId = u.empresaId;
        token.ubicacionId = u.ubicacionId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = String(token.sub);
      session.user.rol = token.rol as Session["user"]["rol"];
      session.user.empresaId = (token.empresaId as string | null) ?? null;
      session.user.ubicacionId = (token.ubicacionId as string | null) ?? null;
      return session;
    },
  },
});
