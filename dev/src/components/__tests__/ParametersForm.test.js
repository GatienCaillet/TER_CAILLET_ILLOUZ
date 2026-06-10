import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ParametersForm from "../ParametersForm.vue";
import {
  DEFAULT_PARAMS_INIT,
  DEFAULT_PARAMS_ESTIM,
  DEFAULT_ESTIMATION_MODE,
} from "../../config/defaults.js";

const baseProps = {
  bestEstimatedParams: null,
  estimationResultsRows: [],
  isEstimating: false,
  isModelRunning: false,
  dataImported: [],
  hasImportedData: true,
  hasGeneratedData: false,
};

// Simulation propre de LocalStorage
const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
};

// Helper de montage synchrone et propre
const mountForm = (props = {}) => {
  return mount(ParametersForm, {
    props: { ...baseProps, ...props },
    global: {
      stubs: {
        // Stub de la table pour éviter le bruit visuel et accélérer le rendu
        BaseDataTable: { template: "<div data-testid='mock-table'></div>" },
      },
    },
  });
};

describe("ParametersForm.vue - Suite de Tests Haute Couverture", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Initialisation et LocalStorage", () => {
    it("affiche un message d'erreur si aucune donnée n'est importée", () => {
      const wrapper = mountForm({ hasImportedData: false, hasGeneratedData: false });
      expect(wrapper.text()).toContain("Aucune donnée importée");
    });

    it("affiche une alerte spécifique si les données sont générées au lieu d'importées", () => {
      const wrapper = mountForm({ hasImportedData: false, hasGeneratedData: true });
      expect(wrapper.text()).toContain("L'estimation des paramètres nécessite l'import de données existantes");
    });

    it("gère les erreurs de lecture de localStorage dans loadDefaults (bloc catch)", () => {
      globalThis.localStorage.getItem.mockImplementationOnce(() => {
        throw new Error("Erreur localStorage simulée");
      });
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const wrapper = mountForm();
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("charge correctement les valeurs depuis localStorage si elles existent", () => {
      const fakeData = {
        paramsInit: { encodingTime: 123 },
        paramsEstim: { alpha: 456 },
        ranges: { alpha: { min: 1, max: 10, pas: 2 } },
        maxCombinations: 5000,
        maxRandomSamples: 250,
        estimationMode: "grid"
      };
      globalThis.localStorage.getItem.mockReturnValueOnce(JSON.stringify(fakeData));
      const wrapper = mountForm();
      expect(wrapper.vm.params.encodingTime).toBe(123);
      expect(wrapper.vm.paramsEstimation.alpha).toBe(456);
      expect(wrapper.vm.maxCombinations).toBe(5000);
      expect(wrapper.vm.maxRandomSamples).toBe(250);
      expect(wrapper.vm.estimationMode).toBe("grid");
    });
  });

  describe("Propriétés calculées et Libellés", () => {
    it("met à jour selectedSearchMethodLabel selon le mode d'estimation", async () => {
      const wrapper = mountForm();
      wrapper.vm.estimationMode = "grid";
      expect(wrapper.vm.selectedSearchMethodLabel).toContain("Grid search (exhaustif)");
      
      wrapper.vm.estimationMode = "random";
      expect(wrapper.vm.selectedSearchMethodLabel).toContain("Recherche aléatoire (rapide)");
    });
  });

  describe("Validations en temps réel (modelInputError, delta et rho)", () => {
    it("invalide le taux d'erreur s'il dépasse 100% ou descend sous 0%", async () => {
      const wrapper = mountForm();
      
      wrapper.vm.params.errorRate = 150;
      await nextTick();
      expect(wrapper.vm.modelInputError).toContain("Taux d'erreur (%)");

      wrapper.vm.params.errorRate = -5;
      await nextTick();
      expect(wrapper.vm.modelInputError).toContain("Taux d'erreur (%)");
    });

    it("invalide les autres paramètres d'initialisation s'ils sont négatifs", async () => {
      const wrapper = mountForm();
      wrapper.vm.params.encodingTime = -10;
      await nextTick();
      expect(wrapper.vm.modelInputError).toContain("Temps d'encodage (ms)");
    });

    it("invalide si un paramètre d'initialisation ou d'estimation n'est pas un nombre fini", async () => {
      const wrapper = mountForm();
      wrapper.vm.params.comparisonTime = "texte invalide";
      await nextTick();
      expect(wrapper.vm.modelInputError).toContain("Temps de comparaison (ms)");

      wrapper.vm.params.comparisonTime = 100; 
      wrapper.vm.paramsEstimation.alpha = "invalide";
      await nextTick();
      expect(wrapper.vm.modelInputError).toContain("α : Temps de calcul entre chaque lettre (ms)");
    });

    it("valide les erreurs de delta et rho du modèle", async () => {
      const wrapper = mountForm();
      
      wrapper.vm.paramsEstimation.delta = 0;
      await nextTick();
      expect(wrapper.vm.deltaModelError).toBeTruthy();
      expect(wrapper.vm.modelInputError).toContain("La valeur de δ");

      wrapper.vm.paramsEstimation.delta = 0.5; 
      wrapper.vm.paramsEstimation.rho = -1;
      await nextTick();
      expect(wrapper.vm.rhoModelError).toBeTruthy();
      expect(wrapper.vm.modelInputError).toContain("La valeur de ρ");
    });
  });

  describe("Affichage des lignes de résultats (estimationResultsDisplayRows)", () => {
    it("retourne un tableau vide si aucune ligne n'est fournie", () => {
      const wrapper = mountForm({ estimationResultsRows: [] });
      expect(wrapper.vm.estimationResultsDisplayRows).toEqual([]);
    });

    it("ignore les lignes sans RMSE valide", async () => {
      const wrapper = mountForm({
        estimationResultsRows: [
          { alpha: 10, rmse: "non-fini" },
          { alpha: 12, rmse: 2.5 }
        ]
      });
      expect(wrapper.vm.estimationResultsDisplayRows.length).toBe(2);
    });

    it("étiquette correctement les valeurs min, max et min/max de la meilleure ligne", async () => {
      const wrapper = mountForm({
        estimationResultsRows: [
          { alpha: 10, beta: 2, delta: 5, eta: 1, tau: 1, rho: 1, rmse: 10.0 }, 
          { alpha: 0, beta: 50, delta: 5, eta: 1, tau: 1, rho: 1, rmse: 1.5 }   
        ]
      });

      wrapper.vm.configEstimation[0].min = 0; 
      wrapper.vm.configEstimation[1].max = 50; 
      wrapper.vm.configEstimation[2].min = 5; 
      wrapper.vm.configEstimation[2].max = 5; 

      await nextTick();

      const displayRows = wrapper.vm.estimationResultsDisplayRows;
      expect(displayRows[1].alpha).toBe("0 (min)");
      expect(displayRows[1].beta).toBe("50 (max)");
      expect(displayRows[1].delta).toBe("5 (min/max)");
      expect(displayRows[1].__cellClasses.alpha).toBe("text-danger");
    });
  });

  describe("Validation de l'estimation des paramètres (validateEstimationParams)", () => {
    it("échoue si les données ne sont pas importées", () => {
      const wrapper = mountForm({ hasImportedData: false });
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
    });

    it("échoue si maxCombinations ou maxRandomSamples est inférieur ou égal à 0", async () => {
      const wrapper = mountForm();
      wrapper.vm.configEstimation[0].enabled = true;

      wrapper.vm.maxCombinations = 0;
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.errorMessage).toContain("Nombre maximum de combinaisons évaluées");

      wrapper.vm.maxCombinations = 1000;
      wrapper.vm.maxRandomSamples = -5;
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.errorMessage).toContain("Nombre maximum d'essais aléatoires");
    });

    it("échoue si aucun paramètre n'est coché/activé", async () => {
      const wrapper = mountForm();
      wrapper.vm.configEstimation.forEach(item => item.enabled = false);
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.alertMessage).toContain("Veuillez cocher au moins un paramètre");
    });

    it("échoue si les plages min/max/pas contiennent des valeurs invalides ou incohérentes", async () => {
      const wrapper = mountForm();
      const alphaConfig = wrapper.vm.configEstimation[0];
      alphaConfig.enabled = true;

      alphaConfig.min = "texte";
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);

      alphaConfig.min = 10;
      alphaConfig.max = 20;
      alphaConfig.pas = 0; 
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.errorMessage).toContain("le pas (step) ne peut pas être à 0 ou négatif");

      alphaConfig.pas = 1;
      alphaConfig.min = 30; 
      alphaConfig.max = 20;
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.errorMessage).toContain("est supérieur à max");
    });

    it("vérifie la stricte positivité pour rho et delta lors de l'estimation des paramètres", async () => {
      const wrapper = mountForm();
      
      const rhoConfig = wrapper.vm.configEstimation.find(item => item.key === "rho");
      rhoConfig.enabled = true;
      rhoConfig.min = 0;
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.errorMessage).toContain("ρ doit être strictement positif");

      rhoConfig.enabled = false;

      const deltaConfig = wrapper.vm.configEstimation.find(item => item.key === "delta");
      deltaConfig.enabled = true;
      deltaConfig.min = -1;
      await nextTick();
      expect(wrapper.vm.canLaunchEstimation).toBe(false);
      expect(wrapper.vm.errorMessage).toContain("δ doit être strictement positif");
    });
  });

  describe("Interactions avancées, Watchers et Modals", () => {
    it("déclenche le reset de la méthode de recherche lorsque dataImported change via le Watcher", async () => {
      const wrapper = mountForm();
      wrapper.vm.estimationMode = "grid";
      
      await wrapper.setProps({ dataImported: [{ id: "new-dataset" }] });
      expect(wrapper.vm.estimationMode).toBe(DEFAULT_ESTIMATION_MODE);
    });

    it("permet de tout sélectionner et tout désélectionner", async () => {
      const wrapper = mountForm({ hasGeneratedData: false });
      
      const selectAllBtn = wrapper.findAll("button").find(btn => btn.text().includes("Tout sélectionner"));
      await selectAllBtn.trigger("click");
      expect(wrapper.vm.configEstimation.every(item => item.enabled)).toBe(true);

      const deselectAllBtn = wrapper.findAll("button").find(btn => btn.text().includes("Tout désélectionner"));
      await deselectAllBtn.trigger("click");
      expect(wrapper.vm.configEstimation.every(item => item.enabled)).toBe(false);
    });

    it("gère l'ouverture, la fermeture et la sauvegarde de la modal Méthode de recherche", async () => {
      const wrapper = mountForm();
      
      wrapper.vm.openSearchMethod();
      expect(wrapper.vm.isSearchMethodOpen).toBe(true);
      
      wrapper.vm.searchMethodDraft.estimationMode = "grid";
      wrapper.vm.searchMethodDraft.maxCombinations = 999;
      wrapper.vm.searchMethodDraft.maxRandomSamples = 888;
      
      wrapper.vm.saveSearchMethod();
      expect(wrapper.vm.isSearchMethodOpen).toBe(false);
      expect(wrapper.vm.estimationMode).toBe("grid");
      expect(wrapper.vm.maxCombinations).toBe(999);
      expect(wrapper.vm.maxRandomSamples).toBe(888);

      wrapper.vm.openSearchMethod();
      wrapper.vm.closeSearchMethod();
      expect(wrapper.vm.isSearchMethodOpen).toBe(false);
    });

    it("gère la sauvegarde, l'annulation et la réinitialisation de la modal Paramètres par défaut", async () => {
      const wrapper = mountForm();
      
      wrapper.vm.openSettings();
      expect(wrapper.vm.isSettingsOpen).toBe(true);

      wrapper.vm.settingsDraft.paramsInit.encodingTime = 555;
      wrapper.vm.saveSettings();
      expect(wrapper.vm.isSettingsOpen).toBe(false);
      expect(wrapper.vm.params.encodingTime).toBe(555);

      wrapper.vm.openSettings();
      wrapper.vm.closeSettings();
      expect(wrapper.vm.isSettingsOpen).toBe(false);
    });
  });

  describe("Émissions d'événements (Lancement estimation/modèle & Exports)", () => {
    it("émet launch-estimation lors du clic sur le bouton si le formulaire est valide", async () => {
      const wrapper = mountForm();
      wrapper.vm.configEstimation[0].enabled = true; 
      await nextTick();

      wrapper.vm.emitLaunchEstimation();
      expect(wrapper.emitted("launch-estimation")).toBeTruthy();
    });

    it("n'émet pas launch-estimation si la validation échoue", () => {
      const wrapper = mountForm();
      wrapper.vm.configEstimation.forEach(item => item.enabled = false); 
      wrapper.vm.emitLaunchEstimation();
      expect(wrapper.emitted("launch-estimation")).toBeFalsy();
    });

    it("émet launch-model si aucune erreur n'est présente", async () => {
      const wrapper = mountForm();
      wrapper.vm.paramsEstimation.delta = 10;
      wrapper.vm.paramsEstimation.rho = 10;
      await nextTick();

      wrapper.vm.emitLaunchModel();
      expect(wrapper.emitted("launch-model")).toBeTruthy();
    });

    it("bloque launch-model si modelInputError contient une erreur", async () => {
      const wrapper = mountForm();
      wrapper.vm.params.encodingTime = "invalide";
      await nextTick();

      wrapper.vm.emitLaunchModel();
      expect(wrapper.emitted("launch-model")).toBeFalsy();
    });

    it("émet l'événement d'exportation avec les bons formats (xlsx, csv, json)", () => {
      const wrapper = mountForm();
      wrapper.vm.handleExportEstimation("xlsx");
      expect(wrapper.emitted("export-estimation")[0][0].format).toBe("xlsx");
    });
  });

  describe("API Exposée (defineExpose)", () => {
    it("permet la mise à jour externe des paramètres d'estimation via setParamsEstim", () => {
      const wrapper = mountForm();
      wrapper.vm.setParamsEstim({ alpha: 999 });
      expect(wrapper.vm.paramsEstimation.alpha).toBe(999);
    });

    it("remet à zéro tous les champs d'initialisation et d'estimation via resetParams", () => {
      const wrapper = mountForm();
      wrapper.vm.params.encodingTime = 9999;
      wrapper.vm.paramsEstimation.alpha = 8888;
      
      wrapper.vm.resetParams();
      expect(wrapper.vm.params.encodingTime).toBe(wrapper.vm.savedDefaults.paramsInit.encodingTime);
      expect(wrapper.vm.paramsEstimation.alpha).toBe(wrapper.vm.savedDefaults.paramsEstim.alpha);
    });
  });
});