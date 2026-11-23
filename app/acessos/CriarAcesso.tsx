'use client'

import { useActionState, useState } from 'react'
import styles from '../entrar/Entrar.module.css'
import local from './Acessos.module.css'
import { AcessoCriado, criarAcesso } from '../entrar/acoes'

const VAZIO: AcessoCriado = {}
const VALIDADES = [
  { dias: 1, texto: '1 dia' },
  { dias: 3, texto: '3 dias' },
  { dias: 7, texto: '7 dias' },
  { dias: 15, texto: '15 dias' },
  { dias: 30, texto: '30 dias' },
]

function formatarData(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CriarAcesso() {
  const [estado, acao, enviando] = useActionState(criarAcesso, VAZIO)
  const [copiado, setCopiado] = useState(false)
  const [mostrarPreco, setMostrarPreco] = useState(false)
  const [tipoAjuste, setTipoAjuste] = useState('nenhum')

  const mensagem = estado.codigo
    ? `Olá, ${estado.cliente}! Segue o seu acesso ao nosso catálogo:\n${estado.link}\n\n` +
      `Código: ${estado.codigo}\nVálido até ${formatarData(estado.expiraEm)}.`
    : ''

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className={local.bloco}>
      <h2 className={local.tituloBloco}>Novo acesso para cliente</h2>
      <form action={acao} className={local.formLinha}>
        <label className={styles.campo}>
          <span>Nome do cliente</span>
          <input name="cliente" placeholder="Ex.: Loja Maria - Curitiba" required />
        </label>
        <label className={styles.campo}>
          <span>Validade</span>
          <select name="dias" defaultValue="7">
            {VALIDADES.map((v) => (
              <option key={v.dias} value={v.dias}>
                {v.texto}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${styles.botao} ${local.botaoGerar}`} disabled={enviando}>
          {enviando ? 'Gerando...' : 'Gerar código'}
        </button>

        {/* Preço: desligado por padrão */}
        <div className={local.blocoPreco}>
          <label className={local.chave}>
            <input
              type="checkbox"
              name="mostrar_preco"
              checked={mostrarPreco}
              onChange={(e) => setMostrarPreco(e.target.checked)}
            />
            <span>Mostrar preço para este cliente</span>
          </label>
          {mostrarPreco && (
            <div className={local.opcoesPreco}>
              <label className={styles.campo}>
                <span>Tabela</span>
                <select name="tabela_preco" defaultValue="original">
                  <option value="original">Preço original</option>
                  <option value="promocional">Promocional (planilha publicada)</option>
                </select>
              </label>
              <label className={styles.campo}>
                <span>Ajuste</span>
                <select name="tipo_ajuste" value={tipoAjuste} onChange={(e) => setTipoAjuste(e.target.value)}>
                  <option value="nenhum">Sem ajuste</option>
                  <option value="valor">Valor por peça (R$)</option>
                  <option value="percentual">Porcentagem (%)</option>
                </select>
              </label>
              {tipoAjuste !== 'nenhum' && (
                <label className={styles.campo}>
                  <span>{tipoAjuste === 'valor' ? 'Valor (R$ por peça)' : 'Porcentagem'}</span>
                  <input
                    name="valor_ajuste"
                    inputMode="decimal"
                    placeholder={tipoAjuste === 'valor' ? '+3,00' : '-10'}
                    required
                  />
                </label>
              )}
              <p className={local.dicaPreco}>
                {tipoAjuste === 'valor'
                  ? 'Ex.: +3,00 soma R$ 3,00 em cada peça; -2,50 dá R$ 2,50 de desconto por peça. A caixa acompanha.'
                  : tipoAjuste === 'percentual'
                    ? 'Ex.: -10 dá 10% de desconto; +5 aumenta 5%.'
                    : 'O cliente vê o preço da tabela, sem mudança.'}{' '}
                Na tabela promocional, as peças fora da planilha usam o preço original.
              </p>
            </div>
          )}
        </div>
      </form>
      {estado.erro && <p className={styles.erro}>{estado.erro}</p>}

      {estado.codigo && (
        <div className={local.resultado}>
          <span className={local.rotulo}>Código para {estado.cliente}</span>
          <span className={local.codigo}>{estado.codigo}</span>
          <span className={local.validade}>Válido até {formatarData(estado.expiraEm)}</span>
          <p className={local.aviso}>
            Anote ou envie agora: por segurança, o código não aparece de novo depois que você sair desta página.
          </p>
          <div className={local.acoesResultado}>
            <a
              className={`${styles.botao} ${local.botaoWhats}`}
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar pelo WhatsApp
            </a>
            <button type="button" className={`${styles.botao} ${local.botaoSecundario}`} onClick={copiar}>
              {copiado ? 'Copiado!' : 'Copiar mensagem'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
