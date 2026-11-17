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

export interface Voucher {
  id: string
  codigo: string
  tipo: 'percentual' | 'valor' | 'acesso' | 'livre'
  percentual: number
  valor_centavos: number
  limite_usos: number
  usos: number
  validade: string
  email_destino: string
  descricao: string
  ativo: boolean
  cursos_titulos: string[]
}

// ---- conteúdo (montagem do curso) ----
export interface AulaConteudo {
  id: string
  slug: string
  numero: string
  titulo: string
  descricao: string
  ordem: number
  duracao_seg: number
  publicado: boolean
  amostra: boolean
  pergunta_fixacao: string
  material_url: string
  video_id: string
  video_pronto: boolean
  tem_aluno: boolean
}

export interface ParteConteudo {
  id: string
  slug: string
  titulo: string
  rotulo: string
  resumo: string
  ordem: number
  publicado: boolean
}

export interface CertificadoConfig {
  cert_ativo: boolean
  cert_titulo: string
  cert_texto: string
  cert_carga_horas: number
  cert_assinante_nome: string
  cert_assinante_cargo: string
  cert_cidade: string
}

export interface ModuloConteudo {
  id: string
  slug: string
  titulo: string
  ordem: number
  carga_horas?: number
  cert_conteudo?: string
  parte?: string
  aulas: AulaConteudo[]
}

export interface CursoConteudo extends CertificadoConfig {
  id: string
  slug: string
  titulo: string
  publicado: boolean
  carga_min: number
  produto_slug: string
  partes: ParteConteudo[]
  modulos: ModuloConteudo[]
}

export interface ProgressoCurso {
  curso: { slug: string; titulo: string }
  total: number
  concluidas: number
  percentual: number
  aulas: { slug: string; concluida: boolean }[]
  certificado: { codigo: string; emitido_em: string } | null
  pode_certificar: boolean
}

export interface ProdutoAdmin {
  id: string
  slug: string
  titulo: string
  ativo: boolean
  preco_centavos: number
  moeda: string
  mp_link: string
  mp_link_obs: string
  curso_slug: string
  curso_titulo: string
  ordem: number
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

// Papel/email/nome ficam em cache junto com o token, porque o token NÃO os
// carrega. É conveniência de exibição — o servidor reconfere em cada chamada.
const CHAVE_PERFIL = 'ead_perfil'

interface PerfilCache {
  email: string
  name: string
  papel: Papel
}

function lerCache(): PerfilCache | null {
  try {
    const bruto = localStorage.getItem(CHAVE_PERFIL)
    return bruto ? (JSON.parse(bruto) as PerfilCache) : null
  } catch {
    return null
  }
}

export function guardarPerfil(u: { email?: string; name?: string; papel?: Papel }) {
  try {
    localStorage.setItem(
      CHAVE_PERFIL,
      JSON.stringify({
        email: u.email ?? '',
        name: u.name ?? '',
        papel: (u.papel as Papel) || 'aluno',
      }),
    )
  } catch {
    /* sem storage: a sessão vive só nesta aba, sem papel lembrado */
  }
}

export function setToken(t: string) {
  try {
    if (t) localStorage.setItem(CHAVE_TOKEN, t)
    else localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* modo privado sem storage: a sessão vive só nesta aba */
  }
  // AVISA as telas (defeito real, 15/11 20:45):
  // o login gravava o token e navegava, mas `useSessao` só lia o token no
  // primeiro render. Resultado: a pessoa entrava e continuava vendo
  // "Entre para ver os seus cursos" — loop de login. O evento `ead:sessao` já
  // era escutado pelo hook e nunca era disparado; agora é disparado aqui, no
  // único lugar que muda o token.
  try {
    window.dispatchEvent(new Event('ead:sessao'))
  } catch {
    /* ambiente sem window (SSR/teste): nada a avisar */
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
  // ---- quem sou eu, segundo o SERVIDOR ----
  // POR QUE ISSO EXISTE (defeito real, 16/11 21:20):
  // o token do PocketBase carrega só {collectionId, exp, id, refreshable, type}
  // — NÃO carrega `papel`, `email` nem `name`. A versão anterior do painel
  // deduzia o papel de dentro do token, então `papel` saía sempre vazio,
  // caía no padrão 'aluno' e o link "Painel" nunca aparecia — nem para o dono,
  // que era admin no banco.
  // Aqui o papel vem do registro no servidor, que é a única fonte de verdade.
  // A tela pode usar isso para MOSTRAR; quem BARRA continua sendo o hook.
  async meuPerfil(): Promise<{ id: string; email: string; name: string; papel: Papel }> {
    const r = await pedir<any>('/api/collections/users/auth-refresh', { method: 'POST' })
    return normalizarUser(r.record)
  },

  // ---- redefinir senha (link do e-mail) ----
  // O token vem na URL do e-mail ({RESET_URL}) e é de uso único.
  async confirmarNovaSenha(token: string, senha: string, confirmacao: string): Promise<void> {
    await pedir('/api/collections/users/confirm-password-reset', {
      method: 'POST',
      body: JSON.stringify({ token, password: senha, passwordConfirm: confirmacao }),
    })
  },

  // ---- login / cadastro ----
  async entrar(email: string, senha: string): Promise<Sessao> {
    const r = await pedir<{ token: string; record: any }>(
      '/api/collections/users/auth-with-password',
      { method: 'POST', body: JSON.stringify({ identity: email, password: senha }) },
    )
    const s: Sessao = { token: r.token, user: normalizarUser(r.record) }
    // Guarda o perfil ANTES de avisar as telas: o login já traz o registro
    // completo (com `papel`), então a tela acerta de primeira, sem esperar
    // uma segunda chamada.
    guardarPerfil(s.user)
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

  // Sessão montada a partir do token + papel que o SERVIDOR confirmou.
  // O token sozinho não basta: ele não tem `papel`. Sem o `papelDeCache`, a
  // tela saberia que há alguém logado, mas nunca que é administrador.
  sessaoAtual(): Sessao | null {
    const token = getToken()
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return {
        token,
        user: {
          id: payload.id,
          email: lerCache()?.email ?? '',
          name: lerCache()?.name ?? '',
          papel: lerCache()?.papel ?? 'aluno',
        },
      }
    } catch {
      return null
    }
  },

  sair() {
    setToken('')
    try {
      localStorage.removeItem(CHAVE_PERFIL)
    } catch {
      /* nada a limpar */
    }
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

  // ---- preço e link de pagamento ----
  async adminProdutos(): Promise<{ total: number; produtos: ProdutoAdmin[] }> {
    return pedir('/backend/v1/admin/produtos')
  },

  async adminSalvarProduto(dados: {
    id: string
    preco_reais?: string
    mp_link?: string
    mp_link_obs?: string
    ativo?: boolean
  }) {
    return pedir<{ ok: boolean; mensagem?: string; preco_centavos: number; ativo: boolean }>(
      '/backend/v1/admin/produto',
      { method: 'POST', body: JSON.stringify(dados) },
    )
  },

  // ---- status do pedido (tela de obrigado) ----
  // Só LÊ o status. Quem libera o acesso é o webhook / a reconciliação —
  // se esta rota liberasse, bastaria abrir a URL com um id para ganhar o curso.
  async statusPedido(pedidoId: string): Promise<{ status: string; pagamento: string }> {
    return pedir(`/backend/v1/pedido/${encodeURIComponent(pedidoId)}/status`)
  },

  // ---- vouchers (aluno) ----
  async resgatarVoucher(codigo: string, cursoSlug?: string) {
    return pedir<{ ok: boolean; mensagem?: string; cursos?: string[]; area?: string }>(
      '/backend/v1/voucher/resgatar',
      { method: 'POST', body: JSON.stringify({ codigo, curso_slug: cursoSlug }) },
    )
  },

  // ---- progresso do aluno ----
  async progressoCurso(cursoSlug: string): Promise<ProgressoCurso> {
    return pedir(`/backend/v1/curso/${encodeURIComponent(cursoSlug)}/progresso`)
  },

  async concluirAula(aulaSlug: string): Promise<{ ok: boolean; percentual: number }> {
    return pedir(`/backend/v1/aula/${encodeURIComponent(aulaSlug)}/concluir`, { method: 'POST' })
  },

  // ---- certificado ----
  async emitirCertificado(cursoSlug: string) {
    return pedir<{
      ok: boolean
      ja_emitido?: boolean
      codigo: string
      emitido_em: string
      titulo?: string
    }>(`/backend/v1/curso/${encodeURIComponent(cursoSlug)}/certificado`, { method: 'POST' })
  },

  // Público: qualquer pessoa com o código confere (sem login).
  async verificarCertificado(codigo: string) {
    return pedir<{
      valido: boolean
      codigo: string
      nome_aluno: string
      titulo_curso: string
      carga_horas: number
      assinante_nome: string
      assinante_cargo: string
      emitido_em: string
    }>(`/backend/v1/certificado/${encodeURIComponent(codigo)}`)
  },

  // ---- admin: capítulo e certificado ----
  async adminSalvarParte(dados: {
    id?: string
    curso_slug?: string
    titulo: string
    rotulo?: string
    resumo?: string
    publicado?: boolean
  }) {
    return pedir<{ ok: boolean; id: string; rotulo: string; mensagem?: string }>(
      '/backend/v1/admin/parte',
      { method: 'POST', body: JSON.stringify(dados) },
    )
  },

  async adminSalvarCertificado(dados: {
    curso_slug: string
    cert_ativo: boolean
    cert_titulo?: string
    cert_texto?: string
    cert_carga_horas?: number
    cert_assinante_nome?: string
    cert_assinante_cargo?: string
    cert_cidade?: string
  }) {
    return pedir<{ ok: boolean; cert_ativo: boolean; mensagem?: string }>(
      '/backend/v1/admin/curso/certificado',
      { method: 'POST', body: JSON.stringify(dados) },
    )
  },

  // ---- conteúdo do curso (admin) ----
  async adminConteudo(): Promise<{ total: number; cursos: CursoConteudo[] }> {
    return pedir('/backend/v1/admin/conteudo')
  },

  // ---- criar / editar CURSO (pedido do dono, 17/11) ----
  // Slug do curso é gerado no servidor a partir do título: slug digitado à mão
  // colide e vira URL de venda que não pode mais mudar.
  async adminSalvarCurso(dados: {
    id?: string
    titulo: string
    prefixo?: string
    resumo_1linha?: string
    descricao?: string
    resultado_esperado?: string
    carga_min?: number
    cert_carga_horas?: number
    criar_produto?: boolean
    preco_reais?: string
    publicado?: boolean
  }) {
    return pedir<{
      ok: boolean
      id: string
      slug: string
      titulo: string
      publicado: boolean
      produto?: { slug: string; ativo: boolean; preco_centavos: number } | null
      mensagem?: string
    }>('/backend/v1/admin/curso', { method: 'POST', body: JSON.stringify(dados) })
  },

  async adminSalvarModulo(dados: {
    id?: string
    curso_slug?: string
    titulo: string
    ordem?: number
  }) {
    return pedir<{ ok: boolean; id: string; slug: string; mensagem?: string }>(
      '/backend/v1/admin/modulo',
      { method: 'POST', body: JSON.stringify(dados) },
    )
  },

  async adminSalvarAula(dados: {
    id?: string
    modulo_id?: string
    titulo: string
    descricao?: string
    numero?: string
    video_url?: string
    material_url?: string
    pergunta_fixacao?: string
    duracao_min?: number
    publicado?: boolean
    amostra?: boolean
    ordem?: number
  }) {
    return pedir<{ ok: boolean; id: string; slug: string; numero: string; mensagem?: string }>(
      '/backend/v1/admin/aula',
      { method: 'POST', body: JSON.stringify(dados) },
    )
  },

  async adminExcluirAula(id: string) {
    return pedir<{ ok: boolean; apenas_despublicada?: boolean; mensagem?: string }>(
      '/backend/v1/admin/aula/excluir',
      { method: 'POST', body: JSON.stringify({ id }) },
    )
  },

  // ---- vouchers (admin) ----
  async adminVouchers(): Promise<{ total: number; vouchers: Voucher[] }> {
    return pedir('/backend/v1/admin/vouchers')
  },

  async adminCriarVoucher(dados: {
    tipo: string
    codigo?: string
    cursos?: string[]
    percentual?: number
    valor_reais?: string
    limite_usos?: number
    validade?: string
    email_destino?: string
    descricao?: string
  }) {
    return pedir<{ ok: boolean; codigo: string; mensagem?: string }>('/backend/v1/admin/voucher', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },

  async adminVoucherStatus(dados: { id: string; ativo: boolean }) {
    return pedir<{ ok: boolean; ativo: boolean; mensagem?: string }>(
      '/backend/v1/admin/voucher/status',
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
