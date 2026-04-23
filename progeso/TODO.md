# TODO - Projeto Agents Import / Kadia

Use este arquivo para dividir trabalho e evitar duas pessoas mexendo na mesma coisa sem querer.

Legenda:

```text
[ ] pendente
[~] em andamento
[x] feito
DONO: pessoa responsavel
NAO MEXER: outro dev esta mexendo
```

Regra pratica:

- Antes de comecar uma tarefa, coloque seu nome em `DONO`.
- Se estiver mexendo agora, marque `[~]`.
- Quando terminar, marque `[x]`.
- Evite duas pessoas no mesmo arquivo ao mesmo tempo.
- Antes de trabalhar: `git pull --ff-only`.
- Depois de terminar: `git add .`, `git commit`, `git push`.

## 0. Controle do Projeto

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Definir nomes dos dois responsaveis no TODO |  | `progeso/TODO.md` |
| [ ] | Criar padrao de branch por tarefa |  | Git |
| [ ] | Decidir se trabalho sera direto na `main` ou via branch |  | GitHub |
| [ ] | Criar checklist de teste manual antes do push |  | `progeso/TODO.md` |

Padrao sugerido de branch:

```text
dev-1/validadores
dev-2/dashboard
kadia/enriquecimento
```

## 1. Base Atual - Conferencia

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [x] | Projeto Node.js + TypeScript criado |  | `package.json`, `tsconfig.json` |
| [x] | Parser CSV criado |  | `src/parsers/csv.ts` |
| [x] | Parser HTML criado |  | `src/parsers/html.ts` |
| [x] | Parser XML criado |  | `src/parsers/xml.ts` |
| [x] | Gerador de planilha VF criado |  | `src/services/vf-workbook.ts` |
| [x] | Processador de task ClickUp criado |  | `src/services/task-processor.ts` |
| [x] | Dashboard/monitor criado |  | `src/server/*`, `src/services/dashboard-service.ts` |
| [ ] | Rodar build e corrigir erros se houver |  | `npm run build` |
| [ ] | Testar fluxo com anexos reais ou mockados |  | `data/`, `outputs/` |

## 2. Validadores - Prioridade Alta

Essa e a primeira parte que a Kadia deve complementar.

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Criar tipo padrao de erro/validacao |  | `src/validators/validation-result.ts`, `src/types.ts` |
| [ ] | Criar validador CSV |  | `src/validators/csv-validator.ts` |
| [ ] | Criar validador HTML |  | `src/validators/html-validator.ts` |
| [ ] | Criar validador XML |  | `src/validators/xml-validator.ts` |
| [ ] | Criar validador de cruzamento CSV + HTML + XML |  | `src/validators/cross-validator.ts` |
| [ ] | Criar validador da linha VF |  | `src/validators/vf-row-validator.ts` |
| [ ] | Bloquear item com erro critico antes da planilha final |  | `src/services/task-processor.ts` |
| [ ] | Gerar relatorio de validacao |  | `src/services/validation-report.ts` |

Regras minimas:

```text
CSV:
- descricao obrigatoria
- quantidade numerica
- EAN vazio ou 8 a 14 digitos

HTML:
- extrair imagem quando existir
- comparar EAN com CSV quando possivel

XML:
- NCM com 8 digitos
- ncm2 = primeiros 2 digitos do NCM
- custo numerico
- unidade preenchida
- origem preenchida
- situacao fiscal preenchida
- numero NF preenchido

VF:
- status = PENDENTE
- aliquota = 01;20
- tipoCodigo = EAN ou LITERAL
- possuiEan coerente com EAN
```

## 3. Relatorios e Auditoria

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Criar pasta de saida para relatorios |  | `outputs/`, `config.ts` |
| [ ] | Gerar Excel/CSV com erros por linha |  | `src/services/validation-report.ts` |
| [ ] | Registrar taskId, NF e arquivo de origem em cada erro |  | `src/types.ts` |
| [ ] | Mostrar resumo no console |  | `src/index.ts` |
| [ ] | Mostrar resumo no dashboard |  | `src/services/dashboard-service.ts`, `src/server/dashboard-page.ts` |

Formato recomendado do erro:

```text
taskId
nfNumber
sourceFile
sourceType
itemIndex
field
value
severity
message
suggestedAction
```

## 4. Melhorias no Cruzamento dos Dados

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Melhorar match por EAN |  | `src/services/task-processor.ts` |
| [ ] | Melhorar match por descricao normalizada |  | `src/services/task-processor.ts` |
| [ ] | Marcar item sem match XML como bloqueado |  | `src/validators/cross-validator.ts` |
| [ ] | Marcar item sem match HTML como pendente revisao |  | `src/validators/cross-validator.ts` |
| [ ] | Guardar confianca do match |  | `src/types.ts` |

## 5. Planilha VF

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Confirmar se os cabecalhos A, B, C... sao aceitos pelo VF Import |  | `src/services/vf-workbook.ts` |
| [ ] | Se necessario, trocar cabecalho por nomes reais do VF |  | `src/services/vf-workbook.ts` |
| [ ] | Confirmar limite da descricao reduzida |  | `src/services/task-processor.ts` |
| [ ] | Adicionar formatacao basica na planilha |  | `src/services/vf-workbook.ts` |
| [ ] | Destacar linhas pendentes/bloqueadas se forem exportadas |  | `src/services/vf-workbook.ts` |

## 6. Kadia - IA e Enriquecimento

Nao implementar antes dos validadores.

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Definir fonte de secao/grupo/subgrupo |  | `config/` |
| [ ] | Criar tabela de secao > grupo > subgrupo |  | `config/secoes-grupos.*` |
| [ ] | Criar servico de sugestao de descricao reduzida |  | `src/services/kadia-enrichment.ts` |
| [ ] | Criar campo de confianca da IA |  | `src/types.ts` |
| [ ] | Marcar baixa confianca como pendente revisao |  | `src/validators/vf-row-validator.ts` |

Permitido para IA:

```text
- secao
- grupo
- subgrupo
- descricao reduzida
- apoio por imagem
```

Proibido para IA:

```text
- NCM
- CST/CSOSN
- custo
- EAN
- regra fiscal
```

## 7. Fiscal por NCM - Futuro Controlado

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Receber TXT/tabela fiscal por NCM |  | `config/regras-ncm.*` |
| [ ] | Criar parser da tabela fiscal |  | `src/services/fiscal-rules.ts` |
| [ ] | Validar NCM contra tabela fiscal |  | `src/validators/ncm-validator.ts` |
| [ ] | Bloquear NCM sem regra encontrada |  | `src/validators/ncm-validator.ts` |
| [ ] | Gerar relatorio fiscal de divergencias |  | `src/services/validation-report.ts` |

## 8. API / ERP - Futuro

Nao fazer na Fase 1.

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Mapear API atual de cadastro |  | `docs/api.md` |
| [ ] | Criar cliente da API |  | `src/clients/erp-api.ts` |
| [ ] | Enviar somente itens validados |  | `src/services/api-importer.ts` |
| [ ] | Salvar retorno do ERP/codigo do sistema |  | `src/services/runs-store.ts` |

## 9. OpenClaw / Ollama - Futuro

Nao fazer antes de validar API e planilha master.

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Definir ferramenta: OpenClaw ou Playwright |  | `progeso/DECISOES.md` |
| [ ] | Automatizar envio de fotos |  | `src/automation/photos.ts` |
| [ ] | Criar log de fotos |  | `outputs/log_fotos.*` |
| [ ] | Automatizar preco atacado |  | `src/automation/wholesale-price.ts` |
| [ ] | Criar log de preco atacado |  | `outputs/log_preco_atacado.*` |

## 10. Docker / Ambiente

| Status | Tarefa | Dono | Arquivos principais |
|---|---|---|---|
| [ ] | Criar Dockerfile |  | `Dockerfile` |
| [ ] | Criar docker-compose |  | `docker-compose.yml` |
| [ ] | Documentar variaveis de ambiente |  | `.env.example`, `README.md` |
| [ ] | Testar build dentro do Docker |  | Docker |

## Divisao Sugerida Para 2 Pessoas

Pessoa 1:

```text
- validators
- validation-report
- regra fiscal/NCM
- planilha VF
```

Pessoa 2:

```text
- ClickUp/dashboard
- API/ERP futura
- Docker
- OpenClaw/Ollama futura
```

Regra para evitar conflito:

```text
Pessoa 1 evita mexer em src/server e src/clients.
Pessoa 2 evita mexer em src/validators e vf-workbook enquanto Pessoa 1 estiver trabalhando.
```

## Proximo Passo Recomendado

Comecar por:

```text
src/validators/validation-result.ts
src/validators/csv-validator.ts
src/validators/xml-validator.ts
src/validators/html-validator.ts
```

Depois integrar no:

```text
src/services/task-processor.ts
```
