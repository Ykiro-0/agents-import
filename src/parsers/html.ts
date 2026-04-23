import { load } from "cheerio";
import type { HtmlItem } from "../types.js";

function extractImageBase64(html: string): string | undefined {
  const match = html.match(/data:image\/[a-zA-Z+]+;base64,([A-Za-z0-9+/=]+)/);
  return match?.[1];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseHtml(buffer: Buffer): HtmlItem[] {
  const html = buffer.toString("utf8");
  const $ = load(html);
  const imageBase64 = extractImageBase64(html);
  const bodyText = normalizeText($.root().text());

  const eanMatches = [...bodyText.matchAll(/\b\d{8,14}\b/g)].map((match) => match[0]);
  const uniqueEans = [...new Set(eanMatches)];

  if (uniqueEans.length === 0) {
    return [
      {
        descricao: bodyText,
        ean: "",
        imagemBase64: imageBase64
      }
    ];
  }

  return uniqueEans.map((ean) => ({
    descricao: bodyText,
    ean,
    imagemBase64: imageBase64
  }));
}
