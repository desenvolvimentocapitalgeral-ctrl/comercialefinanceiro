import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

const ROTAS_ADMIN_FINANCEIRO = ["/dashboard", "/representantes", "/contratos", "/produtos", "/clientes", "/vendas", "/contas-a-receber", "/comissoes", "/bonificacoes", "/campanhas", "/relatorios", "/auditoria", "/configuracoes"];
const ROTAS_REPRESENTANTE = ["/portal"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const usuario = req.auth?.user;

  const rotaAdminFinanceiro = ROTAS_ADMIN_FINANCEIRO.some((rota) => pathname.startsWith(rota));
  const rotaRepresentante = ROTAS_REPRESENTANTE.some((rota) => pathname.startsWith(rota));

  if (!rotaAdminFinanceiro && !rotaRepresentante) {
    return NextResponse.next();
  }

  if (!usuario) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // REPRESENTANTE nunca acessa /dashboard e módulos administrativos — Prompt 1, Seção 6.2
  if (rotaAdminFinanceiro && usuario.perfil === "REPRESENTANTE") {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  // ADMIN/FINANCEIRO não têm portal próprio de representante
  if (rotaRepresentante && usuario.perfil !== "REPRESENTANTE") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/representantes/:path*", "/contratos/:path*", "/produtos/:path*", "/clientes/:path*", "/vendas/:path*", "/contas-a-receber/:path*", "/comissoes/:path*", "/bonificacoes/:path*", "/campanhas/:path*", "/relatorios/:path*", "/auditoria/:path*", "/configuracoes/:path*", "/portal/:path*"],
};
