'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  COOKIE_SESSAO,
  DOMINIO_EQUIPE,
  assinarSessao,
  emailDaEquipe,
  hashCodigo,
  impressaoMaster,
  normalizarCodigo,
  senhaMasterConfere,
  senhaMasterConfigurada,
} from '../lib/sessao'
import { supabaseAdmin, supabaseAuth } from '../lib/supabase-admin'
import { lerSessao } from '../lib/sessao-servidor'

export interface Resultado {
  erro?: string
  ok?: string
}

const DIAS_SESSAO_EQUIPE = 7

// Só volta para endereços do próprio site
function destinoSeguro(volta: FormDataEntryValue | null): string {
  const texto = String(volta || '')
  return texto.startsWith('/') && !texto.startsWith('//') && !texto.startsWith('/entrar') ? texto : '/'
}

async function gravarSessao(token: string, expiraEm: Date) {
  const loja = await cookies()
  loja.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiraEm,
  })
}

async function origemDoSite(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const protocolo = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocolo}://${host}`
}

// ---------- Equipe: entrar ----------
export async function entrarEquipe(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const senha = String(form.get('senha') || '')
  if (!emailDaEquipe(email)) return { erro: `Use o seu e-mail ${DOMINIO_EQUIPE}.` }
  if (!senha) return { erro: 'Digite a senha.' }

  const { data, error } = await supabaseAuth().auth.signInWithPassword({ email, password: senha })
  if (error || !data.user) {
    const msg = String(error?.message || '').toLowerCase()
    if (msg.includes('confirm')) return { erro: 'Confirme o seu e-mail antes de entrar (veja a caixa de entrada).' }
    return { erro: 'E-mail ou senha incorretos.' }
  }

  const expira = new Date(Date.now() + DIAS_SESSAO_EQUIPE * 24 * 3600 * 1000)
  const token = await assinarSessao({
    tipo: 'equipe',
    id: data.user.id,
    nome: email,
    exp: Math.floor(expira.getTime() / 1000),
  })
  await gravarSessao(token, expira)
  redirect(destinoSeguro(form.get('volta')))
}

// ---------- Donos: senha master ----------
export async function entrarMaster(_anterior: Resultado, form: FormData): Promise<Resultado> {
  if (!senhaMasterConfigurada()) {
    return { erro: 'A senha master ainda não foi configurada (variável SENHA_MASTER na Vercel).' }
  }
  if (!(await senhaMasterConfere(String(form.get('senha') || '')))) {
    await new Promise((r) => setTimeout(r, 900)) // atrasa quem tenta adivinhar
    return { erro: 'Senha incorreta.' }
  }
  const expira = new Date(Date.now() + DIAS_SESSAO_EQUIPE * 24 * 3600 * 1000)
  const token = await assinarSessao({
    tipo: 'equipe',
    id: `master:${await impressaoMaster()}`,
    nome: 'Acesso administrativo',
    exp: Math.floor(expira.getTime() / 1000),
  })
  await gravarSessao(token, expira)
  redirect(destinoSeguro(form.get('volta')))
}

// ---------- Equipe: criar conta ----------
export async function cadastrarEquipe(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const senha = String(form.get('senha') || '')
  const confirmar = String(form.get('confirmar') || '')
  if (!emailDaEquipe(email)) return { erro: `O cadastro é só para e-mails ${DOMINIO_EQUIPE}.` }
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' }
  if (senha !== confirmar) return { erro: 'As senhas não são iguais.' }

  const { error } = await supabaseAuth().auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: `${await origemDoSite()}/entrar?confirmado=1` },
  })
  if (error) {
    const msg = String(error.message || '').toLowerCase()
    if (msg.includes('already')) return { erro: 'Este e-mail já tem cadastro. Use "Entrar".' }
    if (msg.includes('anjuu')) return { erro: `O cadastro é só para e-mails ${DOMINIO_EQUIPE}.` }
    return { erro: `Não foi possível cadastrar: ${error.message}` }
  }
  return { ok: `Enviamos um link de confirmação para ${email}. Clique nele e depois entre aqui.` }
}

// ---------- Cliente: entrar com código ----------
export async function entrarCliente(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const codigo = normalizarCodigo(String(form.get('codigo') || ''))
  if (codigo.length < 6) return { erro: 'Digite o código de acesso que você recebeu.' }

  const banco = supabaseAdmin()
  const { data: acesso } = await banco
    .from('acessos_temporarios')
    .select('id, cliente_nome, expira_em, revogado, usos, mostrar_preco, tabela_preco, ajuste_percentual, ajuste_valor')
    .eq('codigo_hash', await hashCodigo(codigo))
    .maybeSingle()

  const expira = acesso ? new Date(acesso.expira_em) : null
  if (!acesso || acesso.revogado || !expira || expira.getTime() <= Date.now()) {
    return { erro: 'Código inválido ou expirado. Peça um novo código ao seu vendedor.' }
  }

  await banco
    .from('acessos_temporarios')
    .update({ ultimo_uso: new Date().toISOString(), usos: (acesso.usos || 0) + 1 })
    .eq('id', acesso.id)

  const token = await assinarSessao({
    tipo: 'cliente',
    id: acesso.id,
    nome: acesso.cliente_nome,
    exp: Math.floor(expira.getTime() / 1000),
    preco: acesso.mostrar_preco
      ? {
          tabela: acesso.tabela_preco === 'promocional' ? 'promocional' : 'original',
          ajuste: Number(acesso.ajuste_percentual) || 0,
          acrescimo: Number(acesso.ajuste_valor) || 0,
        }
      : null,
  })
  await gravarSessao(token, expira)
  redirect(destinoSeguro(form.get('volta')))
}

// ---------- Sair ----------
export async function sair() {
  const loja = await cookies()
  loja.delete(COOKIE_SESSAO)
  redirect('/entrar')
}

// ---------- Acessos de clientes (só equipe) ----------
export interface AcessoCriado extends Resultado {
  codigo?: string
  cliente?: string
  link?: string
  expiraEm?: string
}

// Lê números do jeito que o vendedor digita: "+3,00", "-2,50", "R$ 3", "1.234,50", "10%"
function lerNumero(texto: string): number | null {
  let t = texto.trim().replace(/R\$|%|\s/gi, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const LETRAS_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem 0/O, 1/I/L, para não confundir

function gerarCodigo(): string {
  const aleatorio = crypto.getRandomValues(new Uint8Array(8))
  const letras = Array.from(aleatorio, (n) => LETRAS_CODIGO[n % LETRAS_CODIGO.length]).join('')
  return `${letras.slice(0, 4)}-${letras.slice(4)}`
}

export async function criarAcesso(_anterior: AcessoCriado, form: FormData): Promise<AcessoCriado> {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== 'equipe') return { erro: 'Só a equipe pode criar acessos.' }

  const cliente = String(form.get('cliente') || '').trim()
  const dias = Math.min(Math.max(Number(form.get('dias') || 7), 1), 90)
  if (cliente.length < 2) return { erro: 'Digite o nome do cliente.' }

  // Preço: desligado por padrão; ligado, usa a tabela escolhida e o ajuste (R$ por peça ou %)
  const mostrarPreco = form.get('mostrar_preco') === 'on'
  const tabelaPreco = form.get('tabela_preco') === 'promocional' ? 'promocional' : 'original'
  const tipoAjuste = String(form.get('tipo_ajuste') || 'nenhum')
  const valorAjuste = lerNumero(String(form.get('valor_ajuste') || ''))
  let percentual = 0
  let acrescimo = 0
  if (mostrarPreco && tipoAjuste !== 'nenhum') {
    if (valorAjuste === null) return { erro: 'Digite o ajuste como no exemplo: +3,00 ou -2,50.' }
    if (tipoAjuste === 'percentual') {
      if (valorAjuste < -90 || valorAjuste > 300) return { erro: 'A porcentagem deve ficar entre -90 e +300.' }
      percentual = valorAjuste
    } else {
      if (Math.abs(valorAjuste) > 1000) return { erro: 'O valor por peça deve ficar entre -1.000,00 e +1.000,00.' }
      acrescimo = valorAjuste
    }
  }

  const codigo = gerarCodigo()
  const expiraEm = new Date(Date.now() + dias * 24 * 3600 * 1000)
  const { error } = await supabaseAdmin()
    .from('acessos_temporarios')
    .insert({
      codigo_hash: await hashCodigo(codigo),
      cliente_nome: cliente,
      criado_por: sessao.nome,
      expira_em: expiraEm.toISOString(),
      mostrar_preco: mostrarPreco,
      tabela_preco: mostrarPreco ? tabelaPreco : null,
      ajuste_percentual: mostrarPreco ? Math.round(percentual * 100) / 100 : 0,
      ajuste_valor: mostrarPreco ? Math.round(acrescimo * 100) / 100 : 0,
    })
  if (error) return { erro: `Não foi possível criar o acesso: ${error.message}` }

  revalidatePath('/acessos')
  return {
    ok: 'Acesso criado.',
    codigo,
    cliente,
    link: `${await origemDoSite()}/entrar?codigo=${encodeURIComponent(codigo)}`,
    expiraEm: expiraEm.toISOString(),
  }
}

// Excluir do histórico: só acessos já encerrados (revogados ou vencidos)
export async function excluirAcesso(form: FormData) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== 'equipe') return
  const id = String(form.get('id') || '')
  if (!id) return
  const banco = supabaseAdmin()
  const { data } = await banco.from('acessos_temporarios').select('revogado, expira_em').eq('id', id).maybeSingle()
  const encerrado = !!data && (data.revogado || new Date(data.expira_em).getTime() <= Date.now())
  if (encerrado) await banco.from('acessos_temporarios').delete().eq('id', id)
  revalidatePath('/acessos')
}

export async function limparEncerrados() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== 'equipe') return
  const banco = supabaseAdmin()
  await banco.from('acessos_temporarios').delete().eq('revogado', true)
  await banco.from('acessos_temporarios').delete().lte('expira_em', new Date().toISOString())
  revalidatePath('/acessos')
}

export async function revogarAcesso(form: FormData) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== 'equipe') return
  const id = String(form.get('id') || '')
  if (id) await supabaseAdmin().from('acessos_temporarios').update({ revogado: true }).eq('id', id)
  revalidatePath('/acessos')
}
