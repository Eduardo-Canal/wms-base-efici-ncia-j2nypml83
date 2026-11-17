// admin-curso.pb.js — CRIAR e EDITAR um CURSO pelo painel.
//
// POR QUE ESTE ARQUIVO EXISTE (pedido do dono, 17/11):
// "crie uma forma de cadastrar curso, pois o livro tem muito conteúdo e estes
// são os cursos do livro 1 e tem ainda o livro 2". Até aqui, módulo, capítulo e
// aula tinham tela — CURSO não. Criar curso era migration, o que prendia o dono
// a mim para cada curso novo (3 do livro 1, mais os do livro 2).
//
// O QUE ESTE ENDPOINT FAZ:
//   * cria o curso com slug automático a partir do título
//   * cria o PRODUTO dele, para o curso já nascer vendável (é o que o curso 1
//     tem hoje: curso-fundamentos R$ 197 ligado ao curso)
//   * respeita o padrão que já existe no banco, campo por campo
//
// DECISÕES E POR QUÊ:
// 1. SLUG AUTOMÁTICO, gerado do título. Slug digitado à mão colide e, pior,
//    vira URL de venda que não dá para mudar depois sem quebrar link já
//    divulgado. Aqui o dono digita "Diagnóstico da Operação" e o sistema gera
//    "diagnostico-da-operacao".
// 2. PREFIXO DE AULA (fund/diag/impl). A regra do projeto é que o slug da AULA
//    é único no banco inteiro, não só no curso. Começar o slug do curso com o
//    prefixo certo (ex.: "diag-diagnostico-da-operacao") é o que faz as aulas
//    nascerem como diag-a01, diag-a02.
// 3. NUNCA PUBLICA SOZINHO. Curso nasce rascunho. Publicar é ação separada
//    (campo `publicado`), e produto nasce inativo com preço 0 — a regra
//    `produto ativo sem preço` do servidor continua valendo.
// 4. NÃO APAGA CURSO. Curso com matrícula apagado apaga o acesso de quem pagou.
//    Se o dono quiser tirar do ar, despublica. Exclusão é decisão de
//    arquitetura, comigo, não um botão no painel.
//
// Libs INLINE (require local não funciona no JSVM deste projeto).

routerAdd(
  'POST',
  '/backend/v1/admin/curso',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
    const inteiro = (v) => {
      const n = parseInt(texto(v), 10)
      return isNaN(n) ? 0 : n
    }

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador cria curso.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = texto(corpo.id)
    const titulo = texto(corpo.titulo)
    const resumo = texto(corpo.resumo_1linha)
    const descricao = texto(corpo.descricao)
    const resultado = texto(corpo.resultado_esperado)
    const prefixoPedido = texto(corpo.prefixo).toLowerCase()
    const cargaMin = inteiro(corpo.carga_min)
    const certCarga = inteiro(corpo.cert_carga_horas)
    const criarProduto = corpo.criar_produto === true || corpo.criar_produto === 'true'
    const precoReais = texto(corpo.preco_reais)

    if (!titulo)
      return e.json(400, { codigo: 'titulo_obrigatorio', mensagem: 'Dê um nome ao curso.' })
    if (titulo.length < 4)
      return e.json(400, {
        codigo: 'titulo_curto',
        mensagem: 'O nome do curso precisa ter pelo menos 4 letras.',
      })

    // Prefixo: só letras minúsculas, 2 a 6 (fund, diag, impl, livro2...).
    // Vazio = deriva do próprio título, o que serve para cursos isolados.
    let prefixo = prefixoPedido
    if (!prefixo) prefixo = ''
    if (prefixo && !/^[a-z]{2,6}$/.test(prefixo))
      return e.json(400, {
        codigo: 'prefixo_invalido',
        mensagem: 'O prefixo deve ter de 2 a 6 letras minúsculas, sem números (ex.: diag).',
      })

    // ---- slug ----
    function gerarSlug(t) {
      // Normaliza acentos, tira tudo que não é letra/número, troca espaço por -.
      const semAcento = String(t)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return semAcento
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60)
    }

    try {
      let curso = null
      let slugNovo = ''

      if (id) {
        // ---- edição ----
        curso = $app.findRecordById('cursos', id)
        // Slug NÃO muda na edição: é URL de venda. Mudar quebra link circulado.
        curso.set('titulo', titulo)
        if (corpo.resumo_1linha !== undefined) curso.set('resumo_1linha', resumo)
        if (corpo.descricao !== undefined) curso.set('descricao', descricao)
        if (corpo.resultado_esperado !== undefined) curso.set('resultado_esperado', resultado)
        if (corpo.carga_min !== undefined) curso.set('carga_min', cargaMin)
        if (corpo.cert_carga_horas !== undefined) curso.set('cert_carga_horas', certCarga)
      } else {
        // ---- criação ----
        const base = gerarSlug(titulo)
        if (!base)
          return e.json(400, {
            codigo: 'titulo_invalido',
            mensagem: 'Não consegui montar o endereço do curso a partir deste nome.',
          })

        // Monta o slug com prefixo quando o dono informou um.
        let raiz = base
        if (prefixo) {
          // Se o título já começa com o prefixo, não duplica (diag-diagnostico).
          raiz = base.indexOf(prefixo + '-') === 0 ? base : prefixo + '-' + base
        }
        slugNovo = raiz

        // Colisão: acrescenta -2, -3... Nunca sobrescreve curso existente.
        let tentativa = 1
        let livre = false
        while (!livre && tentativa < 50) {
          let existe = null
          try {
            existe = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slugNovo })
          } catch (_) {}
          if (!existe) livre = true
          else {
            tentativa++
            slugNovo = raiz + '-' + tentativa
          }
        }

        const col = $app.findCollectionByNameOrId('cursos')
        curso = new Record(col)
        curso.set('slug', slugNovo)
        curso.set('titulo', titulo)
        curso.set('resumo_1linha', resumo)
        curso.set('descricao', descricao)
        curso.set('resultado_esperado', resultado)
        curso.set('carga_min', cargaMin > 0 ? cargaMin : 0)
        curso.set('cert_carga_horas', certCarga > 0 ? certCarga : 0)
        // Nasce RASCUNHO: publicar é decisão separada, com o conteúdo montado.
        curso.set('publicado', false)
        curso.set('cert_ativo', false)

        // Ordem: entra no fim da lista.
        let ordem = 1
        try {
          const todos = $app.findRecordsByFilter('cursos', "id != ''", 'ordem', 100, 0)
          let maior = 0
          for (let i = 0; i < todos.length; i++) {
            const o = todos[i].getInt('ordem')
            if (o > maior) maior = o
          }
          ordem = maior + 1
        } catch (_) {
          ordem = 1
        }
        curso.set('ordem', ordem)
      }

      // ---- publicar / despublicar ----
      // Decisão separada de criar: o dono monta o curso, confere e só então
      // publica. Aqui a única trava é o bom senso de conteúdo — um curso sem
      // módulo publicado e sem aula não deve ir para a vitrine com cara de
      // pronto. Quem barra o resto (certificado, produto) é cada endpoint.
      if (corpo.publicado !== undefined) {
        const querPublicar = corpo.publicado === true || corpo.publicado === 'true'
        if (querPublicar) {
          let aulasPub = 0
          try {
            const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
              c: curso.id,
            })
            for (let i = 0; i < mods.length; i++) {
              const as = $app.findRecordsByFilter(
                'aulas',
                'modulo = {:m} && publicado = true',
                '',
                500,
                0,
                { m: mods[i].id },
              )
              aulasPub += as.length
            }
          } catch (_) {}
          if (aulasPub === 0)
            return e.json(409, {
              codigo: 'sem_aula_publicada',
              mensagem:
                'Este curso ainda não tem aula publicada. Crie os módulos e as aulas e publique pelo menos uma antes de colocar o curso no ar.',
            })
        }
        curso.set('publicado', querPublicar)
      }

      $app.save(curso)

      // ---- produto do curso ----
      // Só na criação, e só se pedido. Sem isso o curso existe mas não tem
      // como ser vendido, e o dono teria que me chamar outra vez.
      let produtoCriado = null
      if (!id && criarProduto) {
        try {
          const colProd = $app.findCollectionByNameOrId('produtos')
          const prod = new Record(colProd)

          // slug do produto: o curso 1 usa "curso-fundamentos". Aqui derivo do
          // slug do curso sem o prefixo, para ficar legível na URL de compra.
          let slugProd = 'curso-' + (prefixo ? slugNovo.replace(prefixo + '-', '') : slugNovo)
          slugProd = slugProd.substring(0, 90)
          let p = 1
          let livreP = false
          while (!livreP && p < 50) {
            let existeP = null
            try {
              existeP = $app.findFirstRecordByFilter('produtos', 'slug = {:s}', { s: slugProd })
            } catch (_) {}
            if (!existeP) livreP = true
            else {
              p++
              slugProd = 'curso-' + slugNovo + '-' + p
            }
          }

          prod.set('slug', slugProd)
          prod.set('titulo', titulo)
          prod.set('descricao', resumo || descricao)
          prod.set('moeda', 'BRL')
          prod.set('cursos', [curso.id])

          // Preço: aceita "197,00" ou "197.00". Vazio ou 0 = a definir, e o
          // produto fica INATIVO (o servidor recusa ativo sem preço).
          let centavos = 0
          if (precoReais) {
            const bruto = precoReais.replace(/\s/g, '').replace(',', '.')
            const reais = Number(bruto)
            if (!isNaN(reais) && reais > 0) centavos = Math.round(reais * 100)
          }
          prod.set('preco_centavos', centavos)
          prod.set('ativo', centavos > 0)

          let ordemP = 1
          try {
            const prods = $app.findRecordsByFilter('produtos', "id != ''", 'ordem', 100, 0)
            let maiorP = 0
            for (let i = 0; i < prods.length; i++) {
              const o = prods[i].getInt('ordem')
              if (o > maiorP) maiorP = o
            }
            ordemP = maiorP + 1
          } catch (_) {
            ordemP = 1
          }
          prod.set('ordem', ordemP)

          $app.save(prod)
          produtoCriado = { slug: slugProd, ativo: centavos > 0, preco_centavos: centavos }
        } catch (errProd) {
          // Curso criado é o que importa: se o produto falhar, avisa e segue.
          console.log('[ead] admin/curso: produto falhou: ' + errProd.message)
        }
      }

      return e.json(200, {
        ok: true,
        id: curso.id,
        slug: curso.getString('slug'),
        titulo: curso.getString('titulo'),
        publicado: curso.getBool('publicado'),
        ordem: curso.getInt('ordem'),
        produto: produtoCriado,
        mensagem: id
          ? 'Curso atualizado: ' + curso.getString('titulo')
          : 'Curso criado: ' + curso.getString('titulo') + '. Agora crie os módulos.',
      })
    } catch (err) {
      console.log('[ead] admin/curso falhou: ' + err.message)
      return e.json(400, {
        codigo: 'curso_falhou',
        mensagem: 'Não foi possível salvar o curso: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)
