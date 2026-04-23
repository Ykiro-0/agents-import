import { config } from "./config.js";
import { startDashboardServer } from "./server/dashboard-server.js";
import { processNewestUnprocessedReceiptTask, processPendingReceiptTask } from "./services/task-processor.js";

async function main(): Promise<void> {
  const shouldWatch = process.argv.includes("--watch");
  const shouldStartDashboard = process.argv.includes("--dashboard");

  if (shouldStartDashboard) {
    startDashboardServer();
    return;
  }

  if (shouldWatch) {
    await runWatcher();
    return;
  }

  const result = await processPendingReceiptTask();

  console.log("Planilha gerada com sucesso.");
  console.log(`Task: ${result.taskName} (${result.taskId})`);
  console.log(`NF: ${result.nfNumber}`);
  console.log(`Itens: ${result.totalItems}`);
  console.log(`Arquivo: ${result.outputPath}`);
}

async function runWatcher(): Promise<void> {
  console.log(
    `Monitorando ClickUp para novas tasks em ${config.clickUpStatusName} a cada ${config.pollIntervalMs}ms.`
  );

  while (true) {
    try {
      const result = await processNewestUnprocessedReceiptTask();

      if (result) {
        console.log("Nova task encontrada e processada com sucesso.");
        console.log(`Task: ${result.taskName} (${result.taskId})`);
        console.log(`NF: ${result.nfNumber}`);
        console.log(`Itens: ${result.totalItems}`);
        console.log(`Arquivo: ${result.outputPath}`);
      } else {
        console.log("Nenhuma nova task para processar neste ciclo.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`Falha no monitoramento AG-CAD: ${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  console.error(`Falha na automacao AG-CAD: ${message}`);
  process.exitCode = 1;
});
