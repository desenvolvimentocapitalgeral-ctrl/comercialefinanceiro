import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

const credenciaisSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credenciais) {
        const parsed = credenciaisSchema.safeParse(credenciais);
        if (!parsed.success) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: parsed.data.email },
          include: { representante: true },
        });
        if (!usuario || !usuario.ativo) return null;

        const senhaValida = await bcrypt.compare(parsed.data.senha, usuario.senhaHash);
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nome,
          perfil: usuario.perfil,
          empresaId: usuario.empresaId,
          representanteId: usuario.representante?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.perfil = user.perfil;
        token.empresaId = user.empresaId;
        token.representanteId = user.representanteId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.perfil = token.perfil as string;
        session.user.empresaId = token.empresaId as string;
        session.user.representanteId = token.representanteId as string | null;
      }
      return session;
    },
  },
});
