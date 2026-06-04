import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../App.vue";

// Mock du composable de gestion des entrées/sorties de fichiers
vi.mock("../composables/useDataIO.js", () => ({
  useDataIO: () => ({
    importData: vi.fn((dataRef, callbacks) => {
      callbacks?.onStart?.();
      dataRef.value = [
        { id: 1, augend: "A", addend: 2, result: "C", session: 1, time: 450 }
      ];
      callbacks?.onDone?.();
    }),
    exportTable: vi.fn(),
  }),
}));

// Mock de l'alerte Bootstrap
vi.mock("bootstrap/dist/js/bootstrap.bundle", () => ({
  Alert: class {},
}));

describe("App.vue - Suite de Tests Exhaustive", () => {
  let randomSpy;
  let alertSpy;
  let confirmSpy;

  // Algorithme de génération d'équations identique à celui du worker de production
  const shuffleInPlace = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const ensureNoConsecutiveAugends = (items, previousAugend = null) => {
    if (items.length === 0) return items;

    if (previousAugend !== null && items[0].augend === previousAugend) {
      const swapIndex = items.findIndex((item, idx) => idx > 0 && item.augend !== previousAugend);
      if (swapIndex !== -1) {
        [items[0], items[swapIndex]] = [items[swapIndex], items[0]];
      }
    }

    for (let i = 1; i < items.length; i += 1) {
      if (items[i].augend !== items[i - 1].augend) continue;
      const swapIndex = items.findIndex((item, idx) => idx > i && item.augend !== items[i - 1].augend);
      if (swapIndex === -1) return items;
      [items[i], items[swapIndex]] = [items[swapIndex], items[i]];
    }
    return items;
  };

  const generateEquations = (payload) => {
    const { selectedAugends = [], selectedAddends = [], sessionsCount = 0, repetitionCount = 0 } = payload || {};
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
          combinations.push({ augend, addend: parseInt(addend, 10), result });
        }
      });
    });

    let previousAugend = null;
    for (let session = 1; session <= sessionsCount; session += 1) {
      const shuffledCombinations = ensureNoConsecutiveAugends(shuffleInPlace([...combinations]), previousAugend);
      shuffledCombinations.forEach((combination) => {
        generatedEquations.push({
          id: id++,
          augend: combination.augend,
          addend: combination.addend,
          result: combination.result,
          session,
        });
      });
      previousAugend = shuffledCombinations[shuffledCombinations.length - 1]?.augend ?? previousAugend;
    }
    return generatedEquations;
  };

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);
    alertSpy = vi.stubGlobal("alert", vi.fn());
    confirmSpy = vi.stubGlobal("confirm", vi.fn(() => true));

    // Simulation et intégration globale des tests de Workers (Equation, Estimation, Model)
    class WorkerStub {
      constructor(url) {
        this.url = url?.toString() || "";
        this.onmessage = null;
        this.onerror = null;
      }
      terminate() {}
      postMessage(message) {
        if (!message) return;

        // 1. Simulation du Equation Worker
        if (message.type === "generate") {
          if (message.payload.selectedAugends.includes("TRIGGER_ERROR")) {
            this.onmessage?.({ data: { type: "error", message: "Erreur critique de génération" } });
          } else {
            const result = generateEquations(message.payload);
            this.onmessage?.({ data: { type: "result", result } });
          }
        }
        
        // 2. Simulation du Estimation Worker
        if (message.type === "estimate") {
          // Simulation de l'envoi de la progression globale
          this.onmessage?.({ data: { type: "progress", current: 50, total: 100 } });
          
          const evaluations = [
            { score: 0.01234, paramsEstim: { alpha: 10, beta: 500, delta: 200, eta: 100, tau: 3000, rho: 40 } }
          ];
          const bestParams = { alpha: 10, beta: 500, delta: 200, eta: 100, tau: 3000, rho: 40 };
          
          this.onmessage?.({ data: { type: "result", result: { bestParams, evaluations } } });
        }

        // 3. Simulation du Model Worker
        if (message.type === "runModel") {
          this.onmessage?.({ data: { type: "progress", current: 1, total: 1 } });
          
          const results = [
            { augend: "A", addend: 2, result: "C", method: "counting", time: 120.6, session: 1 },
            { augend: "B", addend: 3, result: "E", method: "retrieval", time: 85.1, session: 1 },
            { augend: "C", addend: 4, result: "G", method: "error", time: null, session: 2 }
          ];
          
          this.onmessage?.({
            data: {
              type: "result",
              result: { results, practice: { A: 1, B: 1 }, associations: { "A+2": 1 } }
            }
          });
        }
      }
    }
    vi.stubGlobal("Worker", WorkerStub);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const createParamsFormMock = () => ({
    resetParams: vi.fn(),
    setParamsEstim: vi.fn()
  });

  // --- COMPORTEMENTS ET PARSERS D'ADDENDS PERSONNALISÉS ---
  describe("Gestion des Addends Personnalisés", () => {
    it("ajoute correctement un addend personnalisé valide", async () => {
      const wrapper = mount(App);
      wrapper.vm.customAddendValue = "8";
      
      wrapper.vm.addCustomAddend();
      
      expect(wrapper.vm.customAddends).toContain("8");
      expect(wrapper.vm.selectedAddends).toContain("8");
      expect(wrapper.vm.customAddendValue).toBe("");
      expect(wrapper.vm.showAddendInput).toBe(false);
    });

    it("bloque et alerte si l'addend saisi est inférieur à 6 ou invalide", async () => {
      const wrapper = mount(App);
      wrapper.vm.customAddendValue = "4";
      
      wrapper.vm.addCustomAddend();
      
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("entier supérieur ou égal à 6"));
      expect(wrapper.vm.customAddends).not.toContain("4");
    });

    it("bloque et alerte si l'addend est déjà présent dans la liste", async () => {
      const wrapper = mount(App);
      wrapper.vm.customAddendValue = "3"; // Déjà présent dans defaultAddends ("2","3","4","5")
      
      wrapper.vm.addCustomAddend();
      
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("déjà dans la liste"));
    });
  });

  // --- ACTIONS DE NETTOYAGE DES DONNÉES ---
  describe("Nettoyage de l'état (Clear Tables)", () => {
    it("vide correctement la liste des équations générées", async () => {
      const wrapper = mount(App);
      wrapper.vm.equations = [{ id: 1, augend: "A" }];
      
      wrapper.vm.handleClearTable("equations");
      
      expect(wrapper.vm.equations).toEqual([]);
    });

    it("vide correctement la liste des données importées", async () => {
      const wrapper = mount(App);
      wrapper.vm.data = [{ id: 1, augend: "B" }];
      
      wrapper.vm.handleClearTable("data");
      
      expect(wrapper.vm.data).toEqual([]);
    });
  });

  // --- CALCULS ET VALIDATIONS DES COMPUTES ---
  describe("Propriétés calculées (Computed Conditions)", () => {
    it("identifie les combinaisons d'équations invalides dépassant la lettre Z", async () => {
      const wrapper = mount(App);
      wrapper.vm.selectedAugends = ["Y", "X"]; 
      wrapper.vm.selectedAddends = ["3"]; // Y(24) + 3 = 27 > 25 (Z), X(23) + 3 = 26 > 25 (Z)
      
      expect(wrapper.vm.invalidCombinations).toContain("Y + 3");
      expect(wrapper.vm.invalidCombinations).toContain("X + 3");
    });

    it("gère dynamiquement les autorisations de défilement (Snap Scroll navigation)", async () => {
      const wrapper = mount(App);
      wrapper.vm.dataResults = []; // hasResults = false -> 2 sections au total
      
      wrapper.vm.currentSectionIndex = 0;
      expect(wrapper.vm.canGoUp).toBe(false);
      expect(wrapper.vm.canGoDown).toBe(true);

      wrapper.vm.currentSectionIndex = 1;
      expect(wrapper.vm.canGoUp).toBe(true);
      expect(wrapper.vm.canGoDown).toBe(false);
    });
  });

  // --- INTÉGRATION DE L'EQUATION WORKER ---
  describe("Génération d'équations via Worker", () => {
    it("évite les augends identiques consécutifs quand c'est possible", async () => {
      const wrapper = mount(App);
      wrapper.vm.paramsForm = createParamsFormMock();
      wrapper.vm.selectedAugends = ["A", "B"];
      wrapper.vm.selectedAddends = ["2", "3"];
      wrapper.vm.numSessions = 2;
      wrapper.vm.numRep = 2;

      await wrapper.vm.handleGenerateEquations();

      const augends = wrapper.vm.equations.map((row) => row.augend);
      const hasConsecutiveSame = augends.some((value, index) => index > 0 && value === augends[index - 1]);
      expect(hasConsecutiveSame).toBe(false);
    });

    it("autorise les doublons consécutifs quand c'est inévitable", async () => {
      const wrapper = mount(App);
      wrapper.vm.paramsForm = createParamsFormMock();
      wrapper.vm.selectedAugends = ["X"];
      wrapper.vm.selectedAddends = ["2", "3"];
      wrapper.vm.numSessions = 1;
      wrapper.vm.numRep = 2;

      await wrapper.vm.handleGenerateEquations();

      const augends = wrapper.vm.equations.map((row) => row.augend);
      expect(new Set(augends)).toEqual(new Set(["X"]));
      const hasConsecutiveSame = augends.some((value, index) => index > 0 && value === augends[index - 1]);
      expect(hasConsecutiveSame).toBe(true);
    });

    it("interrompt le traitement et alerte si le Worker retourne une erreur", async () => {
      const wrapper = mount(App);
      wrapper.vm.selectedAugends = ["TRIGGER_ERROR"];
      wrapper.vm.selectedAddends = ["2"];
      
      await expect(wrapper.vm.handleGenerateEquations()).rejects.toThrow("Erreur critique de génération");
    });
  });

  // --- INTÉGRATION DU PARAMS ESTIMATION WORKER ---
  describe("Estimation des Paramètres via Worker", () => {
    it("refuse l'estimation et alerte si aucune donnée n'est chargée", async () => {
      const wrapper = mount(App);
      wrapper.vm.data = []; // Aucun stimulus importé
      
      await wrapper.vm.handleLaunchEstimation({
        paramsInit: {}, paramsEstim: {}, maxCombinations: 100, maxRandomSamples: 10, estimationMode: "grid"
      });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Aucun stimulus importé"));
      expect(wrapper.vm.isEstimating).toBe(false);
    });

    it("déclenche correctement l'estimation, reçoit la progression et met à jour les scores", async () => {
      const wrapper = mount(App);
      wrapper.vm.paramsForm = createParamsFormMock();
      // Injection de données simulées
      wrapper.vm.data = [{ id: 1, augend: "A", addend: 2, result: "C", session: 1, time: 500 }];

      await wrapper.vm.handleLaunchEstimation({
        paramsInit: {},
        paramsEstim: { alpha: { enabled: true, min: 0, max: 10, pas: 1 } },
        maxCombinations: 5000,
        maxRandomSamples: 100,
        estimationMode: "grid"
      });

      // Vérification de la transmission des meilleurs paramètres au formulaire enfant
      expect(wrapper.vm.paramsForm.setParamsEstim).toHaveBeenCalled();
      expect(wrapper.vm.bestEstimatedParams).not.toBeNull();
      expect(wrapper.vm.estimationResultsRows.length).toBeGreaterThan(0);
      expect(wrapper.vm.estimationResultsRows[0].rmse).toBe(0.0123); // formaté en fixed(4)
    });
  });

  // --- INTÉGRATION DU MODEL WORKER (TEMPS PRÉDITS ET TRADUCTIONS) ---
  describe("Exécution du Modèle Mathématique via Worker", () => {
    it("exécute le modèle, convertit les temps et traduit les stratégies d'apprentissage", async () => {
      const wrapper = mount(App);
      wrapper.vm.data = [{ id: 1, augend: "A", addend: 2, result: "C", session: 1 }];
      
      await wrapper.vm.handleLaunchModel({ paramsInit: {}, paramsEstim: {} });

      expect(wrapper.vm.dataResults.length).toBe(3);
      
      // Validation des traductions et arrondis métiers
      // 1. Comptage (counting -> Comptage, 120.6 -> 121)
      expect(wrapper.vm.dataResults[0].method).toBe("Comptage");
      expect(wrapper.vm.dataResults[0].time).toBe(121);

      // 2. Récupération (retrieval -> Récupération, 85.1 -> 85)
      expect(wrapper.vm.dataResults[1].method).toBe("Récupération");
      expect(wrapper.vm.dataResults[1].time).toBe(85);

      // 3. Cas d'échec / erreur (error -> Erreur, null -> Échec)
      expect(wrapper.vm.dataResults[2].method).toBe("Erreur");
      expect(wrapper.vm.dataResults[2].time).toBe("Échec");
    });
  });

  // --- INTERFACE COMPOSABLE DATA I/O TRACERS ---
  describe("Interactions de Composable useDataIO", () => {
    it("appelle l'importation de données et réinitialise les états de résultats", async () => {
      const wrapper = mount(App);
      wrapper.vm.paramsForm = createParamsFormMock();
      wrapper.vm.dataResults = [{ id: 1 }];

      wrapper.vm.handleImportData();

      expect(wrapper.vm.data.length).toBe(1);
      expect(wrapper.vm.dataResults).toEqual([]); // Doit être vidé lors du onDone
      expect(wrapper.vm.paramsForm.resetParams).toHaveBeenCalled();
    });
  });
});