// Login em um campo só: com "@" é o escritório (e-mail + senha);
// com placa é o motorista (placa + nome).
//
// O Supabase Auth precisa de e-mail e senha, então o login do motorista é
// derivado do nome: "João da Silva" -> joao.da.silva@motorista.transmas.local,
// senha "motorista:joao da silva". O motorista só digita a placa e o nome.
// Ao criar um motorista no Supabase, use credenciaisMotorista(nome).

const DOMINIO_MOTORISTA = "motorista.transmas.local"

// Com "@" é login do escritório
export function ehEmail(valor: string) {
  return valor.includes("@")
}

// Maiúsculas, sem traço nem espaço
export function normalizarPlaca(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

// Padrão antigo (ABC1234) e Mercosul (ABC1D23), igual à regra do banco
export function placaValida(valor: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizarPlaca(valor))
}

// Sem acento, minúsculo e com um espaço só entre as palavras
export function normalizarNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// E-mail e senha internos do motorista, derivados do nome completo
export function credenciaisMotorista(nome: string) {
  const normalizado = normalizarNome(nome)
  return {
    email: `${normalizado.replace(/ /g, ".")}@${DOMINIO_MOTORISTA}`,
    password: `motorista:${normalizado}`,
  }
}
