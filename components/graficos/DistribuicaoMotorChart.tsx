"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DistribuicaoMotorChart({ dados }: { dados: { motor: string; quantidade: number }[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum contrato ativo com regra de comissão ainda.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <XAxis dataKey="motor" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(valor) => [`${valor} representante(s)`, "Quantidade"]} />
          <Bar dataKey="quantidade" fill="#171717" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
