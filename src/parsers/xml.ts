import { XMLParser } from "fast-xml-parser";
import type { XmlItem } from "../types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseXml(buffer: Buffer): XmlItem[] {
  const xml = parser.parse(buffer.toString("utf8"));
  const nfeProc = xml.nfeProc ?? xml.NFe ?? xml;
  const infNFe = nfeProc.NFe?.infNFe ?? nfeProc.infNFe;
  const ide = infNFe.ide;
  const detItems = toArray(infNFe.det);

  return detItems.map((det: any) => {
    const prod = det.prod ?? {};
    const imposto = det.imposto ?? {};
    const icms =
      imposto.ICMS?.ICMS00 ??
      imposto.ICMS?.ICMS10 ??
      imposto.ICMS?.ICMSSN102 ??
      imposto.ICMS?.ICMSSN500 ??
      {};
    const ncm8 = onlyDigits(String(prod.NCM ?? ""));

    return {
      descricao: String(prod.xProd ?? "").trim(),
      ean: String(prod.cEAN ?? prod.cEANTrib ?? "").trim(),
      unidade: String(prod.uCom ?? prod.uTrib ?? "").trim(),
      origem: String(icms.orig ?? ""),
      situacaoFiscal: String(icms.CST ?? icms.CSOSN ?? ""),
      ncm2: ncm8.slice(0, 2),
      ncm8,
      custo: Number(prod.vUnCom ?? prod.vUnTrib ?? 0),
      numeroNf: String(ide.nNF ?? "").trim()
    };
  });
}
