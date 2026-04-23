# Progeso - Kadia

## Leitura do projeto atual

O projeto atual esta focado em automatizar o cadastro VF a partir de anexos do ClickUp.

Fluxo atual descrito no `PROJECT_CONTEXT.md`:

```text
ClickUp
  -> HTML + CSV + XML
  -> processamento
  -> planilha VF Excel
  -> revisao humana
  -> importacao no VF Import
```

A Fase 1 ainda nao deve integrar ERP, subir preco ou automatizar aprovacao.

O codigo ja tem partes importantes:

```text
src/parsers/csv.ts
src/parsers/html.ts
src/parsers/xml.ts
src/services/task-processor.ts
src/services/vf-workbook.ts
```

Hoje o sistema ja le CSV, HTML e XML, cruza dados e gera a planilha VF.

## Onde a Kadia complementa

A Kadia entra como camada de organizacao, validacao e evolucao controlada do cadastro em lote.

Ela nao deve substituir o fluxo atual. Ela deve complementar com:

1. Validadores antes de gerar a planilha VF.
2. Relatorio de erros por linha/produto.
3. Enriquecimento de dados com IA somente onde for seguro.
4. Regras fiscais deterministicas por NCM.
5. Separacao clara entre item valido, pendente e bloqueado.
6. Preparacao futura para API, fotos e preco atacado.

## Complemento recomendado para a Fase 1

Na Fase 1, a Kadia deve focar em validacao, nao em automacao externa.

Criar validadores para:

```text
CSV
- descricao obrigatoria
- quantidade numerica
- EAN vazio ou com 8 a 14 digitos

HTML
- imagem encontrada quando existir
- EAN do HTML confere com CSV quando possivel
- descricao HTML ajuda na conferencia

XML
- NCM com 8 digitos
- ncm2 preenchido
- custo numerico maior ou igual a zero
- unidade preenchida
- origem preenchida
- situacao fiscal preenchida
- numero NF preenchido

Planilha VF
- colunas obrigatorias no formato VF
- status PENDENTE
- aliquota padrao 01;20
- tipo EAN ou LITERAL
- possuiEan coerente com campo EAN
```

## Nova ordem segura do processamento

```text
1. Buscar task no ClickUp com status CONCLUIDO RECEBIMENTO
2. Baixar anexos CSV, HTML e XML
3. Parsear arquivos
4. Rodar Validador de Entrada
5. Cruzar CSV + HTML + XML
6. Rodar Validador de Cruzamento
7. Montar linhas VF
8. Rodar Validador VF
9. Gerar planilha VF Excel
10. Gerar relatorio de validacao
```

## Arquivos novos sugeridos

```text
src/validators/csv-validator.ts
src/validators/html-validator.ts
src/validators/xml-validator.ts
src/validators/vf-row-validator.ts
src/validators/validation-result.ts
src/services/validation-report.ts
```

## Status dos itens

Usar status simples:

```text
VALIDO
PENDENTE_REVISAO
BLOQUEADO
```

Regra:

- `VALIDO`: pode gerar planilha VF.
- `PENDENTE_REVISAO`: gera planilha, mas precisa conferencia humana.
- `BLOQUEADO`: nao deve entrar na planilha final sem correcao.

## IA na Kadia

Uso permitido da IA:

```text
- sugerir secao
- sugerir grupo
- sugerir subgrupo
- gerar descricao reduzida
- comparar descricao CSV/HTML/XML
- ajudar a identificar produto pela imagem
```

Uso proibido da IA:

```text
- decidir regra fiscal
- inventar NCM
- inventar CST/CSOSN
- alterar custo
- alterar EAN sem validacao
```

## Fiscal e NCM

Na fase atual, o XML traz NCM e situacao fiscal.

Quando entrar a regra fiscal por TXT/tabela, a Kadia deve:

```text
1. Ler o NCM do XML
2. Procurar o NCM na tabela fiscal
3. Aplicar somente regra encontrada
4. Bloquear produto se NCM nao existir na tabela
5. Gerar erro claro para revisao
```

## Fases futuras

Depois da Fase 1:

```text
Fase 2 - Enriquecimento Kadia
- secao, grupo, subgrupo e descricao reduzida com IA
- relatorio de confianca

Fase 3 - API de cadastro
- enviar somente itens validados
- guardar retorno do ERP/API

Fase 4 - Fotos
- OpenClaw/Ollama para inserir fotos quando nao houver API

Fase 5 - Preco atacado
- OpenClaw/Ollama ou API para atualizar preco atacado
- usar codigo ERP ja retornado na planilha master
```

## Decisao pratica

Agora, o melhor proximo passo e implementar os validadores.

Sem validador, o sistema gera Excel, mas nao sabe explicar com seguranca:

```text
- qual item esta correto
- qual item precisa revisao
- qual item deve ser bloqueado
- qual campo causou o problema
```

Kadia deve fechar essa lacuna primeiro.
