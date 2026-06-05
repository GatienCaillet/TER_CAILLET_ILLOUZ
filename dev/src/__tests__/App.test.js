import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../App.vue";

// Déclaration de fonctions de mock préfixées par 'mock' pour respecter les contraintes de hoisting de Vitest
const mockImportData = vi.fn();
const mockExportTable = vi.fn();

vi.mock("../composables/useDataIO.js", () => ({
  useDataIO: () => ({
    importData: mockImportData,
    exportTable: mockExportTable,
  }),
}));

vi.mock("bootstrap/dist/js/bootstrap.bundle", () => ({
  Alert: class {},
}));

describe("App - Tests Globaux de Couverture", () => {
  let randomSpy;
  let workerStub;
  let alertSpy;

  // Algorithme interne reproduit pour le Worker de test
  const shuffleInPlace = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const ensureNoConsecutiveAugends = (items, previousAugend = null) => {
    if (items.length === 0) {
      return items;
    }

    if (previousAugend !== null && items[0].augend === previousAugend) {
      const swapIndex = items.findIndex(
        (item, idx) => idx > 0 && item.augend !== previousAugend,
      );
      if (swapIndex !== -1) {
        [items[0], items[swapIndex]] = [items[swapIndex], items[0]];
      }
    }

    for (let i = 1; i < items.length; i += 1) {
      if (items[i].augend !== items[i - 1].augend) {
        continue;
      }
      const swapIndex = items.findIndex(
        (item, idx) => idx > i && item.augend !== items[i - 1].augend,
      );
      if (swapIndex === -1) {
        return items;
      }
      [items[i], items[swapIndex]] = [items[swapIndex], items[i]];
    }
    return items;
  };

  const generateEquations = (payload) => {
    const {
      selectedAugends = [],
      selectedAddends = [],
      sessionsCount = 0,
      repetitionCount = 0,
    } = payload || {};

    const generatedEquations = [];
    let id = 1;

    const combinations = [];
    selectedAugends.forEach((augend) => {
      selectedAddends.forEach((addend) => {
        const augendIndex = augend.charCodeAt(0) - 65;
        const resultIndex = augendIndex + parseInt(addend, 10);
        if (resultIndex > 25) return;

        const result = String.fromCharCode(65 + resultIndex);
        for (let rep = 1; rep <= repetitionCount; rep += 1) {
          combinations.push({
            augend,
            addend: parseInt(addend, 10),
            result,
          });
        }
      });
    });

    let previousAugend = null;
    for (let session = 1; session <= sessionsCount; session += 1) {
      const shuffledCombinations = ensureNoConsecutiveAugends(
        shuffleInPlace([...combinations]),
        previousAugend,
      );

      shuffledCombinations.forEach((combination) => {
        generatedEquations.push({
          id: id++,
          augend: combination.augend,
          addend: combination.addend,
          result: combination.result,
          session,
        });
      });

      previousAugend =
        shuffledCombinations[shuffledCombinations.length - 1]?.augend ??
        previousAugend;
    }

    return generatedEquations;
  };

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.999);
    alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    workerStub = class WorkerStub {
      constructor() {
        this.onmessage = null;
        this.onerror = null;
      }
      terminate() {}
      postMessage(message) {
        if (message?.type !== "generate") return;
        try {
          const result = generateEquations(message.payload);
          this.onmessage?.({ data: { type: "result", result } });
        } catch (error) {
          this.onmessage?.({
            data: {
              type: "error",
              message: error?.message || "Erreur inconnue",
            },
          });
        }
      }
    };
    vi.stubGlobal("Worker", workerStub);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mockImportData.mockReset();
    mockExportTable.mockReset();
  });

  // ==========================================
  // 1. TESTS DE GÉNÉRATION D'ÉQUATIONS
  // ==========================================
  describe("Génération d'équations", () => {
    it("evite les augends identiques consecutifs quand c'est possible", async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.selectedAugends = ["A", "B"];
      wrapper.vm.selectedAddends = ["2", "3"];
      wrapper.vm.numSessions = 2;
      wrapper.vm.numRep = 2;

      await wrapper.vm.handleGenerateEquations();

      const augends = wrapper.vm.equations.map((row) => row.augend);
      const hasConsecutiveSame = augends.some(
        (value, index) => index > 0 && value === augends[index - 1],
      );

      expect(hasConsecutiveSame).toBe(false);
    });

    it("autorise les doublons consecutifs quand c'est impossible (un seul augend)", async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.selectedAugends = ["X"];
      wrapper.vm.selectedAddends = ["2", "3"];
      wrapper.vm.numSessions = 1;
      wrapper.vm.numRep = 2;

      await wrapper.vm.handleGenerateEquations();

      const augends = wrapper.vm.equations.map((row) => row.augend);
      expect(augends.length).toBeGreaterThan(1);
      expect(new Set(augends)).toEqual(new Set(["X"]));

      const hasConsecutiveSame = augends.some(
        (value, index) => index > 0 && value === augends[index - 1],
      );

      expect(hasConsecutiveSame).toBe(true);
    });
  });

  // ==========================================
  // 2. PROPRIÉTÉS CALCULÉES (COMPUTED)
  // ==========================================
  describe("Propriétés calculées (Computed Properties)", () => {
    it("allAvailableAddends fusionne et trie correctement les valeurs", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      expect(wrapper.vm.allAvailableAddends).toEqual(["2", "3", "4", "5"]);

      wrapper.vm.customAddends = ["10", "1"];
      expect(wrapper.vm.allAvailableAddends).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
        "10",
      ]);
    });

    it("hasResults et totalSections reflètent l'état des résultats du modèle", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      expect(wrapper.vm.hasResults).toBe(false);
      expect(wrapper.vm.totalSections).toBe(2);

      wrapper.vm.dataResults = [{ id: 1, time: 150, method: "direct" }];
      expect(wrapper.vm.hasResults).toBe(true);
      expect(wrapper.vm.totalSections).toBe(3);
    });

    it("hasImportedData et hasGeneratedData déterminent l'origine des données de calcul", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      expect(wrapper.vm.hasImportedData).toBe(false);
      expect(wrapper.vm.hasGeneratedData).toBe(false);

      wrapper.vm.equations = [{ id: 1, augend: "A" }];
      expect(wrapper.vm.hasGeneratedData).toBe(true);

      wrapper.vm.data = [{ id: 1, time: 300 }];
      expect(wrapper.vm.hasImportedData).toBe(true);
      expect(wrapper.vm.hasGeneratedData).toBe(false);
    });

    it("tri alphabétique de practiceRows et associationRows", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.practiceMap = { C: 1, A: 4, B: 2 };
      expect(wrapper.vm.practiceRows).toEqual([
        { letter: "A", count: 4 },
        { letter: "B", count: 2 },
        { letter: "C", count: 1 },
      ]);

      wrapper.vm.associationsMap = { "B+3": 5, "A+2": 1 };
      expect(wrapper.vm.associationRows).toEqual([
        { equation: "A+2", count: 1 },
        { equation: "B+3", count: 5 },
      ]);
    });

    it("currentInputEquations renvoie prioritairement les équations générées", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.data = [{ id: 1, type: "imported" }];
      expect(wrapper.vm.currentInputEquations).toEqual([
        { id: 1, type: "imported" },
      ]);

      wrapper.vm.equations = [{ id: 2, type: "generated" }];
      expect(wrapper.vm.currentInputEquations).toEqual([
        { id: 2, type: "generated" },
      ]);
    });
  });

  // ==========================================
  // 3. MÉTHODES ET ENTRÉES/SORTIES
  // ==========================================
  describe("Gestion I/O (Import & Export)", () => {
    it("handleExportTable appelle correctement le composable associé", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      const testRows = [{ id: 1 }];
      const testCols = [{ key: "id", label: "#" }];

      wrapper.vm.handleExportTable(testRows, testCols, "export-test", "xlsx");

      expect(mockExportTable).toHaveBeenCalledWith(testRows, {
        columns: testCols,
        filename: "export-test",
        format: "xlsx",
      });
    });

    it("handleImportData configure les déclencheurs et nettoie l'état au chargement", () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.handleImportData();
      expect(mockImportData).toHaveBeenCalled();

      const [targetRef, options] = mockImportData.mock.calls[0];
      // CORRECTION : On vérifie la valeur encapsulée par la ref déballée automatiquement par wrapper.vm
      expect(targetRef.value).toBe(wrapper.vm.data);

      options.onStart();
      expect(wrapper.vm.isImportingData).toBe(true);

      wrapper.vm.dataResults = [{ old: true }];
      wrapper.vm.bestEstimatedParams = { alpha: 0.5 };

      options.onDone();
      expect(wrapper.vm.isImportingData).toBe(false);
      expect(wrapper.vm.dataResults).toEqual([]);
      expect(wrapper.vm.bestEstimatedParams).toBeNull();
    });
  });

  // ==========================================
  // 4. INTERACTIONS DOM & WATCHERS
  // ==========================================
  describe("Interactions DOM et Watchers", () => {
    it("closeEquationCollapse applique les classes et attributs Bootstrap requis", () => {
      const collapseDiv = document.createElement("div");
      collapseDiv.id = "equationParameters";
      collapseDiv.classList.add("show");

      const toggleBtn = document.createElement("button");
      toggleBtn.setAttribute("data-bs-target", "#equationParameters");
      toggleBtn.setAttribute("aria-expanded", "true");

      document.body.appendChild(collapseDiv);
      document.body.appendChild(toggleBtn);

      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.isEquationOpen = true;
      wrapper.vm.closeEquationCollapse();

      expect(collapseDiv.classList.contains("show")).toBe(false);
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
      expect(toggleBtn.classList.contains("collapsed")).toBe(true);
      expect(wrapper.vm.isEquationOpen).toBe(false);

      document.body.removeChild(collapseDiv);
      document.body.removeChild(toggleBtn);
    });

    it("ferme le panneau de configuration automatique via le watcher 'data'", async () => {
      const wrapper = mount(App, {
        attachTo: document.body,
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.isEquationOpen = true;

      wrapper.vm.data = [{ id: 1, time: 200 }];
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.isEquationOpen).toBe(false);

      wrapper.unmount();
    });
  });

  // ==========================================
  // 5. VALIDATIONS FORMULAIRES
  // ==========================================
  describe("Validations de saisies de handleGenerateEquations", () => {
    it("bloque la génération si le compte de session est invalide", async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.numSessions = 0;
      const success = await wrapper.vm.handleGenerateEquations();

      expect(alertSpy).toHaveBeenCalledWith(
        "Veuillez saisir un nombre de sessions valide (entier ≥ 1)",
      );
      expect(success).toBe(false);
    });

    it("bloque la génération si le nombre de répétitions est incorrect", async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.numSessions = 3;
      wrapper.vm.numRep = -2;
      const success = await wrapper.vm.handleGenerateEquations();

      expect(alertSpy).toHaveBeenCalledWith(
        "Veuillez saisir un nombre de répétitions valide (entier ≥ 1)",
      );
      expect(success).toBe(false);
    });

    it("interdit la validation si un addend négatif ou corrompu est sélectionné", async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            BaseDataTable: true,
            GraphicsResult: true,
            ParametersForm: true,
            BaseButton: true,
          },
        },
      });

      wrapper.vm.numSessions = 2;
      wrapper.vm.numRep = 2;
      wrapper.vm.selectedAddends = ["3", "-4"];
      const success = await wrapper.vm.handleGenerateEquations();

      expect(alertSpy).toHaveBeenCalledWith(
        "Veuillez vérifier les addends sélectionnés : certains ne sont pas des entiers valides",
      );
      expect(success).toBe(false);
    });
  });

  it("gère proprement les erreurs renvoyées par le Worker de génération", async () => {
    // On écrase temporairement le Worker global pour ce test précis
    // afin de simuler une erreur immédiate du thread
    vi.stubGlobal(
      "Worker",
      class WorkerErrorStub {
        terminate() {}
        postMessage(message) {
          if (message?.type === "generate") {
            this.onmessage?.({
              data: { type: "error", message: "Échec critique du thread" },
            });
          }
        }
      },
    );

    const wrapper = mount(App, {
      global: {
        stubs: {
          BaseDataTable: { template: "<div />" },
          GraphicsResult: { template: "<div />" },
          ParametersForm: { template: "<div />" },
          BaseButton: { template: "<button><slot /></button>" },
        },
      },
    });

    wrapper.vm.selectedAugends = ["A"];
    wrapper.vm.selectedAddends = ["2"];
    wrapper.vm.numSessions = 1;
    wrapper.vm.numRep = 1;

    // Exécute la méthode
    const result = await wrapper.vm.handleGenerateEquations();

    // Assertions
    expect(result).toBe(false); // La fonction doit retourner false en cas d'erreur
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("Échec critique du thread"),
    );
  });

  it("exécute le calcul du modèle et met à jour l'état des résultats", async () => {
    // 1. On mock le Worker spécifique au modèle pour simuler un calcul réussi
    vi.stubGlobal(
      "Worker",
      class WorkerModelStub {
        terminate() {}
        postMessage(message) {
          if (message?.type === "runModel") {
            // Simule la réponse du worker attendue par App.vue
            this.onmessage?.({
              data: {
                type: "result",
                result: {
                  results: [
                    {
                      augend: "A",
                      addend: 2,
                      result: "C",
                      session: 1,
                      time: 250,
                      method: "counting",
                    },
                  ],
                  practice: { A: 1 },
                  associations: { "A+2": 1 },
                },
              },
            });
          }
        }
      },
    );

    const wrapper = mount(App, {
      global: {
        stubs: {
          BaseDataTable: true,
          GraphicsResult: true,
          ParametersForm: true,
          BaseButton: true,
        },
      },
    });

    // 2. On injecte des données pour passer la validation (data.length > 0)
    wrapper.vm.data = [
      { id: 1, augend: "A", addend: 2, result: "C", session: 1, time: 250 },
    ];

    // 3. On appelle la BONNE méthode avec les paramètres requis
    await wrapper.vm.handleLaunchModel({
      paramsInit: { alpha: 0.1, beta: 1.5 },
      paramsEstim: { delta: 0.5 },
    });

    // 4. Vérifications
    expect(wrapper.vm.hasResults).toBe(true);
    expect(wrapper.vm.dataResults.length).toBe(1);
    expect(wrapper.vm.dataResults[0].time).toBe(250); // Le temps doit être arrondi/traité
  });
});
