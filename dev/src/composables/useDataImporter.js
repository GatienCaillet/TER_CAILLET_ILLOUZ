import ExcelJS from "exceljs";

// Detection des noms des colonnes pour les données importées
const COLUMN_ALIASES = {
  augend: ["augend"],
  addend: ["addend"],
  result: ["result", "resultat", "résultat", "reponse", "response"],
  time: ["time", "temps", "equation.rt", "equation_response_time"],
  session: ["session"],
};

// On normalise les clés pour faciliter la détection (ex: "Augend ", "augend", "AUGEND" seront tous reconnus comme "augend")
const normalizeKey = (key) =>
  String(key)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

    // Recuperation des données en fonction des alias des colonnes
const getValueByAliases = (row, aliases) => {
  const rowEntries = Object.entries(row);

  for (const [key, value] of rowEntries) {
    if (aliases.includes(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
};

// Organisation des données importées dans le format du tableau attendu par le modèle
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

// Import JSON
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

// Import Excel/CSV
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
  
  // Extraction des entêtes
  headerRow.eachCell((cell) => {
    headers.push(cell.value);
  });

  // Conversion des lignes en objets
  firstWorksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Ignorer la première ligne (entêtes)
    
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

// TODO : dictionnaire des stimuli possibles
export function useDataImporter() {
  const importEquations = (targetRef) => {
    console.log("Logique d'importation des équations en cours...");
    // Simulation : on remplit la ref avec des données après un délai
    setTimeout(() => {
      targetRef.value = [
        { id: 1, augend: "A", addend: 2, result: "C" },
        { id: 2, augend: "B", addend: 4, result: "E" },
        { id: 3, augend: "C", addend: 2, result: "E" },
      ];
    }, 500);
  };

  // Import des données à partir d'un fichier Excel ou JSON
  const importData = async (targetRef) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv,.json";

    input.onchange = async (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      // On vérifie l'extension du fichier pour déterminer comment le lire
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows = [];

      try {
        if (extension === "json") {
          rows = await parseJsonRows(file);
        } else if (["xlsx", "xls", "csv"].includes(String(extension))) {
          rows = await parseSpreadsheetRows(file);
        } else {
          console.warn("Format non supporté. Utilisez .xlsx, .xls, .csv ou .json.");
          return;
        }
      } catch (error) {
        console.error("Erreur pendant la lecture du fichier importé:", error);
        return;
      }

      // On mappe les lignes importées pour les organiser dans le format attendu par le modèle
      const mappedRows = rows
        .map((row, index) => mapRowToImportedData(row, index))
        .filter((row) => row !== null);

      if (!mappedRows.length) {
        console.warn(
          "Aucune ligne valide trouvée. Colonnes requises: augend, addend, result, time, session.",
        );
        return;
      }

      targetRef.value = mappedRows;
    };

    input.click();
  };

  return {
    importEquations,
    importData,
  };
}
