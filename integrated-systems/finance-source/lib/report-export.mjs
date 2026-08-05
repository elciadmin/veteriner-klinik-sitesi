import { isRecognizedExpense } from "./operations.mjs";
import {
  hasCashEffect,
  hasEconomicEffect,
  resolvedPosNet,
} from "./financial-core.mjs";

const encoder = new TextEncoder();

const scopeLabels = {
  all: "tum-hareketler",
  income: "gelirler",
  outflows: "giderler-ve-cikislar",
};

const kindLabels = {
  income: "Gelir",
  expense: "Gider",
  withdrawal: "Kasa çekimi",
};

const paymentLabels = {
  cash: "Nakit",
  card: "Kart / POS",
  transfer: "Havale",
  accrual: "Tahakkuk / stok",
};

const operationLabels = {
  service: "Hizmet",
  product_sale: "Ürün / mama satışı",
  other_income: "Diğer gelir",
  inventory_purchase: "Stok / sarf alımı",
  overhead: "Genel işletme gideri",
  tax: "Vergi / harç",
  pos_commission: "POS komisyonu",
  receivable_collection: "Alacak tahsilatı",
  payable_payment: "Borç ödemesi",
  inventory_usage: "Stok kullanım maliyeti",
  inventory_sale_cost: "Satılan ürün maliyeti",
  inventory_waste: "Fire / zayi maliyeti",
  owner_withdrawal: "İşletme sahibi çekimi",
};

const documentLabels = {
  receipt: "Nakit fiş / yazar kasa",
  invoice: "Fatura",
  e_archive: "e-Arşiv / e-Fatura",
  bank_statement: "Banka ekstresi / dekont",
  pos_statement: "POS ekstresi",
  stock_record: "Stok maliyet fişi",
  none: "Belgesiz",
};

export const EXPORT_SCOPES = ["all", "income", "outflows"];

export const EXPORT_COLUMNS = [
  { key: "sequence", label: "Sıra", kind: "number", width: 8 },
  { key: "date", label: "Tarih", width: 13 },
  { key: "time", label: "Saat", width: 9 },
  { key: "kindLabel", label: "Tür", width: 17 },
  { key: "counterparty", label: "Kimden / Kime", width: 24 },
  { key: "operationLabel", label: "İşlem Türü", width: 23 },
  { key: "category", label: "Kategori", width: 24 },
  { key: "description", label: "Açıklama", width: 34 },
  { key: "paymentLabel", label: "Ödeme Kanalı", width: 16 },
  { key: "documentLabel", label: "Belge Türü", width: 24 },
  { key: "documentRef", label: "Belge No", width: 19 },
  { key: "vatRate", label: "KDV Oranı", kind: "percent", width: 12 },
  { key: "posRate", label: "POS Oranı", kind: "percent", width: 12 },
  { key: "posStatus", label: "POS Durumu", width: 15 },
  { key: "amount", label: "KDV Dâhil Tutar", kind: "money", width: 18 },
  { key: "netAmount", label: "KDV Hariç Tutar", kind: "money", width: 18 },
  { key: "vatAmount", label: "KDV Tutarı", kind: "money", width: 15 },
  { key: "accountingStatus", label: "Muhasebe Statüsü", width: 32 },
  { key: "relatedIncomeId", label: "İlişkili Gelir Kimliği", width: 24 },
];

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function assertIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} geçerli bir tarih olmalıdır.`);
  }
}

function validatePeriod(startDate, endDate) {
  assertIsoDate(startDate, "Başlangıç");
  assertIsoDate(endDate, "Bitiş");
  if (startDate > endDate) {
    throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
  }
}

function includeForScope(transaction, scope) {
  if (scope === "income") return transaction.kind === "income";
  if (scope === "outflows") {
    return transaction.kind === "expense" || transaction.kind === "withdrawal";
  }
  return true;
}

function accountingStatus(transaction) {
  if (!hasEconomicEffect(transaction)) {
    return "Yalnız para hareketi; gelir/gider ve KDV tekrar sayılmaz";
  }
  if (!hasCashEffect(transaction)) {
    return "Yalnız ekonomik etki; kasa/banka hareketi değildir";
  }
  if (transaction.kind === "income") return "Gelir kaydı";
  if (transaction.kind === "withdrawal") {
    return "Kasa çıkışı; işletme gideri değildir";
  }
  if (!isRecognizedExpense(transaction)) {
    return "Belgesiz çıkış; gider/KDV hesabına alınmaz";
  }
  if (transaction.isAutomatic && transaction.operationType === "pos_commission") {
    return "Belgeli gider; otomatik POS komisyonu";
  }
  return "Belgeli işletme gideri";
}

function posStatusLabel(transaction) {
  if (transaction.paymentMethod !== "card" && !transaction.posStatus) return "";
  if (transaction.posStatus === "settled") return "Hesaba yattı";
  if (transaction.posStatus === "pending") return "Bekliyor";
  return "Belirtilmedi";
}

function transactionRow(transaction, sequence) {
  const amount = roundMoney(transaction.amount);
  const vatRate = Number(transaction.vatRate ?? 0);
  const netAmount =
    vatRate > 0 ? roundMoney(amount / (1 + vatRate)) : amount;
  const vatAmount = roundMoney(amount - netAmount);

  return {
    sequence,
    id: transaction.id,
    date: transaction.date,
    time: transaction.time,
    kind: transaction.kind,
    kindLabel:
      transaction.isAutomatic && transaction.operationType === "pos_commission"
        ? "Otomatik POS gideri"
        : kindLabels[transaction.kind] ?? transaction.kind,
    counterparty: transaction.counterparty || "Belirtilmedi",
    operationLabel:
      operationLabels[transaction.operationType] ||
      transaction.operationType ||
      "Belirtilmedi",
    category: transaction.category || "Belirtilmedi",
    description: transaction.description || "",
    paymentLabel:
      paymentLabels[transaction.paymentMethod] ||
      transaction.paymentMethod ||
      "Belirtilmedi",
    documentLabel:
      documentLabels[transaction.documentType] ||
      transaction.documentType ||
      "Belirsiz",
    documentRef: transaction.documentRef || "",
    vatRate,
    posRate: Number(transaction.posRate ?? 0),
    posStatus: posStatusLabel(transaction),
    amount,
    netAmount,
    vatAmount,
    accountingStatus: accountingStatus(transaction),
    relatedIncomeId:
      transaction.relatedIncomeId || transaction.sourceTransactionId || "",
    economicEffect: hasEconomicEffect(transaction),
    cashEffect: hasCashEffect(transaction),
    paymentMethod: transaction.paymentMethod,
    settledNet:
      transaction.paymentMethod === "card" &&
      transaction.posStatus === "settled"
        ? resolvedPosNet(transaction)
        : 0,
    recognizedExpense:
      transaction.kind === "expense" && isRecognizedExpense(transaction),
  };
}

export function buildReportExport({
  transactions,
  startDate,
  endDate,
  scope = "all",
}) {
  validatePeriod(startDate, endDate);
  if (!EXPORT_SCOPES.includes(scope)) {
    throw new Error("Geçersiz dışa aktarım kapsamı.");
  }

  const active = transactions
    .filter(
      (transaction) =>
        transaction.status !== "cancelled" &&
        transaction.date >= startDate &&
        transaction.date <= endDate &&
        includeForScope(transaction, scope),
    )
    .sort((a, b) =>
      `${a.date} ${a.time} ${a.id}`.localeCompare(
        `${b.date} ${b.time} ${b.id}`,
      ),
    );
  const rows = active.map((transaction, index) =>
    transactionRow(transaction, index + 1),
  );
  const posSettlementCash =
    scope === "outflows"
      ? 0
      : transactions
          .filter(
            (transaction) =>
              transaction.status !== "cancelled" &&
              transaction.kind === "income" &&
              hasCashEffect(transaction) &&
              transaction.paymentMethod === "card" &&
              transaction.posStatus === "settled" &&
              transaction.settlementDate >= startDate &&
              transaction.settlementDate <= endDate,
          )
          .reduce(
            (sum, transaction) => sum + resolvedPosNet(transaction),
            0,
          );

  const summary = rows.reduce(
    (result, row) => {
      if (row.kind === "income") {
        result.incomeCount += 1;
        if (row.economicEffect) result.income += row.amount;
        else result.collectionCash += row.amount;
        if (row.cashEffect) {
          if (row.paymentMethod === "cash") {
            result.cashIncome += row.amount;
            result.cashInflow += row.amount;
          }
          if (row.paymentMethod === "card") {
            if (row.economicEffect) result.cardIncome += row.amount;
          }
          if (row.paymentMethod === "transfer") {
            result.transferIncome += row.amount;
            result.cashInflow += row.amount;
          }
        }
      } else if (row.kind === "expense") {
        result.expenseCount += 1;
        if (!row.economicEffect) {
          if (row.operationLabel === operationLabels.inventory_purchase) {
            result.assetPurchaseCash += row.amount;
          } else {
            result.liabilityPaymentCash += row.amount;
          }
        } else if (row.recognizedExpense) {
          result.documentedExpense += row.amount;
        } else {
          result.undocumentedOutflow += row.amount;
        }
        if (
          row.cashEffect &&
          row.operationLabel !== operationLabels.pos_commission
        ) {
          result.cashOutflow += row.amount;
        }
      } else if (row.kind === "withdrawal") {
        result.withdrawalCount += 1;
        result.withdrawals += row.amount;
        if (row.cashEffect) result.cashOutflow += row.amount;
      }
      return result;
    },
    {
      rowCount: rows.length,
      incomeCount: 0,
      expenseCount: 0,
      withdrawalCount: 0,
      income: 0,
      documentedExpense: 0,
      undocumentedOutflow: 0,
      withdrawals: 0,
      cashIncome: 0,
      cardIncome: 0,
      transferIncome: 0,
      collectionCash: 0,
      liabilityPaymentCash: 0,
      assetPurchaseCash: 0,
      cashInflow: posSettlementCash,
      cashOutflow: 0,
    },
  );

  for (const key of [
    "income",
    "documentedExpense",
    "undocumentedOutflow",
    "withdrawals",
    "cashIncome",
    "cardIncome",
    "transferIncome",
    "collectionCash",
    "liabilityPaymentCash",
    "assetPurchaseCash",
    "cashInflow",
    "cashOutflow",
  ]) {
    summary[key] = roundMoney(summary[key]);
  }
  summary.cashMovement = roundMoney(summary.cashInflow - summary.cashOutflow);

  return {
    startDate,
    endDate,
    scope,
    rows,
    summary,
  };
}

function safeSpreadsheetText(value) {
  const text = String(value ?? "");
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value, kind) {
  let text;
  if (kind === "money") {
    text = Number(value ?? 0).toFixed(2).replace(".", ",");
  } else if (kind === "percent") {
    text = `${(Number(value ?? 0) * 100).toFixed(2).replace(".", ",")}%`;
  } else if (kind === "number") {
    text = String(Number(value ?? 0));
  } else {
    text = safeSpreadsheetText(value);
  }
  return `"${String(text).replaceAll('"', '""')}"`;
}

export function buildCsv(exportData) {
  const header = EXPORT_COLUMNS.map((column) => csvCell(column.label)).join(";");
  const body = exportData.rows.map((row) =>
    EXPORT_COLUMNS.map((column) =>
      csvCell(row[column.key], column.kind),
    ).join(";"),
  );
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function xlsxCell(value, columnIndex, rowIndex, kind, styleOverride) {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  if (value === null || value === undefined || value === "") {
    return `<c r="${ref}"${styleOverride ? ` s="${styleOverride}"` : ""}/>`;
  }
  if (kind === "number" || kind === "money" || kind === "percent") {
    const style =
      styleOverride ?? (kind === "money" ? 2 : kind === "percent" ? 3 : 0);
    return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${styleOverride ? ` s="${styleOverride}"` : ""}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml(columns, rows, options = {}) {
  const columnXml = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 16}" customWidth="1"/>`,
    )
    .join("");
  const header = `<row r="1" ht="24" customHeight="1">${columns
    .map((column, index) =>
      xlsxCell(column.label, index, 1, "text", 1),
    )
    .join("")}</row>`;
  const dataRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 2}">${columns
          .map((column, columnIndex) =>
            xlsxCell(
              row[column.key],
              columnIndex,
              rowIndex + 2,
              column.kind,
            ),
          )
          .join("")}</row>`,
    )
    .join("");
  const lastColumn = columnName(Math.max(columns.length - 1, 0));
  const lastRow = Math.max(rows.length + 1, 1);
  const filter = options.autoFilter
    ? `<autoFilter ref="A1:${lastColumn}${lastRow}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columnXml}</cols>
  <sheetData>${header}${dataRows}</sheetData>
  ${filter}
</worksheet>`;
}

function summaryRows(exportData) {
  const { summary } = exportData;
  return [
    { label: "Dönem", value: `${exportData.startDate} – ${exportData.endDate}` },
    {
      label: "Kapsam",
      value:
        exportData.scope === "income"
          ? "Gelirler"
          : exportData.scope === "outflows"
            ? "Giderler ve kasa çıkışları"
            : "Tüm finansal hareketler",
    },
    { label: "Toplam kayıt", value: summary.rowCount, kind: "number" },
    { label: "Brüt gelir", value: summary.income, kind: "money" },
    {
      label: "Belgeli gider",
      value: summary.documentedExpense,
      kind: "money",
    },
    {
      label: "Belgesiz çıkış",
      value: summary.undocumentedOutflow,
      kind: "money",
    },
    { label: "Kasa çekimi", value: summary.withdrawals, kind: "money" },
    {
      label: "Alacak tahsilatı (satış değildir)",
      value: summary.collectionCash,
      kind: "money",
    },
    {
      label: "Borç ödemesi (gider değildir)",
      value: summary.liabilityPaymentCash,
      kind: "money",
    },
    {
      label: "Stok alımı (varlık/para hareketi)",
      value: summary.assetPurchaseCash,
      kind: "money",
    },
    {
      label: "Dönem nakit hareketi",
      value: summary.cashMovement,
      kind: "money",
    },
    { label: "Nakit gelir", value: summary.cashIncome, kind: "money" },
    { label: "Kart / POS geliri", value: summary.cardIncome, kind: "money" },
    { label: "Havale geliri", value: summary.transferIncome, kind: "money" },
    {
      label: "Muhasebe notu",
      value:
        "Belgesiz çıkışlar gider ve indirilecek KDV hesabına alınmaz. Bu dosya yönetim raporudur; beyanname değildir.",
    },
  ];
}

function summaryWorksheetXml(exportData) {
  const rows = summaryRows(exportData);
  const dataRows = rows
    .map(
      (row, index) =>
        `<row r="${index + 1}">${xlsxCell(
          row.label,
          0,
          index + 1,
          "text",
          1,
        )}${xlsxCell(
          row.value,
          1,
          index + 1,
          row.kind,
        )}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols><col min="1" max="1" width="26" customWidth="1"/><col min="2" max="2" width="72" customWidth="1"/></cols>
  <sheetData>${dataRows}</sheetData>
</worksheet>`;
}

function uint16(value) {
  return Uint8Array.of(value & 255, (value >>> 8) & 255);
}

function uint32(value) {
  return Uint8Array.of(
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  );
}

function concatBytes(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content =
      typeof file.content === "string"
        ? encoder.encode(file.content)
        : file.content;
    const crc = crc32(content);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(content.length),
      uint32(content.length),
      uint16(name.length),
      uint16(0),
      name,
    ]);
    localParts.push(localHeader, content);

    const centralHeader = concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(content.length),
      uint32(content.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      name,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + content.length;
  }

  const central = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(central.length),
    uint32(localOffset),
    uint16(0),
  ]);
  return concatBytes([...localParts, central, end]);
}

function workbookFiles(exportData) {
  const sheets = [
    {
      name: "Özet",
      xml: summaryWorksheetXml(exportData),
    },
  ];
  if (exportData.scope === "all") {
    sheets.push(
      {
        name: "Tüm Hareketler",
        xml: worksheetXml(EXPORT_COLUMNS, exportData.rows, {
          autoFilter: true,
        }),
      },
      {
        name: "Gelirler",
        xml: worksheetXml(
          EXPORT_COLUMNS,
          exportData.rows.filter((row) => row.kind === "income"),
          { autoFilter: true },
        ),
      },
      {
        name: "Giderler",
        xml: worksheetXml(
          EXPORT_COLUMNS,
          exportData.rows.filter((row) => row.kind !== "income"),
          { autoFilter: true },
        ),
      },
    );
  } else {
    sheets.push({
      name: exportData.scope === "income" ? "Gelirler" : "Giderler",
      xml: worksheetXml(EXPORT_COLUMNS, exportData.rows, {
        autoFilter: true,
      }),
    });
  }

  const sheetEntries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  const relEntries = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");

  return [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${overrides}
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries}</sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relEntries}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 [$₺-tr-TR]"/></numFmts>
  <fonts count="2">
    <font><sz val="10"/><name val="Aptos"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheet.xml,
    })),
  ];
}

export function buildXlsx(exportData) {
  return zipStored(workbookFiles(exportData));
}

export function buildExportFilename(exportData, extension) {
  const scope = scopeLabels[exportData.scope] ?? scopeLabels.all;
  return `elci-klinik-${scope}-${exportData.startDate}-${exportData.endDate}.${extension}`;
}
