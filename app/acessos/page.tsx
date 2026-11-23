import Link from 'next/link'
import { redirect } from 'next/navigation'
import CriarAcesso from './CriarAcesso'
import local from './Acessos.module.css'
import { lerSessao } from '../lib/sessao-servidor'
import { supabaseAdmin } from '../lib/supabase-admin'
import { revogarAcesso, sair } from '../entrar/acoes'

export const revalidate = 0
export const metadata = { title: 'Acessos de clientes · Catálogo' }

function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function PaginaAcessos() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== 'equipe') redirect('/')

  const { data: acessos, error } = await supabaseAdmin()
    .from('acessos_temporarios')
    .select('id, cliente_nome, criado_por, criado_em, expira_em, revogado, ultimo_uso, usos')
    .order('criado_em', { ascending: false })
    .limit(300)

  const agora = Date.now()
  const situacao = (a: { revogado: boolean; expira_em: string }) =>
    a.revogado ? 'revogado' : new Date(a.expira_em).getTime() <= agora ? 'expirado' : 'ativo'

  return (
    <main className={local.pagina}>
      <div className={local.topo}>
        <div>
          <Link href="/" className={local.voltar}>← Voltar ao catálogo</Link>
          <h1 className={local.titulo}>Acessos de clientes</h1>
          <p className={local.sub}>Entrou como {sessao.nome}</p>
        </div>
        <form action={sair}>
          <button type="submit" className={local.botaoSair}>Sair</button>
        </form>
      </div>

      <CriarAcesso />

      <div className={local.bloco}>
        <h2 className={local.tituloBloco}>Acessos criados</h2>
        {error && <p className={local.erroTabela}>Não foi possível carregar: {error.message}</p>}
        {!error && (!acessos || acessos.length === 0) && <p className={local.sub}>Nenhum acesso criado ainda.</p>}
        {acessos && acessos.length > 0 && (
          <div className={local.tabelaRolagem}>
            <table className={local.tabela}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Situação</th>
                  <th>Válido até</th>
                  <th>Último uso</th>
                  <th>Criado por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {acessos.map((a) => {
                  const s = situacao(a)
                  return (
                    <tr key={a.id}>
                      <td>{a.cliente_nome}</td>
                      <td>
                        <span className={`${local.selo} ${local[`selo_${s}`]}`}>{s}</span>
                      </td>
                      <td>{formatarData(a.expira_em)}</td>
                      <td>
                        {formatarData(a.ultimo_uso)}
                        {a.usos ? ` (${a.usos}x)` : ''}
                      </td>
                      <td>{a.criado_por}</td>
                      <td>
                        {s === 'ativo' && (
                          <form action={revogarAcesso}>
                            <input type="hidden" name="id" value={a.id} />
                            <button type="submit" className={local.botaoRevogar}>Revogar</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
