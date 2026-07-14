import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SENHA_TESTE = "senha123";

async function main() {
  const empresa = await prisma.empresa.upsert({
    where: { cnpj: "00000000000100" },
    update: {},
    create: {
      razaoSocial: "Empresa de Desenvolvimento Ltda",
      nomeFantasia: "Comercial e Financeiro (dev)",
      cnpj: "00000000000100",
      diaInicioCiclo: 11,
      diaFimCiclo: 10,
    },
  });

  const senhaHash = await bcrypt.hash(SENHA_TESTE, 10);

  const admin = await prisma.usuario.upsert({
    where: { email: "admin@dev.local" },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: "Administrador de Teste",
      email: "admin@dev.local",
      senhaHash,
      perfil: "ADMIN",
      ativo: true,
    },
  });

  console.log("Seed concluído.");
  console.log("Empresa:", empresa.nomeFantasia);
  console.log("Login de teste -> e-mail: admin@dev.local | senha:", SENHA_TESTE);
  console.log("Usuário id:", admin.id);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
