import { cookies } from 'next/headers'
import { COOKIE_SESSAO, verificarSessao } from './sessao'

// Lê a sessão atual nas páginas e ações do servidor
export async function lerSessao() {
  const loja = await cookies()
  return verificarSessao(loja.get(COOKIE_SESSAO)?.value)
}
