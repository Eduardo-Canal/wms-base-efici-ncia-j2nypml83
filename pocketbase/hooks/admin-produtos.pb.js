// admin-produtos.pb.js — o dono edita PREÇO e LINK DE PAGAMENTO pelo painel.
//
// POR QUE ESTE ARQUIVO EXISTE:
// o dono pediu explicitamente para ajustar preço e link do Mercado Pago DENTRO
// da aplicação, sem depender de mim para cada mudança. A coleção `produtos` tem
// createRule/updateRule = null (ninguém escreve pela API), então sem um endpoint
// de admin ele não conseguiria. Aqui a escrita é liberada só para admin.
//
// O QUE ELE PODE MUDAR: preço (em reais, convertido para centavos), link de
// pagamento, observação do link, e se o produto está ativo.
// O QUE ELE NÃO PODE MUDAR AQUI: slug e relação com curso. Mudar slug quebra
// URL de venda já divulgada; mudar o curso de um produto vendido muda o que a
// pessoa comprou. Isso é decisão de arquitetura, não de operação.
//
// NÃO EXISTE PRODUTO GRÁTIS POR ENGANO: ativar com preço 0 é recusado aqui,
// com mensagem clara. (A validação de servidor da migration também barra.)
//
// Libs inline porque `require` local não funciona no JSVM deste projeto.

const TEXTO = (v) => (v === undefined || v === null ? '' : String(v).trim())

// ---------------------------------------------------------------------------
// GET /backend/v1/admin/produtos — lista para a tela do painel
// ---------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/produtos',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let equipe = false
    try {
      if (auth.collection().name === '_superusers') equipe = true
      else {
        const p = String(auth.get('papel'))
        equipe = p === 'admin' || p === 'suporte'
      }
    } catch (_) {}
    if (!equipe)
      return e.json(403, {
        codigo: 'sem_permissao',
        mensagem: 'Só o administrador acessa esta área.',
      })

    const lista = []
    try {
      const prods = $app.findRecordsByFilter('produtos', "id != ''", 'ordem', 100, 0)
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i]
        // Nome do curso, para o dono não precisar decorar id de relação.
        let cursoSlug = ''
        let cursoTitulo = ''
        try {
          const ids = p.getStringSlice('cursos') || []
          if (ids.length) {
            const c = $app.findRecordById('cursos', ids[0])
            cursoSlug = c.getString('slug')
            cursoTitulo = c.getString('titulo')
          }
        } catch (_) {}

        lista.push({
          id: p.id,
          slug: p.getString('slug'),
          titulo: p.getString('titulo'),
          ativo: p.getBool('ativo'),
          preco_centavos: p.getInt('preco_centavos'),
          moeda: p.getString('moeda'),
          mp_link: p.getString('mp_link'),
          mp_link_obs: p.getString('mp_link_obs'),
          curso_slug: cursoSlug,
          curso_titulo: cursoTitulo,
          ordem: p.getInt('ordem'),
        })
      }
    } catch (err) {
      return e.json(500, {
        codigo: 'lista_falhou',
        mensagem: 'Não foi possível listar os produtos: ' + err.message,
      })
    }

    return e.json(200, { total: lista.length, produtos: lista })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/produto — grava preço e link de pagamento
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/produto',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, {
        codigo: 'sem_permissao',
        mensagem: 'Só o administrador altera preço e link.',
      })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = TEXTO(corpo.id)
    if (!id) return e.json(400, { codigo: 'id_obrigatorio', mensagem: 'Produto não informado.' })

    let prod = null
    try {
      prod = $app.findRecordById('produtos', id)
    } catch (_) {}
    if (!prod)
      return e.json(404, { codigo: 'produto_inexistente', mensagem: 'Produto não encontrado.' })

    // ---- PREÇO ----
    // A tela manda reais ("197,00" ou "197.00"); o banco guarda centavos.
    // Aceita os dois separadores porque teclado brasileiro digita vírgula.
    if (corpo.preco_reais !== undefined) {
      const bruto = TEXTO(corpo.preco_reais).replace(/\s/g, '').replace(',', '.')
      if (bruto === '') {
        prod.set('preco_centavos', 0)
      } else {
        const reais = Number(bruto)
        if (isNaN(reais) || reais < 0)
          return e.json(400, {
            codigo: 'preco_invalido',
            mensagem: 'Preço inválido. Use por exemplo 197,00.',
          })
        prod.set('preco_centavos', Math.round(reais * 100))
      }
    }

    // ---- LINK DO MERCADO PAGO ----
    if (corpo.mp_link !== undefined) {
      const link = TEXTO(corpo.mp_link)
      // Vazio é permitido: produto pode existir antes do link.
      // Mas se vier algo, tem que ser http(s) — link errado é pior que link
      // nenhum, porque o aluno clica e não consegue pagar.
      if (link && !/^https?:\/\/.+/.test(link))
        return e.json(400, {
          codigo: 'link_invalido',
          mensagem: 'O link precisa começar com https:// (copie o link do Mercado Pago).',
        })
      prod.set('mp_link', link)
    }

    if (corpo.mp_link_obs !== undefined) prod.set('mp_link_obs', TEXTO(corpo.mp_link_obs))

    // ---- ATIVO ----
    if (corpo.ativo !== undefined) {
      const querAtivo = corpo.ativo === true || corpo.ativo === 'true'
      if (querAtivo) {
        const preco = prod.getInt('preco_centavos')
        if (!preco || preco <= 0)
          return e.json(409, {
            codigo: 'sem_preco',
            mensagem: 'Defina o preço antes de colocar o curso à venda.',
          })
      }
      prod.set('ativo', querAtivo)
    }

    try {
      $app.save(prod)
    } catch (err) {
      return e.json(400, {
        codigo: 'produto_falhou',
        mensagem: 'Não foi possível salvar: ' + err.message,
      })
    }

    return e.json(200, {
      ok: true,
      id: prod.id,
      preco_centavos: prod.getInt('preco_centavos'),
      mp_link: prod.getString('mp_link'),
      ativo: prod.getBool('ativo'),
      mensagem: 'Produto atualizado.',
    })
  },
  $apis.requireAuth(),
)
