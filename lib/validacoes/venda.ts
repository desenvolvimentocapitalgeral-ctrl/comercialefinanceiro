import { z } from "zod";

export const vendaManualSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente"),
  produtoId: z.string().min(1, "Selecione um produto"),
  representanteId: z.string().min(1, "Selecione um representante"),
  dataVenda: z.string().min(1, "Informe a data da venda"),
  valorTotal: z.number().positive("Informe um valor maior que zero"),
  quantidadeParcelas: z.number().int().min(1, "No mínimo 1 parcela").max(48, "No máximo 48 parcelas"),
  dosesVendidas: z.number().int().positive().optional(),
  descontoConcedidoPorDose: z.number().optional(),
});

export type VendaManualFormValues = z.infer<typeof vendaManualSchema>;
