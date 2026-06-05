import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock amélioré d'exceljs pour simuler les comportements nominaux et les pannes
vi.mock("exceljs", () => {
  class Worksheet {
    constructor() {
      this.rows = [];
    }

    addRow = vi.fn((values) => {
      this.rows.push(values);
    });

    getRow = vi.fn((rowNumber) => ({
      eachCell: (cb) => {
        if (rowNumber !== 1) return;
        // En-têtes par défaut retournés pour les tests nominaux de tableurs
        const headers = ["augend", "addend", "result", "time", "session"];
        headers.forEach((value, index) => cb({ value }, index + 1));
      },
    }));

    eachRow = vi.fn((cb) => {
      const row = {
        eachCell: (cellCb) => {
          const values = ["A", 1, "B", 100, 1];
          values.forEach((value, index) => cellCb({ value }, index + 1));
        },
      };
      cb(row, 2);
    });
  }

  class Workbook {
    constructor() {
      this._worksheet = new Worksheet();
      this.xlsx = {
        load: vi.fn(async (buffer) => {
          // Déclencheur factice pour simuler un fichier corrompu (longueur spécifique)
          if (buffer && buffer.byteLength === 999) {
            throw new Error("Fichier corrompu ou illisible");
          }
        }),
        writeBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
      };
      this.csv = {
        writeBuffer: vi.fn(async () => new Uint8Array([4, 5, 6])),
      };
    }

    addWorksheet() {
      return this._worksheet;
    }

    getWorksheet() {
      return this._worksheet;
    }
  }

  return {
    default: {
      Workbook,
    },
  };
});

// Helpers de génération de fichiers pour l'environnement de test
const buildJsonFile = (payload, name = "data.json") =>
  new File([JSON.stringify(payload)], name, { type: "application/json" });

const buildBinaryFile = (name, size = 2) => 
  new File([new Uint8Array(size)], name);

const setupCreateElementSpy = () => {
  const originalCreateElement = document.createElement.bind(document);
  return vi.spyOn(document, "createElement").mockImplementation((tag) => {
    const element = originalCreateElement(tag);
    if (tag === "input" || tag === "a") {
      element.click = vi.fn();
    }
    return element;
  });
};

describe("useDataIO - Suite Globale de Tests Unitaires", () => {
  let alertSpy;
  let createElementSpy;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    createElementSpy = setupCreateElementSpy();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 14, 34, 56)); // Fixe le timestamp d'export au 2026-05-20

    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:mock");
    } else {
      vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mock");
    }

    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn(() => {});
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    alertSpy.mockRestore();
    createElementSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ==========================================
  // SECTION : IMPORTATION DE DONNÉES (JSON)
  // ==========================================
  describe("Importation de données - JSON", () => {
    it("importe les données JSON et mappe correctement les lignes", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };
      const onStart = vi.fn();
      const onDone = vi.fn();

      importData(targetRef, { onStart, onDone });

      const input = createElementSpy.mock.results.find(
        (result) => result.value?.tagName === "INPUT"
      ).value;

      await input.onchange({
        target: {
          files: [
            buildJsonFile([
              { Augend: "A", Addend: 1, Result: "B", Time: 100, Session: 1 }
            ]),
          ],
        },
      });

      expect(onStart).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalled();
      expect(targetRef.value).toHaveLength(1);
      expect(targetRef.value[0]).toEqual({
        id: 1,
        augend: "A",
        addend: 1,
        result: "B",
        time: 100,
        session: 1
      });
    });

    it("gère l'importation via une enveloppe d'objet de type { data: [...] }", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);

      const input = createElementSpy.mock.results.find(
        (result) => result.value?.tagName === "INPUT"
      ).value;

      await input.onchange({
        target: {
          files: [buildJsonFile({ data: [{ augend: "A", addend: 1, result: "B", time: 120, session: 2 }] })],
        },
      });

      expect(targetRef.value).toHaveLength(1);
      expect(targetRef.value[0].session).toBe(2);
    });

    it("applique la valeur 1 par défaut si le champ 'session' n'est pas fourni", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);

      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;
      await input.onchange({
        target: {
          files: [buildJsonFile([{ augend: "C", addend: 4, result: "G", time: 350 }])], // Pas de champ session
        },
      });

      expect(targetRef.value).toHaveLength(1);
      expect(targetRef.value[0].session).toBe(1);
    });

    it("tolère les alias complexes avec accents et espaces (ex: 'Résultat', 'Équation.RT  ')", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      await input.onchange({
        target: {
          files: [
            buildJsonFile([
              {
                "augend": "M",
                "addend": 2,
                "Résultat ": "O", // Test de nettoyage d'accent et d'espace de normalizeKey
                "Équation.RT  ": 450 // Doit matcher l'alias 'equation.rt' après normalisation
              }
            ])
          ]
        }
      });

      expect(targetRef.value).toHaveLength(1);
      expect(targetRef.value[0].result).toBe("O");
      expect(targetRef.value[0].time).toBe(450);
    });

    it("isole et supprime les lignes invalides sans altérer les lignes correctes", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      await input.onchange({
        target: {
          files: [
            buildJsonFile([
              { augend: "A", addend: 1, result: "B", time: 100 }, // Valide
              { augend: "X", addend: 2, result: "Z" },           // Invalide (time manquant)
              { augend: "B", addend: 3, result: "E", time: 150 }  // Valide
            ])
          ]
        }
      });

      expect(targetRef.value).toHaveLength(2);
      expect(targetRef.value[0].id).toBe(1);
      expect(targetRef.value[1].id).toBe(3); // Conserve l'index d'origine (+1)
    });

    it("alerte l'utilisateur si la structure JSON n'est ni un tableau ni une enveloppe valide", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      await input.onchange({
        target: {
          files: [buildJsonFile({ randomKey: "randomValue" })] // Format invalide
        }
      });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Aucune ligne valide trouvée"));
    });

    it("interrompt proprement et alerte si le parsing du fichier JSON échoue", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };
      const onDone = vi.fn();

      importData(targetRef, { onDone });
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      const corruptJsonFile = new File(["{ malformed json "], "bad.json", { type: "application/json" });
      await input.onchange({ target: { files: [corruptJsonFile] } });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Erreur pendant la lecture du fichier importe"));
      expect(onDone).toHaveBeenCalled();
    });
  });

  // ==========================================
  // SECTION : IMPORTATION (TABLEURS / BLOCS GENERAL)
  // ==========================================
  describe("Importation de données - Tableurs et validations générales", () => {
    it("annule proprement l'importation si l'utilisateur ferme la fenêtre sans choisir de fichier", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };
      const onDone = vi.fn();

      importData(targetRef, { onDone });
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      await input.onchange({ target: { files: [] } });

      expect(onDone).toHaveBeenCalled();
      expect(targetRef.value).toEqual([]);
    });

    it("bloque le traitement et alerte si le format de fichier choisi n'est pas pris en charge", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };
      const onDone = vi.fn();

      importData(targetRef, { onDone });
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      await input.onchange({ target: { files: [buildBinaryFile("doc.pdf")] } });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Format non supporté"));
      expect(onDone).toHaveBeenCalled();
    });

    it("déclenche correctement le parseur ExcelJS lors de la sélection d'un tableur (.xlsx)", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      await input.onchange({ target: { files: [buildBinaryFile("stimuli.xlsx")] } });

      expect(targetRef.value).toHaveLength(1);
      expect(targetRef.value[0].augend).toBe("A");
    });

    it("intercepte les pannes de lecture ExcelJS et lève une alerte explicite", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { importData } = useDataIO();
      const targetRef = { value: [] };

      importData(targetRef);
      const input = createElementSpy.mock.results.find((r) => r.value?.tagName === "INPUT").value;

      // Taille arbitraire de 999 octets configurée dans le mock pour forcer un rejet
      await input.onchange({ target: { files: [buildBinaryFile("broken.xlsx", 999)] } });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Erreur pendant la lecture du fichier importe : Fichier corrompu"));
    });
  });

  // ==========================================
  // SECTION : EXPORTATION DE TABLEAUX
  // ==========================================
  describe("Exportation de données", () => {
    it("génère et télécharge un fichier JSON avec le nom complet daté", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      await exportTable([{ item: "test" }], { format: "json", filename: "simulation" });

      expect(URL.createObjectURL).toHaveBeenCalled();
      const anchor = createElementSpy.mock.results.find((r) => r.value?.tagName === "A").value;
      expect(anchor.download).toBe("simulation-20260520-143456.json");
    });

    it("accepte les extensions saisies en majuscules sans générer d'anomalie (Casse insensible)", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      await exportTable([{ data: 123 }], { format: "JSON", filename: "casse_test" });
      const anchor = createElementSpy.mock.results.find((r) => r.value?.tagName === "A").value;
      expect(anchor.download).toBe("casse_test-20260520-143456.json");
    });

    it("génère automatiquement les en-têtes d'exportation basés sur les clés si la configuration 'columns' est omise", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      // Export au format XLSX sans injecter la configuration des colonnes
      await exportTable([{ autoKeyA: "val1", autoKeyB: "val2" }], { format: "xlsx", filename: "auto_columns" });

      const anchor = createElementSpy.mock.results.find((r) => r.value?.tagName === "A").value;
      expect(anchor.download).toBe("auto_columns-20260520-143456.xlsx");
    });

    it("génère et télécharge correctement un classeur au format XLSX avec des colonnes explicitement configurées", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      const columnsConfig = [{ key: "score", label: "Note Globale" }];
      await exportTable([{ score: 18 }], { format: "xlsx", filename: "rapport", columns: columnsConfig });

      const anchor = createElementSpy.mock.results.find((r) => r.value?.tagName === "A").value;
      expect(anchor.download).toBe("rapport-20260520-143456.xlsx");
    });

    it("génère et exporte des fichiers au format texte séparé par des virgules (CSV)", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      await exportTable([{ row: 1 }], { format: "csv", filename: "export_brut" });

      const anchor = createElementSpy.mock.results.find((r) => r.value?.tagName === "A").value;
      expect(anchor.download).toBe("export_brut-20260520-143456.csv");
    });

    it("bloque le processus et alerte si le format d'exportation demandé est incorrect ou non répertorié", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      await exportTable([{ item: 1 }], { format: "xml" });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Format non supporté pour l'export"));
    });

    it("refuse de lancer l'exportation et alerte si le tableau de lignes fourni est vide", async () => {
      const { useDataIO } = await import("../useDataIO.js");
      const { exportTable } = useDataIO();

      await exportTable([], { format: "json" });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Aucune donnée à exporter"));
    });
  });

  it("déclenche une alerte si la liste des lignes à exporter est vide", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    // Test avec tableau vide
    await exportTable([], { format: "xlsx" });
    expect(alertSpy).toHaveBeenCalledWith("Aucune donnée à exporter.");

    alertSpy.mockRestore();
  });

  it("déclenche une alerte si le format d'export fourni n'est pas supporté", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    await exportTable([{ value: 1 }], { format: "pdf" });
    expect(alertSpy).toHaveBeenCalledWith("Format non supporté pour l'export.");

    alertSpy.mockRestore();
  });
});