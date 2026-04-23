# AG-CAD VF Automation

Automacao inicial para buscar uma NF no ClickUp com status `CONCLUIDO RECEBIMENTO`, baixar os anexos, estruturar os dados de `CSV`, `HTML` e `XML` e gerar uma planilha no formato VF.

## Como usar

1. Instale as dependencias:
   `npm install`
2. Copie `.env.example` para `.env` e preencha os dados do ClickUp.
3. Rode em desenvolvimento:
   `npm run dev`

Para monitorar o ClickUp continuamente:

`npm run watch:clickup`

Para abrir o painel local no navegador:

`npm run dashboard`

## Gatilho da automacao

Ao rodar o projeto, o AG-CAD:

1. Busca tasks na lista configurada do ClickUp.
2. Filtra pelo status `CONCLUIDO RECEBIMENTO`.
3. Identifica a task mais recente ainda nao processada nesse status.
4. Valida os anexos obrigatorios `CSV`, `HTML` e `XML`.
5. Estrutura os dados e gera a planilha VF.
6. Salva o ID da task em `.ag-cad-state.json` para nao processar de novo.

Se quiser forcar uma task especifica, preencha `CLICKUP_TASK_ID` no `.env`.

## Dashboard local

O painel em `localhost` mostra:

- contagem de tasks em status-chave da pipeline
- tasks em `CONCLUIDO RECEBIMENTO`
- se cada task tem `CSV`, `HTML` e `XML`
- se a task ja foi processada
- historico recente de ciclos do monitor e geracao de planilhas

## Saida

O arquivo Excel sera salvo em `outputs/` com nome no padrao:

`VF_EXCEL_NF_<numero>.xlsx`
