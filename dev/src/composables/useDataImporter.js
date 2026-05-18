import ExcelJS from "exceljs";

// Noms de colonnes acceptés pour reconnaître les données importées
const COLUMN_ALIASES = {
  augend: ["augend"],
  addend: ["addend"],
  result: ["result", "resultat", "résultat", "reponse", "response"],
  time: ["time", "temps", "equation.rt", "equation_response_time"],
  session: ["session"],
};

// Normalise une clé pour faciliter la détection, peu importe la casse ou les accents
const normalizeKey = (key) =>
  String(key)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Récupère une valeur dans une ligne en cherchant un nom de colonne connu
const getValueByAliases = (row, aliases) => {
  const rowEntries = Object.entries(row);

  for (const [key, value] of rowEntries) {
    if (aliases.includes(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
};

// Transforme une ligne brute en format exploitable par le modèle
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
    time === undefined ||
    session === undefined
  ) {
    return null;
  }

  return {
    id: index + 1,
    augend: String(augend).trim(),
    addend: Number(addend),
    result: String(result).trim(),
    time: Number(time),
    session: Number(session),
  };
};

// Lit un fichier JSON et extrait les données sous forme de tableau d'objets
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

// Lit un fichier Excel ou CSV et extrait les données de la première feuille sous forme de tableau d'objets
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

  // La première ligne est traitée comme les en-têtes de colonnes
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

// Service d'import utilisé par l'application principale
export function useDataImporter() {

  // Ouvre un sélecteur de fichier puis lit les données importées et les transforme pour correspondre au modèle de l'application
  const importData = async (targetRef, callbacks = {}) => {
    const { onStart, onDone } = callbacks;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv,.json";

    input.onchange = async (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        onDone?.();
        return;
      }

      onStart?.();

      // Le type de fichier détermine le lecteur à utiliser
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows = [];

      try {
        if (extension === "json") {
          rows = await parseJsonRows(file);
        } else if (["xlsx", "xls", "csv"].includes(String(extension))) {
          rows = await parseSpreadsheetRows(file);
        } else {
          console.warn("Format non supporté. Utilisez .xlsx, .xls, .csv ou .json.");
          onDone?.();
          return;
        }
      } catch (error) {
        console.error("Erreur pendant la lecture du fichier importé:", error);
        onDone?.();
        return;
      }

      // Les lignes brutes sont normalisées pour correspondre au modèle
      const mappedRows = rows
        .map((row, index) => mapRowToImportedData(row, index))
        .filter((row) => row !== null);

      if (!mappedRows.length) {
        console.warn(
          "Aucune ligne valide trouvée. Colonnes requises: augend, addend, result, time, session.",
        );
        onDone?.();
        return;
      }

      targetRef.value = mappedRows;
      onDone?.();
    };

    input.click();
  };

  return {
    importData
  };
}
