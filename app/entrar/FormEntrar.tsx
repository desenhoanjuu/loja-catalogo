'use client'

import { useActionState, useState } from 'react'
import styles from './Entrar.module.css'
import { Resultado, cadastrarEquipe, entrarCliente, entrarEquipe, entrarMaster } from './acoes'

type Aba = 'cliente' | 'equipe' | 'cadastro' | 'master'

interface Props {
  volta: string
  codigoInicial: string
  abaInicial: Aba
  aviso: string | null
}

const VAZIO: Resultado = {}

export default function FormEntrar({ volta, codigoInicial, abaInicial, aviso }: Props) {
  const [aba, setAba] = useState<Aba>(abaInicial)
  const [estadoCliente, acaoCliente, enviandoCliente] = useActionState(entrarCliente, VAZIO)
  const [estadoEquipe, acaoEquipe, enviandoEquipe] = useActionState(entrarEquipe, VAZIO)
  const [estadoCadastro, acaoCadastro, enviandoCadastro] = useActionState(cadastrarEquipe, VAZIO)
  const [estadoMaster, acaoMaster, enviandoMaster] = useActionState(entrarMaster, VAZIO)

  return (
    <div className={styles.cartao}>
      <h1 className={styles.titulo}>Catálogo</h1>
      <p className={styles.subtitulo}>Acesso restrito a clientes e equipe.</p>

      {aviso && <p className={styles.aviso}>{aviso}</p>}

      <div className={styles.abas} role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'cliente'}
          className={`${styles.aba} ${aba === 'cliente' ? styles.abaAtiva : ''}`} onClick={() => setAba('cliente')}>
          Sou cliente
        </button>
        <button type="button" role="tab" aria-selected={aba !== 'cliente'}
          className={`${styles.aba} ${aba !== 'cliente' ? styles.abaAtiva : ''}`} onClick={() => setAba('equipe')}>
          Equipe
        </button>
      </div>

      {aba === 'cliente' && (
        <form action={acaoCliente} className={styles.formulario}>
          <input type="hidden" name="volta" value={volta} />
          <label className={styles.campo}>
            <span>Código de acesso</span>
            <input name="codigo" defaultValue={codigoInicial} placeholder="XXXX-XXXX" autoComplete="one-time-code"
              autoCapitalize="characters" className={styles.inputCodigo} required />
          </label>
          {estadoCliente.erro && <p className={styles.erro}>{estadoCliente.erro}</p>}
          <button type="submit" className={styles.botao} disabled={enviandoCliente}>
            {enviandoCliente ? 'Entrando...' : 'Entrar'}
          </button>
          <p className={styles.dica}>Recebeu um link do seu vendedor? O código já vem preenchido.</p>
        </form>
      )}

      {aba === 'equipe' && (
        <form action={acaoEquipe} className={styles.formulario}>
          <input type="hidden" name="volta" value={volta} />
          <label className={styles.campo}>
            <span>E-mail</span>
            <input type="email" name="email" placeholder="nome@anjuu.com.br" autoComplete="username" required />
          </label>
          <label className={styles.campo}>
            <span>Senha</span>
            <input type="password" name="senha" autoComplete="current-password" required />
          </label>
          {estadoEquipe.erro && <p className={styles.erro}>{estadoEquipe.erro}</p>}
          <button type="submit" className={styles.botao} disabled={enviandoEquipe}>
            {enviandoEquipe ? 'Entrando...' : 'Entrar'}
          </button>
          <button type="button" className={styles.link} onClick={() => setAba('cadastro')}>
            Primeiro acesso? Criar conta da equipe
          </button>
          <button type="button" className={styles.link} onClick={() => setAba('master')}>
            Acesso administrativo
          </button>
        </form>
      )}

      {aba === 'master' && (
        <form action={acaoMaster} className={styles.formulario}>
          <input type="hidden" name="volta" value={volta} />
          <label className={styles.campo}>
            <span>Senha administrativa</span>
            <input type="password" name="senha" autoComplete="current-password" autoFocus required />
          </label>
          {estadoMaster.erro && <p className={styles.erro}>{estadoMaster.erro}</p>}
          <button type="submit" className={styles.botao} disabled={enviandoMaster}>
            {enviandoMaster ? 'Entrando...' : 'Entrar'}
          </button>
          <button type="button" className={styles.link} onClick={() => setAba('equipe')}>
            Voltar ao login da equipe
          </button>
        </form>
      )}

      {aba === 'cadastro' && (
        <form action={acaoCadastro} className={styles.formulario}>
          <label className={styles.campo}>
            <span>E-mail da empresa</span>
            <input type="email" name="email" placeholder="nome@anjuu.com.br" autoComplete="username" required />
          </label>
          <label className={styles.campo}>
            <span>Senha (mínimo 8 caracteres)</span>
            <input type="password" name="senha" minLength={8} autoComplete="new-password" required />
          </label>
          <label className={styles.campo}>
            <span>Repita a senha</span>
            <input type="password" name="confirmar" minLength={8} autoComplete="new-password" required />
          </label>
          {estadoCadastro.erro && <p className={styles.erro}>{estadoCadastro.erro}</p>}
          {estadoCadastro.ok && <p className={styles.sucesso}>{estadoCadastro.ok}</p>}
          <button type="submit" className={styles.botao} disabled={enviandoCadastro}>
            {enviandoCadastro ? 'Cadastrando...' : 'Criar conta'}
          </button>
          <button type="button" className={styles.link} onClick={() => setAba('equipe')}>
            Já tenho conta: entrar
          </button>
        </form>
      )}
    </div>
  )
}
