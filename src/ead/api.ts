// src/ead/api.ts — cliente único das telas do EAD.
// Nenhuma tela monta URL na mão: quando o backend mudar, muda um arquivo só.
// Nada de segredo aqui: este arquivo vai para o navegador.
// BASE = "" porque o Skip Cloud serve /backend/v1 e /api na mesma origem.

const BASE = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''
const CHAVE_TOKEN = 'ead_token'

export type Papel = 'aluno' | 'admin' | 'suporte'

export interface Sessao {
  token: string
  user: { id: string; email: string; name: string; papel: Papel }
}

export interface Curso {
  id: string
  slug: string
  titulo: string
  resumo_1linha?: string
  resultado_esperado?: string
  descricao?: string
  carga_min?: number
  capa?: string
  publicado?: boolean
  ordem?: number
}

export interface Aula {
  id: string
  slug: string
  titulo: string
  numero: string
  ordem: number
  duracao_seg?: number
  publicado?: boolean
  amostra?: boolean
  modulo: string
  material?: string
  pergunta_fixacao?: string
}

export interface Modulo {
  id: string
  curso: string
  titulo: string
  ordem: number
  slug?: string
}

export interface Produto {
  id: string
  slug: string
  titulo: string
  descricao?: string
  preco_centavos: number // 0 = preço não definido
  moeda: string
  cursos: string[]
  capa?: string
  ativo: boolean
  ordem?: number
}

export interface Playback {
  aula: { id?: string; slug: string; titulo: string; numero: string }
  player: string
  expira_em: number
  material?: string
  pergunta_fixacao?: string
  tipo_acesso: 'matricula' | 'amostra'
}

// ---- painel do administrador ----
export interface Config {
  id?: string
  liberado: boolean
  titulo_area?: string
  aviso_rascunho?: string
  instrucoes_compra?: string
  email_suporte?: string
  atualizado_em?: string
}

export interface AlunoMatricula {
  id: string
  email: string
  nome: string
  curso_slug: string
  curso_titulo: string
  status: string
  origem: string
  expira_em: string
  criado_em: string
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

export function getToken(): string {
  try {
    return localStorage.getItem(CHAVE_TOKEN) ?? ''
  } catch {
    return ''
  }
}

export function setToken(t: string) {
  try {
    if (t) localStorage.setItem(CHAVE_TOKEN, t)
    else localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* modo privado sem storage: a sessão vive só nesta aba */
  }
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (init.body) headers['Content-Type'] = 'application/json'
  // PocketBase espera o token CRU, sem "Bearer".
  if (token) headers['Authorization'] = token

  const resp = await fetch(BASE + caminho, { ...init, headers })
  const texto = await resp.text()
  let corpo: any = {}
  try {
    corpo = texto ? JSON.parse(texto) : {}
  } catch {
    corpo = { message: texto }
  }
  if (!resp.ok) {
    throw new ErroApi(
      resp.status,
      corpo.codigo ?? corpo?.data?.codigo ?? 'erro',
      corpo.mensagem ?? corpo.message ?? 'Não foi possível completar.',
    )
  }
  return corpo as T
}

export const api = {
  // ---- login / cadastro ----
  async entrar(email: string, senha: string): Promise<Sessao> {
    const r = await pedir<{ token: string; record: any }>(
      '/api/collections/users/auth-with-password',
      { method: 'POST', body: JSON.stringify({ identity: email, password: senha }) },
    )
    const s: Sessao = { token: r.token, user: normalizarUser(r.record) }
    setToken(r.token)
    return s
  },

  async cadastrar(nome: string, email: string, senha: string): Promise<void> {
    // `papel` NÃO é enviado: o servidor força "aluno".
    await pedir('/api/collections/users/records', {
      method: 'POST',
      body: JSON.stringify({ name: nome, email, password: senha, passwordConfirm: senha }),
    })
  },

  // Resposta sempre igual, exista ou não a conta (não revela quem é cliente).
  async recuperarSenha(email: string): Promise<void> {
    await pedir('/api/collections/users/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  sessaoAtual(): Sessao | null {
    const token = getToken()
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return {
        token,
        user: {
          id: payload.id,
          email: payload.email ?? '',
          name: payload.name ?? '',
          papel: payload.papel || 'aluno',
        },
      }
    } catch {
      return null
    }
  },

  sair() {
    setToken('')
  },

  // ---- catálogo ----
  async produtos(): Promise<Produto[]> {
    const r = await pedir<{ items: Produto[] }>(
      '/api/collections/produtos/records?perPage=50&sort=ordem&expand=cursos',
    )
    return r.items ?? []
  },

  // ---- página do curso ----
  async cursoPorSlug(slug: string): Promise<Curso | null> {
    const r = await pedir<{ items: Curso[] }>(
      `/api/collections/cursos/records?filter=${encodeURIComponent(`slug='${slug.replace(/'/g, '')}'`)}&perPage=1`,
    )
    return r.items?.[0] ?? null
  },

  async estruturaDoCurso(cursoId: string): Promise<{ modulos: Modulo[]; aulas: Aula[] }> {
    const mods = await pedir<{ items: Modulo[] }>(
      `/api/collections/modulos/records?perPage=200&sort=ordem&filter=${encodeURIComponent(`curso='${cursoId}'`)}`,
    )
    const aulas = await pedir<{ items: Aula[] }>(
      '/api/collections/aulas/records?perPage=500&sort=ordem&filter=' +
        encodeURIComponent('publicado=true'),
    )
    return { modulos: mods.items ?? [], aulas: aulas.items ?? [] }
  },

  // ---- player ----
  // Amostra e sem login abre pelo endpoint público; o resto exige login.
  async playback(slug: string, amostra: boolean): Promise<Playback> {
    if (amostra && !getToken()) {
      return pedir<Playback>(`/backend/v1/aulas/${encodeURIComponent(slug)}/playback-publico`, {
        method: 'GET',
      })
    }
    return pedir<Playback>(`/backend/v1/aulas/${encodeURIComponent(slug)}/playback`, {
      method: 'POST',
    })
  },

  // ---- compra ----
  // O valor é decidido no servidor. Aqui só mandamos produto + quem compra.
  async iniciarCheckout(
    produtoSlug: string,
    nome: string,
    email: string,
  ): Promise<{ pedido: string; link: string }> {
    return pedir(`/backend/v1/checkout`, {
      method: 'POST',
      body: JSON.stringify({ produto_slug: produtoSlug, nome, email }),
    })
  },

  // ---- painel do administrador ----
  // Toda chamada aqui exige papel admin; o servidor responde 403 para os outros.
  async adminConfig(): Promise<Config> {
    return pedir<Config>('/backend/v1/admin/config')
  },

  async adminSalvarConfig(
    patch: Partial<Config>,
  ): Promise<{ ok: boolean; liberado: boolean; mensagem?: string }> {
    return pedir('/backend/v1/admin/config', { method: 'POST', body: JSON.stringify(patch) })
  },

  async adminAlunos(): Promise<{ total: number; alunos: AlunoMatricula[] }> {
    return pedir('/backend/v1/admin/alunos')
  },

  async adminLiberar(dados: { email: string; curso_slug: string; dias?: number }) {
    return pedir<{ ok: boolean; mensagem?: string; expira_em?: string }>(
      '/backend/v1/admin/matricula',
      { method: 'POST', body: JSON.stringify(dados) },
    )
  },

  async adminRevogar(dados: { email: string; curso_slug: string }) {
    return pedir<{ ok: boolean; mensagem?: string }>('/backend/v1/admin/matricula/revogar', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },
}

function normalizarUser(r: any): Sessao['user'] {
  return {
    id: r.id,
    email: r.email ?? '',
    name: r.name ?? '',
    papel: (r.papel as Papel) || 'aluno',
  }
}

// Centavos → "R$ 197,00". Preço 0 nunca vira "Grátis": é preço não definido.
export function precoBR(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function duracaoBR(seg?: number): string {
  if (!seg || seg <= 0) return '' // 0 = aula sem vídeo; nunca "0 min"
  const m = Math.round(seg / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`
}
