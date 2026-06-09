// SEPA Direct Debit (pain.008.001.02) generator + validation
import { normalizeIban, isValidIban, isValidBic } from "./iban";

export type SepaInvoiceInput = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  concept?: string | null;
  debtorName: string;
  debtorIban: string;
  debtorBic?: string | null;
  mandateReference: string;
  mandateSignatureDate: string; // YYYY-MM-DD
  sequenceType?: string; // FRST | RCUR | OOFF | FNAL
};

export type SepaRemittanceInput = {
  messageId: string;
  creationDateTime?: string; // ISO
  creditorName: string;
  creditorIban: string;
  creditorBic?: string | null;
  creditorId: string; // Spanish: ES00000B12345678 style
  collectionDate: string; // YYYY-MM-DD requested execution date
  invoices: SepaInvoiceInput[];
};

export type SepaValidationIssue = { invoiceId?: string; field: string; message: string };

const xmlEscape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const trim = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

const fmtAmount = (n: number) => n.toFixed(2);

export function validateRemittance(input: SepaRemittanceInput): SepaValidationIssue[] {
  const issues: SepaValidationIssue[] = [];
  if (!input.creditorName?.trim()) issues.push({ field: "creditorName", message: "Falta el nombre del acreedor" });
  if (!isValidIban(input.creditorIban)) issues.push({ field: "creditorIban", message: "IBAN del acreedor no válido" });
  if (input.creditorBic && !isValidBic(input.creditorBic))
    issues.push({ field: "creditorBic", message: "BIC del acreedor no válido" });
  if (!input.creditorId?.trim()) issues.push({ field: "creditorId", message: "Falta el identificador del acreedor (Creditor ID)" });
  if (!input.collectionDate) issues.push({ field: "collectionDate", message: "Falta la fecha de cobro" });
  if (!input.invoices.length) issues.push({ field: "invoices", message: "La remesa no contiene facturas" });

  for (const inv of input.invoices) {
    if (!(inv.amount > 0))
      issues.push({ invoiceId: inv.invoiceId, field: "amount", message: `Importe inválido en factura ${inv.invoiceNumber}` });
    if (!isValidIban(inv.debtorIban))
      issues.push({ invoiceId: inv.invoiceId, field: "debtorIban", message: `IBAN deudor inválido en factura ${inv.invoiceNumber}` });
    if (inv.debtorBic && !isValidBic(inv.debtorBic))
      issues.push({ invoiceId: inv.invoiceId, field: "debtorBic", message: `BIC deudor inválido en factura ${inv.invoiceNumber}` });
    if (!inv.mandateReference?.trim())
      issues.push({ invoiceId: inv.invoiceId, field: "mandateReference", message: `Falta mandato en factura ${inv.invoiceNumber}` });
    if (!inv.mandateSignatureDate)
      issues.push({ invoiceId: inv.invoiceId, field: "mandateSignatureDate", message: `Falta fecha de firma del mandato en factura ${inv.invoiceNumber}` });
    if (!inv.debtorName?.trim())
      issues.push({ invoiceId: inv.invoiceId, field: "debtorName", message: `Falta nombre del deudor en factura ${inv.invoiceNumber}` });
  }
  return issues;
}

export function generateSepaXml(input: SepaRemittanceInput): string {
  const creationDt = input.creationDateTime ?? new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const totalAmount = input.invoices.reduce((s, i) => s + i.amount, 0);
  const nbTx = input.invoices.length;
  const creditorIban = normalizeIban(input.creditorIban);

  // Group by sequence type (default RCUR)
  const groups = new Map<string, SepaInvoiceInput[]>();
  for (const inv of input.invoices) {
    const seq = inv.sequenceType || "RCUR";
    if (!groups.has(seq)) groups.set(seq, []);
    groups.get(seq)!.push(inv);
  }

  let pmtInfBlocks = "";
  let pmtInfIdx = 0;
  for (const [seq, list] of groups) {
    pmtInfIdx += 1;
    const ctrlSum = list.reduce((s, i) => s + i.amount, 0);
    const txs = list
      .map((inv, i) => {
        const endToEnd = xmlEscape(trim(`${input.messageId}-${pmtInfIdx}-${i + 1}`, 35));
        const debtorBic = inv.debtorBic
          ? `\n          <DbtrAgt><FinInstnId><BIC>${xmlEscape(inv.debtorBic.toUpperCase())}</BIC></FinInstnId></DbtrAgt>`
          : `\n          <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>`;
        return `        <DrctDbtTxInf>
          <PmtId><EndToEndId>${endToEnd}</EndToEndId></PmtId>
          <InstdAmt Ccy="EUR">${fmtAmount(inv.amount)}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${xmlEscape(trim(inv.mandateReference, 35))}</MndtId>
              <DtOfSgntr>${inv.mandateSignatureDate}</DtOfSgntr>
            </MndtRltdInf>
          </DrctDbtTx>${debtorBic}
          <Dbtr><Nm>${xmlEscape(trim(inv.debtorName, 70))}</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>${normalizeIban(inv.debtorIban)}</IBAN></Id></DbtrAcct>
          <RmtInf><Ustrd>${xmlEscape(trim(inv.concept || `Factura ${inv.invoiceNumber}`, 140))}</Ustrd></RmtInf>
        </DrctDbtTxInf>`;
      })
      .join("\n");

    const cdtrBic = input.creditorBic
      ? `\n        <CdtrAgt><FinInstnId><BIC>${xmlEscape(input.creditorBic.toUpperCase())}</BIC></FinInstnId></CdtrAgt>`
      : `\n        <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>`;

    pmtInfBlocks += `
      <PmtInf>
        <PmtInfId>${xmlEscape(trim(`${input.messageId}-${pmtInfIdx}`, 35))}</PmtInfId>
        <PmtMtd>DD</PmtMtd>
        <NbOfTxs>${list.length}</NbOfTxs>
        <CtrlSum>${fmtAmount(ctrlSum)}</CtrlSum>
        <PmtTpInf>
          <SvcLvl><Cd>SEPA</Cd></SvcLvl>
          <LclInstrm><Cd>CORE</Cd></LclInstrm>
          <SeqTp>${seq}</SeqTp>
        </PmtTpInf>
        <ReqdColltnDt>${input.collectionDate}</ReqdColltnDt>
        <Cdtr><Nm>${xmlEscape(trim(input.creditorName, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${creditorIban}</IBAN></Id></CdtrAcct>${cdtrBic}
        <ChrgBr>SLEV</ChrgBr>
        <CdtrSchmeId>
          <Id><PrvtId><Othr>
            <Id>${xmlEscape(input.creditorId)}</Id>
            <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
          </Othr></PrvtId></Id>
        </CdtrSchmeId>
${txs}
      </PmtInf>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(trim(input.messageId, 35))}</MsgId>
      <CreDtTm>${creationDt}</CreDtTm>
      <NbOfTxs>${nbTx}</NbOfTxs>
      <CtrlSum>${fmtAmount(totalAmount)}</CtrlSum>
      <InitgPty><Nm>${xmlEscape(trim(input.creditorName, 70))}</Nm></InitgPty>
    </GrpHdr>${pmtInfBlocks}
  </CstmrDrctDbtInitn>
</Document>`;
}

export function downloadXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
