import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

const ExtractInput = z.object({
  filename: z.string().min(1).max(255),
  pdfBase64: z.string().min(1),
});

const ExtractedInvoice = z.object({
  invoice_number: z.string().nullable().describe("Número o referencia de la factura"),
  issue_date: z.string().nullable().describe("Fecha de emisión en formato YYYY-MM-DD"),
  due_date: z.string().nullable().describe("Fecha de vencimiento en formato YYYY-MM-DD"),
  amount: z.number().nullable().describe("Importe total con impuestos, en euros, como número"),
  currency: z.string().nullable().describe("Código ISO de moneda, ej. EUR"),
  client_name: z
    .string()
    .nullable()
    .describe("Nombre o razón social del CLIENTE/destinatario (no del emisor)"),
  client_nif: z.string().nullable().describe("NIF/CIF del cliente"),
  saas_origen: z.string().nullable().describe("Plataforma o SaaS emisor, si aparece en la factura"),
  concept: z.string().nullable().describe("Descripción breve del servicio/concepto"),
});

export type ExtractedInvoiceData = z.infer<typeof ExtractedInvoice>;

export const extractInvoiceFromPdf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Falta LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const { experimental_output: output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: ExtractedInvoice }),
      messages: [
        {
          role: "system",
          content:
            "Extraes datos estructurados de facturas en PDF. Devuelve null si un campo no aparece. Fechas siempre en formato YYYY-MM-DD. Importes como número decimal en euros (sin símbolo). El cliente es el DESTINATARIO de la factura, NO el emisor.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae los datos de esta factura." },
            {
              type: "file",
              data: `data:application/pdf;base64,${data.pdfBase64}`,
              mediaType: "application/pdf",
              filename: data.filename,
            },
          ],
        },
      ],
    });

    return output;
  });
