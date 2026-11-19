// Presentes.tsx — aba "Presentes" do painel (/ead/admin).
//
// COMANDO 3, ITEM 1. Três partes, na ordem do mockup:
//   1. Formulário "Presentear um lead"
//   2. Cartão "Convite pronto" (só depois de gerar)
//   3. Tabela "Convites enviados" + média de dias até o aprofundamento
//
// ── O QUE VEM DO SERVIDOR ─────────────────────────────────────────────────
// A tabela lê GET /backend/v1/ead/admin/presentes, que já aplica a regra de
// LGPD: sem aceite de contato e sem pedido de aprofundamento, dor e momento
// chegam como "sem autorização". A TELA NÃO DECIDE ISSO — se decidisse, bastava
// um erro de front para o dado vazar.
//
// ── "VER O QUE O LEAD VAI VER" ────────────────────────────────────────────
// Abre /presente/{codigo} numa aba nova. A prévia NÃO marca `aberto_em` porque
// o GET do convite só marca quando quem pede NÃO é admin — e ele está logado
// como admin. É o que o pedido exige, e o teste é: gerar, pré-visualizar,
// recarregar a tabela e ver a situação ainda em "Não abriu".
import { useCallback, useEffect, useState } from 'react'
import { apiLote2, ErroApi, getToken } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

type PresenteAdmin = {
  codigo: string
  nome_lead: string
  empresa: string
  enviado_em: string
  situacao: string
  maior_dor: string
  momento: string
  prazo: string
  aprofundamento_em: string
  dias_desde_envio: number | null
  dias_ate_aprofundar: number | null
  aceite_contato: boolean
}

export default function Presentes() {
  // ---- catálogos ----
  const [cursos, setCursos] = useState<Array<{ slug: string; titulo: string }>>([])
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([])

  // ---- formulário ----
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [curso, setCurso] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [recado, setRecado] = useState('')
  const [soEsteEmail, setSoEsteEmail] = useState(true)

  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState<{ codigo: string; link: string } | null>(null)

  // ---- tabela ----
  const [lista, setLista] = useState<PresenteAdmin[]>([])
  const [media, setMedia] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroLista('')
    try {
      const r = await apiLote2.adminPresentes()
      setLista((r.presentes as unknown as PresenteAdmin[]) ?? [])
      setMedia(r.media_dias_ate_aprofundamento ?? null)
    } catch (err) {
      if (err instanceof ErroApi && err.status === 403) {
        setErroLista('Só o administrador vê esta lista.')
      } else {
        setErroLista('Não foi possível carregar os convites.')
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    // cursos publicados, para o select
    ;(async () => {
      try {
        const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''
        const r = await fetch(
          `${base}/api/collections/cursos/records?perPage=50&sort=ordem&fields=slug,titulo`,
          { headers: { Authorization: getToken() } },
        )
        if (r.ok) {
          const d = await r.json()
          setCursos((d.items ?? []).filter((c: any) => c.slug))
        }
      } catch {
        /* o select vazio é visível; o erro fica no formulário */
      }
      // responsáveis: admins
      try {
        const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''
        const r = await fetch(
          `${base}/api/collections/users/records?perPage=20&fields=id,name&filter=` +
            encodeURIComponent('papel="admin"'),
          { headers: { Authorization: getToken() } },
        )
        if (r.ok) {
          const d = await r.json()
          setAdmins(d.items ?? [])
        }
      } catch {
        /* sem lista de responsáveis, o campo fica opcional */
      }
    })()
  }, [carregar])

  async function gerar() {
    setErro('')
    if (!nome.trim()) return setErro('Escreva o nome do lead.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return setErro('Confira o e-mail do lead.')
    if (!curso) return setErro('Escolha o curso do presente.')

    setGerando(true)
    try {
      const r = await apiLote2.adminCriarConvite({
        nome_lead: nome.trim(),
        empresa: empresa.trim(),
        email_destino: email.trim().toLowerCase(),
        whatsapp_lead: whatsapp.replace(/\D/g, ''),
        curso_slug: curso,
        responsavel,
        recado: recado.trim(),
        so_este_email: soEsteEmail,
      })
      setCriado({ codigo: r.codigo, link: r.link })
      // limpa o formulário, mantém o cartão
      setNome('')
      setEmpresa('')
      setEmail('')
      setWhatsapp('')
      setRecado('')
      await carregar()
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível gerar o convite agora.')
    } finally {
      setGerando(false)
    }
  }

  const link = criado?.link ?? ''
  const mensagemPronta = criado
    ? `Olá! Separei o curso "${cursos.find((c) => c.slug === curso)?.titulo ?? ''}" para você. É um presente, sem cartão e sem senha: ${link}`
    : ''

  return (
    <div className="space-y-10">
      {/* ---------------- formulário ---------------- */}
      <section>
        <h2 className="text-lg font-semibold">Presentear um lead</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gera um convite pessoal. O lead entra com um código no e-mail — sem senha e sem cartão.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome do lead" obrigatorio>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 h-11" />
          </Campo>
          <Campo rotulo="Empresa">
            <Input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="mt-1 h-11"
            />
          </Campo>
          <Campo rotulo="E-mail do lead" obrigatorio>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11"
            />
          </Campo>
          <Campo rotulo="WhatsApp" dica="Opcional. Habilita o botão de abrir no WhatsApp.">
            <Input
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 90000-0000"
              className="mt-1 h-11"
            />
          </Campo>
          <Campo rotulo="Curso" obrigatorio>
            <select
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Escolha o curso</option>
              {cursos.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Responsável comercial">
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Ninguém específico</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="mt-3">
          <Label htmlFor="recado">
            Recado pessoal <span className="text-xs text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="recado"
            value={recado}
            onChange={(e) => setRecado(e.target.value)}
            maxLength={500}
            className="mt-1 min-h-24"
            placeholder="Escreva como se estivesse falando com ele."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Aparece no topo do convite, com a sua foto. {recado.length}/500
          </p>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <Checkbox
            id="so-este"
            checked={soEsteEmail}
            onCheckedChange={(v) => setSoEsteEmail(v === true)}
            className="mt-0.5 h-5 w-5"
          />
          <Label htmlFor="so-este" className="text-sm font-normal">
            Válido só para este e-mail
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Se desmarcar, qualquer pessoa com o link pode usar o convite.
            </span>
          </Label>
        </div>

        {erro && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <Button className="mt-4 h-11" onClick={gerar} disabled={gerando}>
          {gerando ? 'Gerando…' : 'Gerar convite'}
        </Button>
      </section>

      {/* ---------------- convite pronto ---------------- */}
      {criado && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Convite pronto</h2>

          <div className="mt-3">
            <Label htmlFor="link-convite">Link pessoal</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Input id="link-convite" readOnly value={link} className="h-11 font-mono text-xs" />
              <Button
                variant="outline"
                className="h-11 shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  } catch {
                    /* clipboard bloqueado: o campo está selecionável */
                  }
                }}
              >
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="msg-convite">Mensagem pronta</Label>
            <Textarea
              id="msg-convite"
              readOnly
              value={mensagemPronta}
              className="mt-1 min-h-24 bg-background text-sm"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {whatsapp.replace(/\D/g, '') && (
              <Button asChild variant="outline" className="h-11">
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagemPronta)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no WhatsApp
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="h-11">
              <a
                href={`mailto:${email}?subject=${encodeURIComponent('Um curso separado para você')}&body=${encodeURIComponent(mensagemPronta)}`}
              >
                Enviar por e-mail
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <a href={link} target="_blank" rel="noopener noreferrer">
                Ver o que o lead vai ver
              </a>
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A prévia não marca o convite como aberto.
          </p>
        </section>
      )}

      {/* ---------------- tabela ---------------- */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Convites enviados</h2>
          {media !== null && (
            <p className="text-xs text-muted-foreground">
              Média de{' '}
              <strong>
                {media} dia{media === 1 ? '' : 's'}
              </strong>{' '}
              do convite ao pedido de aprofundamento
            </p>
          )}
        </div>

        {carregando ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : erroLista ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {erroLista}
          </p>
        ) : lista.length === 0 ? (
          <p className="mt-4 rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum convite enviado ainda. O primeiro aparece aqui.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2">Enviado</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Maior dor</th>
                  <th className="px-3 py-2">Momento</th>
                  <th className="px-3 py-2">Aprofundamento</th>
                  <th className="px-3 py-2">Contato</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.codigo} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-medium">{p.nome_lead || '—'}</span>
                      {p.empresa && (
                        <span className="block text-xs text-muted-foreground">{p.empresa}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {dataBR(p.enviado_em)}
                    </td>
                    <td className="px-3 py-2">
                      <Pilula situacao={p.situacao} />
                    </td>
                    <td className="px-3 py-2 text-xs">{p.maior_dor || '—'}</td>
                    <td className="px-3 py-2 text-xs">{p.momento || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.aprofundamento_em ? (
                        <a
                          href={`/ead/admin/prediagnostico/${p.codigo}`}
                          className="underline"
                          title="Abrir o pré-diagnóstico"
                        >
                          {dataBR(p.aprofundamento_em)}
                          {p.dias_ate_aprofundar !== null && (
                            <span className="block text-muted-foreground">
                              {p.dias_ate_aprofundar}d após o envio
                            </span>
                          )}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {p.aceite_contato ? 'Autorizou' : 'Sem autorização'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Campo({
  rotulo,
  dica,
  obrigatorio,
  children,
}: {
  rotulo: string
  dica?: string
  obrigatorio?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <Label>
        {rotulo}{' '}
        {obrigatorio ? (
          <span className="text-red-600" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">(opcional)</span>
        )}
      </Label>
      {children}
      {dica && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

function Pilula({ situacao }: { situacao: string }) {
  const s = situacao || 'nao_abriu'
  let cor = 'bg-muted text-foreground/70'
  let texto = 'Não abriu'
  if (s === 'abriu') {
    cor = 'bg-blue-100 text-blue-900'
    texto = 'Abriu'
  } else if (s === 'entrou') {
    cor = 'bg-amber-100 text-amber-900'
    texto = 'Entrou'
  } else if (s === 'diagnostico') {
    cor = 'bg-violet-100 text-violet-900'
    texto = 'Respondeu o diagnóstico'
  } else if (s.startsWith('aula')) {
    cor = 'bg-sky-100 text-sky-900'
    texto = s.charAt(0).toUpperCase() + s.slice(1)
  } else if (s === 'concluiu') {
    cor = 'bg-emerald-100 text-emerald-900'
    texto = 'Concluiu'
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${cor}`}>
      {texto}
    </span>
  )
}

function dataBR(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso.replace(' ', 'T')).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}
