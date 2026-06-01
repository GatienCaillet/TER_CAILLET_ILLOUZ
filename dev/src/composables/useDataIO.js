import ExcelJS from "exceljs";

// Noms de colonnes acceptes pour reconnaitre les donnees importees
const COLUMN_ALIASES = {
  augend: ["augend"],
  addend: ["addend"],
  result: ["result", "resultat", "reponse", "response"],
  time: ["time", "temps", "equation.rt", "equation_response_time"],
  session: ["session"],
};

// Normalise une cle pour faciliter la detection, peu importe la casse ou les accents
const normalizeKey = (key) =>
  String(key)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Recupere une valeur dans une ligne en cherchant un nom de colonne connu
const getValueByAliases = (row, aliases) => {
  const rowEntries = Object.entries(row);
  const normalizedAliases = aliases.map(normalizeKey);

  for (const [key, value] of rowEntries) {
    if (normalizedAliases.includes(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
};

// Transforme une ligne brute en format exploitable par le modele
const mapRowToImportedData = (row, index) => {
  const augend = getValueByAliases(row, COLUMN_ALIASES.augend);
  const addend = getValueByAliases(row, COLUMN_ALIASES.addend);
  const result = getValueByAliases(row, COLUMN_ALIASES.result);
  const time = getValueByAliases(row, COLUMN_ALIASES.time);
  const session = getValueByAliases(row, COLUMN_ALIASES.session);

  if (
    augend === undefined ||
    addend === undefined ||
    result === undefined ||
    time === undefined
  ) {
    return null;
  }

  return {
    id: index + 1,
    augend: String(augend).trim(),
    addend: Number(addend),
    result: String(result).trim(),
    time: Number(time),
    session: session === undefined ? 1 : Number(session),
  };
};

// Lit un fichier JSON et extrait les donnees sous forme de tableau d'objets
const parseJsonRows = async (file) => {
  const raw = await file.text();
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && Array.isArray(parsed.data)) {
    return parsed.data;
  }

  return [];
};

// Lit un fichier Excel ou CSV et extrait les donnees de la premiere feuille sous forme de tableau d'objets
const parseSpreadsheetRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const firstWorksheet = workbook.getWorksheet(1);
  if (!firstWorksheet) {
    return [];
  }

  const rows = [];
  const headerRow = firstWorksheet.getRow(1);
  const headers = [];

  // La premiere ligne est traitee comme les en-tetes de colonnes
  headerRow.eachCell((cell) => {
    headers.push(cell.value);
  });

  // Chaque ligne du tableur est convertie en objet JavaScript.
  firstWorksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rowObject = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowObject[header] = cell.value;
      }
    });
    rows.push(rowObject);
  });

  return rows;
};

const buildExportDefinition = (rows, columns) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (columns?.length) {
    const keys = columns.map((column) => column.key);
    const headers = columns.map((column) => column.label ?? column.key);

    return { keys, headers, rows: safeRows };
  }

  const firstRow = safeRows[0] ?? {};
  const keys = Object.keys(firstRow);
  const headers = keys;

  return { keys, headers, rows: safeRows };
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const buildTimestamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
};

const exportAsSpreadsheet = async (definition, format) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("data");

  worksheet.addRow(definition.headers);
  definition.rows.forEach((row) => {
    const values = definition.keys.map((key) => row?.[key]);
    worksheet.addRow(values);
  });

  if (format === "csv") {
    const buffer = await workbook.csv.writeBuffer();
    const blob = new Blob([buffer], { type: "text/csv" });
    return { blob, extension: "csv" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const extension = "xlsx";
  const blob = new Blob([buffer], { type: mimeType });

  return { blob, extension };
};

// Service d'import/export utilise par l'application principale
export function useDataIO() {
  // Ouvre un selecteur de fichier puis lit les donnees importees et les transforme pour correspondre au modele de l'application
  const importData = async (targetRef, callbacks = {}) => {
    const { onStart, onDone } = callbacks;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.csv,.json";

    input.onchange = async (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        onDone?.();
        return;
      }

      onStart?.();

      // Le type de fichier determine le lecteur a utiliser
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows = [];

      try {
        if (extension === "json") {
          rows = await parseJsonRows(file);
        } else if (["xlsx", "csv"].includes(String(extension))) {
          rows = await parseSpreadsheetRows(file);
        } else {
          alert("Format non supporté. Utilisez .xlsx, .csv ou .json.");
          onDone?.();
          return;
        }
      } catch (error) {
        alert("Erreur pendant la lecture du fichier importe : "+ error.message);
        onDone?.();
        return;
      }

      // Les lignes brutes sont normalisees pour correspondre au modele
      const mappedRows = rows
        .map((row, index) => mapRowToImportedData(row, index))
        .filter((row) => row !== null);

      if (!mappedRows.length) {
        alert("Aucune ligne valide trouvée. Colonnes requises : Augend, Addend, Résultat, Temps (Session optionnelle).");
        onDone?.();
        return;
      }

      targetRef.value = mappedRows;
      onDone?.();
    };

    input.click();
  };

  const exportTable = async (rows, options = {}) => {
    const { columns, format = "xlsx", filename = "table" } = options;
    const normalizedFormat = String(format).toLowerCase();
    const allowedFormats = ["xlsx", "csv", "json"];
    const timestampedFilename = `${filename}-${buildTimestamp()}`;

    if (!allowedFormats.includes(normalizedFormat)) {
      alert("Format non supporté pour l'export.");
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    if (normalizedFormat === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], {
        type: "application/json",
      });
      triggerDownload(blob, `${timestampedFilename}.json`);
      return;
    }

    const definition = buildExportDefinition(rows, columns);
    const { blob, extension } = await exportAsSpreadsheet(
      definition,
      normalizedFormat,
    );

    triggerDownload(blob, `${timestampedFilename}.${extension}`);
  };

  return {
    importData,
    exportTable,
  };
}
