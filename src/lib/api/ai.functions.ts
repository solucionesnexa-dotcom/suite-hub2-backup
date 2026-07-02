import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getServerConfig } from "../config.server";

const sopSchema = z.object({
  titulo: z.string().optional(),
  responsable: z.string().optional(),
  descripcion: z.string().min(10),
});

const caseSchema = z.object({
  cliente: z.string().optional(),
  cliente_anonimo: z.boolean(),
  sector: z.string().optional(),
  problema: z.string().min(5),
  solucion: z.string().min(5),
  herramientas_usadas: z.array(z.string()).default([]),
  resultado_cuantificable: z.string().optional(),
});

export const generateSopWithAi = createServerFn({ method: "POST" })
  .inputValidator(sopSchema)
  .handler(async ({ data }) => {
    const prompt = `Eres un experto en documentacion de procesos empresariales. A partir de la descripcion siguiente, genera un SOP estructurado con: objetivo, responsable, minimo 5 pasos numerados (cada uno con descripcion, condicion de entrada, condicion de salida y herramienta usada si aplica), y un entregable final. Responde solo JSON con esta estructura: {"objetivo":"", "responsable":"", "pasos":[{"numero":1,"descripcion":"","condicion_entrada":"","condicion_salida":"","herramienta":""}], "entregable":""}.

Titulo: ${data.titulo ?? ""}
Responsable indicado: ${data.responsable ?? ""}
Descripcion: ${data.descripcion}`;
    return parseJsonObject(await callConfiguredAi(prompt));
  });

export const generateCaseStudyWithAi = createServerFn({ method: "POST" })
  .inputValidator(caseSchema)
  .handler(async ({ data }) => {
    const prompt = `Eres un copywriter B2B especialista en agencias de automatizacion. Genera dos outputs a partir del siguiente caso de exito: 1) Un post para LinkedIn de maximo 1500 caracteres, con gancho inicial impactante, descripcion del problema, solucion implementada, resultados y CTA. 2) Un texto de caso de exito para catalogo de ventas en formato narrativo de 3 parrafos. No uses el nombre del cliente si cliente_anonimo es true. Responde solo JSON: {"post_linkedin":"", "pdf_contenido":""}.

Cliente: ${data.cliente ?? ""}
Anonimo: ${data.cliente_anonimo}
Sector: ${data.sector ?? ""}
Problema: ${data.problema}
Solucion: ${data.solucion}
Herramientas: ${data.herramientas_usadas.join(", ")}
Resultado: ${data.resultado_cuantificable ?? ""}`;
    return parseJsonObject(await callConfiguredAi(prompt));
  });

async function callConfiguredAi(prompt: string) {
  const config = getServerConfig();
  const provider = (config.aiProvider ?? (config.anthropicApiKey ? "anthropic" : "openai")).toLowerCase();
  if (provider === "anthropic") return callAnthropic(prompt, config.anthropicApiKey, config.aiModel);
  return callOpenAi(prompt, config.openaiApiKey, config.aiModel);
}

async function callOpenAi(prompt: string, apiKey?: string, model = "gpt-4.1-mini") {
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY en el entorno.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI rechazo la peticion (${response.status}): ${await response.text()}`);
  const payload = await response.json() as any;
  return payload.output_text ?? payload.output?.flatMap((o: any) => o.content ?? []).map((c: any) => c.text).join("") ?? "";
}

async function callAnthropic(prompt: string, apiKey?: string, model = "claude-3-5-sonnet-latest") {
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic rechazo la peticion (${response.status}): ${await response.text()}`);
  const payload = await response.json() as any;
  return (payload.content ?? []).map((part: any) => part.text ?? "").join("");
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const json = trimmed.startsWith("{")
    ? trimmed
    : trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  return JSON.parse(json);
}
