import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_SESSAO, impressaoMaster, verificarSessao } from './app/lib/sessao'
import { supabaseAdmin } from './app/lib/supabase-admin'

// Todo o site exige login, menos a página /entrar.
// Equipe: sessão assinada. Cliente: sessão assinada + o acesso temporário precisa estar valendo no banco
// (assim, revogar no painel derruba o cliente na hora).

const PAGINAS_ABERTAS = ['/entrar']

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (PAGINAS_ABERTAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const irParaEntrar = (motivo?: string) => {
    const url = req.nextUrl.clone()
    url.pathname = '/entrar'
    url.search = ''
    if (pathname !== '/' || search) url.searchParams.set('volta', `${pathname}${search}`)
    if (motivo) url.searchParams.set('motivo', motivo)
    const resposta = NextResponse.redirect(url)
    if (motivo) resposta.cookies.delete(COOKIE_SESSAO)
    return resposta
  }

  const sessao = await verificarSessao(req.cookies.get(COOKIE_SESSAO)?.value)
  if (!sessao) return irParaEntrar()

  if (sessao.tipo === 'cliente' && !(await acessoAindaValido(sessao.id))) {
    return irParaEntrar('expirado')
  }

  // Senha master trocada na Vercel: quem entrou com a antiga sai
  if (sessao.id.startsWith('master:') && sessao.id !== `master:${await impressaoMaster()}`) {
    return irParaEntrar('master')
  }

  // Página de acessos de clientes: só equipe
  if (pathname.startsWith('/acessos') && sessao.tipo !== 'equipe') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

async function acessoAindaValido(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('acessos_temporarios')
      .select('revogado, expira_em')
      .eq('id', id)
      .maybeSingle()
    if (error) return true // falha momentânea do banco: não derruba o cliente (o cookie também vence sozinho)
    return !!data && !data.revogado && new Date(data.expira_em).getTime() > Date.now()
  } catch {
    return true
  }
}

export const config = {
  // Não passa pelo login: arquivos internos do Next e imagens/ícones
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)'],
}
