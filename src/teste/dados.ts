// Dados de exemplo para os testes: cada função devolve uma linha completa,
// e o teste troca só os campos que importam para ele

import type { ServicoSituacao } from "@/lib/servicos"
import type { Tabela } from "@/lib/supabase"

export const SEDE = { latitude: -26.4855, longitude: -49.0714 }

let proximoId = 1

// Um serviço da view servicos_situacao (por padrão: coleta de hoje, aguardando)
export function servico(
  campos: Partial<ServicoSituacao> = {}
): ServicoSituacao {
  return {
    id: proximoId++,
    tipo: "coleta",
    status: "pendente",
    situacao: "aguardando",
    atrasado: false,
    empresa_id: 1,
    motorista_id: "motorista-1",
    data_servico: "2026-11-25",
    criado_em: "2026-11-25T12:00:00Z",
    criado_por: null,
    aceito_em: null,
    concluido_em: null,
    observacao: null,
    ...campos,
  }
}

// Uma empresa cadastrada (por padrão: cliente ativo em Jaraguá do Sul)
export function empresa(
  campos: Partial<Tabela<"empresas">> = {}
): Tabela<"empresas"> {
  return {
    id: 1,
    nome: "Empresa Exemplo LTDA",
    cnpj: null,
    telefone: null,
    endereco: "Rua das Flores, 100",
    bairro: "Centro",
    cidade: "Jaragua do Sul",
    uf: "SC",
    cep: "89251000",
    latitude: -26.48,
    longitude: -49.08,
    regiao_id: null,
    eh_sede: false,
    ativo: true,
    criado_em: "2026-10-20T12:00:00Z",
    ...campos,
  }
}
