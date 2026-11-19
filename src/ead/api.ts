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
  // Só sinaliza que existe PDF; o link sai por /material, que checa matrícula.
  tem_material?: boolean
}

// ---- LOTE 2: fluxo do presente (convite, diagnóstico, pré-diagnóstico) ----
export interface Presente {
  nome_lead: string
  email_destino: string
  recado: string
  curso: { titulo: string; capa: string; modulos: number; aulas: number }
  so_este_email: boolean
}

export interface Dor {
  id: string
  nome: string
}

export interface DiagnosticoDados {
  tipo_operacao: string
  controle_atual: string
  dores: string[]
  papel: string
  porte: string
  aceite_contato: boolean
  aceite_contato_em: string
  aceite_texto_versao: string
}

export interface DiagnosticoResposta {
  existe: boolean
  curso: string
  diagnostico?: DiagnosticoDados
  dores: Dor[]
}

export interface PreDiagnosticoSnapshot {
  perfil: {
    tipo_operacao: string
    controle_atual: string
    papel: string
    porte: string
    dores: string[]
  }
  nivel: { valor: number; texto: string }
  pontos_de_atencao: Array<{
    dor: string
    texto: string
    aula_base: {
      slug: string
      titulo: string
      numero: string
      porta_entrada: boolean
      concluida: boolean
    } | null
  }>
  proximo_passo: string
  momento: string
  prazo: string
  montado_em: string
}

export interface PreDiagnostico {
  codigo: string
  momento: string
  prazo: string
  nivel: number
  snapshot: PreDiagnosticoSnapshot
  enviar_anotacoes: boolean
  aprofundamento_em: string
}

export interface CursoEmBreve {
  id: string
  slug: string
  titulo: string
  descricao_curta: string
  aulas_previstas: number
  status: string
}

// Módulo na vitrine do convite: só título e contagem, sem aula nem slug.
export interface ModuloPresente {
  id: string
  titulo: string
  ordem: number
  aulas: number
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

  // ---- LOTE 2: matrículas do aluno ----
  // A coleção `matriculas` tem listRule por usuário, então o próprio aluno lê.
  // Usado pela Minha área para saber qual curso abrir.
  async minhasMatriculas(): Promise<Array<{ id: string; curso_slug: string; status: string }>> {
    const r = await pedir<{
      items: Array<{ id: string; status: string; expand?: { curso?: { slug: string } } }>
    }>(
      '/api/collections/matriculas/records?perPage=20&sort=-created&expand=curso&filter=' +
        encodeURIComponent(`status='ativa'`),
    )
    return (r.items ?? [])
      .map((m) => ({
        id: m.id,
        status: m.status,
        curso_slug: m.expand?.curso?.slug ?? '',
      }))
      .filter((m) => !!m.curso_slug)
  },

  // Lê o perfil gravado no login (sem chamada de rede).
  async carregarPerfil(): Promise<{ name?: string; email?: string } | null> {
    try {
      const cru = localStorage.getItem('ead_perfil')
      return cru ? JSON.parse(cru) : null
    } catch {
      return null
    }
  },

  // ---- LOTE 2: apoio ao player ----

  // Descobre o curso de uma aula. Usado quando o servidor responde 409
  // diagnostico_pendente: a tela precisa saber PARA ONDE mandar o aluno.
  async aulaCursoSlug(aulaSlug: string): Promise<string> {
    // A aula carrega `modulo`; o módulo carrega `curso`. Duas consultas, mas
    // nenhuma rota nova: as coleções são públicas para quem está logado.
    const a = await pedir<{ items: Array<{ modulo: string }> }>(
      '/api/collections/aulas/records?perPage=1&fields=modulo&filter=' +
        encodeURIComponent(`slug='${aulaSlug.replace(/'/g, '')}'`),
    )
    const moduloId = a.items?.[0]?.modulo
    if (!moduloId) throw new Error('aula sem módulo')
    const m = await pedir<{ items: Array<{ curso: string }> }>(
      `/api/collections/modulos/records?perPage=1&fields=curso&filter=${encodeURIComponent(`id='${moduloId}'`)}`,
    )
    const cursoId = m.items?.[0]?.curso
    if (!cursoId) throw new Error('módulo sem curso')
    const c = await pedir<{ items: Array<{ slug: string }> }>(
      `/api/collections/cursos/records?perPage=1&fields=slug&filter=${encodeURIComponent(`id='${cursoId}'`)}`,
    )
    const s = c.items?.[0]?.slug
    if (!s) throw new Error('curso sem slug')
    return s
  },

  // Aulas e módulos do curso da aula, com a posição salva desta aula.
  async aulasDoModulo(aulaSlug: string): Promise<{
    aulas: Aula[]
    modulos: Modulo[]
    posicao_seg: number
  }> {
    const cursoSlug = await api.aulaCursoSlug(aulaSlug)
    const curso = await api.cursoPorSlug(cursoSlug)
    if (!curso) return { aulas: [], modulos: [], posicao_seg: 0 }
    const { modulos } = await api.estruturaDoCurso(curso.id)
    const todas = await pedir<{ items: Aula[] }>(
      '/api/collections/aulas/records?perPage=500&sort=ordem&filter=' +
        encodeURIComponent('publicado=true'),
    )
    const ids = new Set(modulos.map((m) => m.id))
    const aulas = (todas.items ?? []).filter((a) => ids.has(a.modulo))
    let posicao_seg = 0
    try {
      const p = await pedir<{ items: Array<{ posicao_seg: number }> }>(
        '/api/collections/progresso_aulas/records?perPage=1&fields=posicao_seg&filter=' +
          encodeURIComponent(`aula.slug='${aulaSlug.replace(/'/g, '')}'`),
      )
      posicao_seg = Number(p.items?.[0]?.posicao_seg ?? 0) || 0
    } catch {
      /* sem progresso anterior */
    }
    return { aulas, modulos, posicao_seg }
  },

  // Quantas anotações o aluno tem no curso (a tela de conclusão mostra
  // "você respondeu N das M perguntas").
  async contarAnotacoes(cursoSlug: string): Promise<{ total: number }> {
    try {
      const curso = await api.cursoPorSlug(cursoSlug)
      if (!curso) return { total: 0 }
      const { modulos } = await api.estruturaDoCurso(curso.id)
      const ids = new Set(modulos.map((m) => m.id))
      const aulas = await pedir<{ items: Array<{ id: string; modulo: string }> }>(
        '/api/collections/aulas/records?perPage=500&fields=id,modulo&filter=' +
          encodeURIComponent('publicado=true'),
      )
      const doCurso = new Set((aulas.items ?? []).filter((a) => ids.has(a.modulo)).map((a) => a.id))
      const resp = await pedir<{ items: Array<{ aula: string }> }>(
        '/api/collections/respostas_fixacao/records?perPage=500&fields=aula',
      )
      const total = (resp.items ?? []).filter((r) => doCurso.has(r.aula)).length
      return { total }
    } catch {
      return { total: 0 }
    }
  },

  // Anotações do curso com a pergunta de cada aula (para o PDF).
  async anotacoesDoCurso(cursoSlug: string): Promise<{
    curso_titulo: string
    anotacoes: Array<{ numero: string; titulo: string; pergunta: string; resposta: string }>
  }> {
    const curso = await api.cursoPorSlug(cursoSlug)
    if (!curso) return { curso_titulo: '', anotacoes: [] }
    const { modulos } = await api.estruturaDoCurso(curso.id)
    const ids = new Set(modulos.map((m) => m.id))
    const todas = await pedir<{
      items: Array<{
        id: string
        modulo: string
        numero: string
        titulo: string
        pergunta_fixacao: string
        ordem: number
      }>
    }>(
      '/api/collections/aulas/records?perPage=500&sort=ordem&filter=' +
        encodeURIComponent('publicado=true'),
    )
    const doCurso = new Map(
      (todas.items ?? []).filter((a) => ids.has(a.modulo)).map((a) => [a.id, a] as const),
    )
    const resp = await pedir<{ items: Array<{ aula: string; texto: string }> }>(
      '/api/collections/respostas_fixacao/records?perPage=500',
    )
    const anotacoes = (resp.items ?? [])
      .filter((r) => doCurso.has(r.aula))
      .map((r) => {
        const a = doCurso.get(r.aula)!
        return {
          numero: a.numero,
          titulo: a.titulo,
          pergunta: a.pergunta_fixacao || '',
          resposta: r.texto,
        }
      })
      .sort(
        (x, y) =>
          Number(
            doCurso.get(
              (resp.items ?? []).find((i) => doCurso.get(i.aula)?.numero === x.numero)?.aula || '',
            )?.ordem ?? 0,
          ) - 0,
      )
    return { curso_titulo: curso.titulo, anotacoes }
  },

  // Resposta do "Para fixar" já salva.
  async minhaRespostaFixacao(aulaSlug: string): Promise<{ texto: string } | null> {
    try {
      const r = await pedir<{ items: Array<{ texto: string }> }>(
        '/api/collections/respostas_fixacao/records?perPage=1&fields=texto&filter=' +
          encodeURIComponent(`aula.slug='${aulaSlug.replace(/'/g, '')}'`),
      )
      return r.items?.[0] ?? null
    } catch {
      return null
    }
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
      // A rubrica NÃO vem mais daqui (item 14 do lote 1): a validação pública
      // mostra os dados do certificado e só sinaliza que existe assinatura.
      tem_assinatura?: boolean
      emitido_em: string
    }>(`/backend/v1/certificado/${encodeURIComponent(codigo)}`)
  },

  // Imagem da rubrica para um certificado emitido.
  // Endpoint próprio que confere o certificado — a coleção `rubricas` é fechada
  // e o arquivo em `cursos` foi limpo pela migration 0061.
  async rubricaDoCertificado(codigo: string): Promise<Blob | null> {
    try {
      const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''
      const r = await fetch(
        `${base}/backend/v1/certificado/${encodeURIComponent(codigo)}/rubrica`,
        { headers: getToken() ? { Authorization: getToken() } : {} },
      )
      if (!r.ok) return null
      return await r.blob()
    } catch {
      return null
    }
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
  // TEMPORÁRIO (19/11): lê o IP que o servidor vê. Existe para o dono provar
  // que o limitador distingue pessoas, chamando de duas redes. Sai junto com o
  // cartão DiagnosticoIp e com o endpoint diag-ip.pb.js.
  async diagIp(): Promise<{
    ip_visto: string
    ip_hash_curto: string
    cabecalhos_recebidos: { 'x-forwarded-for': string; 'x-real-ip': string }
    trusted_proxy: { ativo: boolean; headers: string; efeito: string }
  }> {
    return pedir('/backend/v1/diag/ip')
  },

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

// ---- LOTE 2: rotas do fluxo do presente ----
// Fica FORA do objeto `api` de propósito: são rotas novas do lote 2 e mantê-las
// separadas deixa claro o que é do fluxo antigo e o que é do convite.
export const apiLote2 = {
  async pedirCodigo(nome: string, email: string): Promise<{ otpId: string }> {
    return pedir('/backend/v1/ead/entrar/codigo', {
      method: 'POST',
      body: JSON.stringify({ nome, email }),
    })
  },

  async presente(codigo: string): Promise<Presente> {
    return pedir(`/backend/v1/ead/presente/${encodeURIComponent(codigo)}`)
  },

  // Módulos e contagem de aulas para a vitrine do convite (rota pública).
  // URL SEM aninhamento de propósito: `/presente/{codigo}/estrutura` era
  // capturada pelo handler de `/presente/{codigo}` e dava 404 sempre
  // (confirmado no log de requests). Ver o comentário do hook.
  async estruturaPresente(codigo: string): Promise<{ modulos: ModuloPresente[] }> {
    return pedir(`/backend/v1/ead/presente-estrutura/${encodeURIComponent(codigo)}`)
  },

  async resgatarPresente(
    codigo: string,
  ): Promise<{ ok: boolean; ja_tinha: boolean; curso: { slug: string; titulo: string } }> {
    return pedir(`/backend/v1/ead/presente/${encodeURIComponent(codigo)}/resgatar`, {
      method: 'POST',
    })
  },

  async diagnostico(cursoSlug: string): Promise<DiagnosticoResposta> {
    return pedir(`/backend/v1/ead/diagnostico?curso=${encodeURIComponent(cursoSlug)}`)
  },

  async salvarDiagnostico(dados: {
    curso: string
    tipo_operacao: string
    controle_atual: string
    dores: string[]
    papel?: string
    porte?: string
    aceite_contato?: boolean
    aceite_texto_versao?: string
  }): Promise<{ ok: boolean; novo: boolean }> {
    return pedir('/backend/v1/ead/diagnostico', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },

  async dores(cursoSlug: string): Promise<{ total: number; dores: Dor[] }> {
    return pedir(`/backend/v1/ead/dores?curso=${encodeURIComponent(cursoSlug)}`)
  },

  // Aula recomendada para uma dor no curso (o aviso laranja do diagnóstico).
  async aulaDaDor(
    dorId: string,
    cursoSlug: string,
  ): Promise<{
    encontrada: boolean
    dor: string
    mensagem?: string
    aula?: { slug: string; numero: string; titulo: string; modulo: string; porta_entrada: boolean }
  }> {
    return pedir(
      `/backend/v1/ead/dores/${encodeURIComponent(dorId)}/aula?curso=${encodeURIComponent(cursoSlug)}`,
    )
  },

  async salvarFixacao(aulaSlug: string, texto: string): Promise<{ ok: boolean; novo: boolean }> {
    return pedir('/backend/v1/ead/resposta-fixacao', {
      method: 'POST',
      body: JSON.stringify({ aula: aulaSlug, texto }),
    })
  },

  async prediagnostico(
    cursoSlug: string,
  ): Promise<{ existe: boolean; curso: string; prediagnostico?: PreDiagnostico }> {
    return pedir(`/backend/v1/ead/prediagnostico?curso=${encodeURIComponent(cursoSlug)}`)
  },

  async montarPrediagnostico(dados: {
    curso: string
    momento: string
    prazo: string
  }): Promise<{ ok: boolean; codigo: string; nivel: number; snapshot: PreDiagnosticoSnapshot }> {
    return pedir('/backend/v1/ead/prediagnostico', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },

  async aprofundar(
    codigo: string,
    enviarAnotacoes: boolean,
  ): Promise<{ ok: boolean; url: string }> {
    return pedir(`/backend/v1/ead/prediagnostico/${encodeURIComponent(codigo)}/aprofundar`, {
      method: 'POST',
      body: JSON.stringify({ enviar_anotacoes: enviarAnotacoes }),
    })
  },

  async avisarLancamento(slug: string): Promise<{ ok: boolean; ja_avisado: boolean }> {
    return pedir(`/backend/v1/ead/cursos/${encodeURIComponent(slug)}/avisar`, { method: 'POST' })
  },

  async cursosEmBreve(): Promise<CursoEmBreve[]> {
    const r = await pedir<{ items: CursoEmBreve[] }>(
      '/api/collections/cursos/records?perPage=20&sort=ordem&filter=' +
        encodeURIComponent('status="em_breve"'),
    )
    return r.items ?? []
  },

  async adminPresentes(): Promise<{
    total: number
    presentes: Array<Record<string, unknown>>
    media_dias_ate_aprofundamento: number | null
  }> {
    return pedir('/backend/v1/ead/admin/presentes')
  },

  // Cria o convite pessoal (comando 3, item 1). O código é gerado no servidor.
  async adminCriarConvite(dados: {
    nome_lead: string
    empresa: string
    email_destino: string
    whatsapp_lead: string
    curso_slug: string
    responsavel: string
    recado: string
    so_este_email: boolean
  }): Promise<{
    ok: boolean
    codigo: string
    link: string
    curso: { slug: string; titulo: string }
  }> {
    return pedir('/backend/v1/ead/admin/presente', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },

  // ---- comando 3, item 2: conteúdo ----
  // Dores ativas com contagem de aulas (para o catálogo e os chips da aula).
  async adminDores(): Promise<{
    dores: Array<{ id: string; nome: string; ativo: boolean; texto: string; aulas: number }>
  }> {
    return pedir('/backend/v1/ead/admin/dores')
  },

  async adminSalvarDor(dados: {
    id?: string
    nome: string
    ativo: boolean
    texto_prediagnostico: string
  }): Promise<{ ok: boolean; id: string }> {
    return pedir('/backend/v1/ead/admin/dores', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },

  // Dores marcadas numa aula + qual é a porta de entrada.
  async adminAulaDores(aulaId: string): Promise<{
    dores: string[]
    porta_entrada: string
  }> {
    return pedir(`/backend/v1/ead/admin/aula-dores?aula=${encodeURIComponent(aulaId)}`)
  },

  async adminSalvarAulaDores(dados: {
    aula: string
    dores: string[]
    porta_entrada: string
  }): Promise<{ ok: boolean }> {
    return pedir('/backend/v1/ead/admin/aula-dores', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  },

  async adminPrediagnostico(codigo: string): Promise<Record<string, unknown>> {
    return pedir(`/backend/v1/ead/admin/prediagnostico/${encodeURIComponent(codigo)}`)
  },
}

// Entrada por código (OTP) — usada pelo CartaoAcesso no convite e em /ead/entrar.
//
// POR QUE AQUI E NÃO CHAMANDO A API DO POCKETBASE DIRETO NA TELA: este é o único
// lugar que grava o token e dispara `ead:sessao`. Se a tela gravasse o token por
// conta própria, o hook de sessão não acordaria e a pessoa entraria continuando
// "deslogada" — foi o defeito que o comentário de setToken() descreve.
export async function authWithCodigo(otpId: string, codigo: string): Promise<Sessao> {
  const r = await pedir<{ token: string; record: any }>('/api/collections/users/auth-with-otp', {
    method: 'POST',
    body: JSON.stringify({ otpId, password: codigo }),
  })
  const s: Sessao = { token: r.token, user: normalizarUser(r.record) }
  guardarPerfil(s.user)
  setToken(r.token)
  return s
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
