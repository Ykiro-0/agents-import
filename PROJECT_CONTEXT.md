# 📦 Projeto: Automação NF → Cadastro ERP (VF Import)

## 🎯 Objetivo
Automatizar o processo de cadastro de produtos a partir de Notas Fiscais.

Fluxo:
ClickUp → arquivos (HTML + CSV + XML) → processamento → gerar planilha VF → aprovação → importar no ERP (VF Import)

---

## 🚀 Ponto de partida

O processo inicia quando uma task no ClickUp muda para:

**STATUS: CONCLUIDO RECEBIMENTO**

Essa task SEMPRE terá:
- 1 arquivo HTML (com foto + EAN + descrição)
- 1 arquivo CSV (dados estruturados)
- Descrição no padrão:
  **NF 12345 - FORNECEDOR**

Cada task representa:
- 1 NF
- vários itens

---

## 📥 Entrada do sistema

Arquivos:
- HTML → contém imagem (base64), descrição e EAN
- CSV → contém descrição, EAN e quantidade
- XML → contém dados fiscais (NCM, custo, unidade, origem, etc)

---

## ⚙️ Etapa atual do projeto (FASE 1)

Estamos implementando SOMENTE:

👉 Leitura dos arquivos (HTML + CSV + XML)  
👉 Estruturação dos dados  
👉 Geração de planilha no formato VF EXCEL  

⚠️ Ainda NÃO vamos:
- integrar com ERP
- subir preço
- automatizar aprovação

---

## 🧠 Lógica do processamento

Para cada item:

1. Ler CSV:
- descricao
- ean
- quantidade

2. Ler HTML:
- imagem (base64)
- validar descricao/EAN

3. Ler XML:
- unidade (K, L)
- origem (M)
- situação fiscal (N)
- NCM (O, P)
- custo (W)
- número da NF (AA)

4. Completar com IA (AG_CAD):
- seção (D)
- grupo (E)
- subgrupo (F)
- descrição reduzida (I)

---

## 📊 Estrutura da planilha VF EXCEL

Cada linha = 1 item

| Coluna | Campo |
|------|------|
| A | status importado |
| B | status (PENDENTE) |
| C | código ERP |
| D | seção |
| E | grupo |
| F | subgrupo |
| H | descrição |
| I | descrição reduzida |
| K | unidade |
| L | unidade |
| M | origem |
| N | situação fiscal |
| O | NCM (2 dígitos) |
| P | NCM (8 dígitos) |
| Q | "01;20" |
| S | tipo (EAN ou LITERAL) |
| T | EAN |
| U | 1 |
| V | true se EAN |
| W | custo |
| AA | número da NF |

---

## 📤 Saída esperada

Arquivo Excel:

Exemplo:
VF_EXCEL_NF_12345.xlsx

Deve estar:
- 100% compatível com VF Import
- pronto para revisão humana

---

## 📁 Estrutura do projeto


vf-automation/
src/
data/ (html, csv, xml de teste)
outputs/ (planilhas geradas)


---

## 🧩 Próximos passos (ordem correta)

1. Criar base do projeto Node.js + TypeScript  
2. Criar função para ler CSV  
3. Criar função para ler HTML  
4. Criar função para ler XML  
5. Unificar dados  
6. Gerar planilha Excel  

---

## ⚠️ Regras importantes

- Sempre existe HTML + CSV
- NF vem na descrição da task
- 1 NF = vários itens
- CSV é a base dos dados
- HTML complementa (imagem + validação)
- XML traz dados fiscais

---

## 🎯 Objetivo imediato

👉 Gerar planilha VF automaticamente a partir dos arquivos

---

## 📌 Observação futura

Após aprovação humana:
- planilha será importada no VF Import
- processo seguirá:
  - validar EAN
  - cadastrar produto
  - cadastrar auxiliares
  - subir preço

(NÃO implementar isso agora)

---

## 🚀 Instrução para Codex

Comece criando a estrutura do projeto e funções separadas para:
- leitura de CSV
- leitura de HTML
- leitura de XML

Depois evoluir para geração do Excel.