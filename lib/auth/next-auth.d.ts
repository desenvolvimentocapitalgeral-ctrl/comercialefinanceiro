import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    perfil: string;
    empresaId: string;
    representanteId: string | null;
  }

  interface Session {
    user: {
      id: string;
      perfil: string;
      empresaId: string;
      representanteId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    perfil: string;
    empresaId: string;
    representanteId: string | null;
  }
}
