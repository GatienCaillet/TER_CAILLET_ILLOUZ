import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ParametersForm from "../ParametersForm.vue";
import {
  DEFAULT_PARAMS_INIT,
  DEFAULT_PARAMS_ESTIM,
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

describe("ParametersForm.vue - Suite de Tests", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Rendu initial et Validations d'état", () => {
    it("affiche un message d'erreur si aucune donnée n'est importée", () => {
      const wrapper = mountForm({ hasImportedData: false, hasGeneratedData: false });
      expect(wrapper.text()).toContain("Aucune donnée importée");
    });

    it("affiche une alerte spécifique si les données sont générées au lieu d'importées", () => {
      const wrapper = mountForm({ hasImportedData: false, hasGeneratedData: true });
      expect(wrapper.text()).toContain("L'estimation des paramètres nécessite l'import de données existantes");
    });

    it("affiche correctement les meilleurs paramètres estimés lorsqu'ils sont fournis", async () => {
      const wrapper = mountForm();
      
      // Simuler une ancienne valeur de paramètre
      wrapper.vm.setParamsEstim({ alpha: 20 });
      await nextTick();

      await wrapper.setProps({
        bestEstimatedParams: { alpha: 99 },
      });

      const successAlert = wrapper.find(".alert-success");
      expect(successAlert.exists()).toBe(true);
      expect(successAlert.text()).toContain("alpha");
      expect(successAlert.text()).toContain("99");
    });
  });

  describe("Interactions et Émissions d'événements", () => {
    it("émet l'événement 'launch-estimation' avec le bon payload", async () => {
      const wrapper = mountForm();
      
      // Activer au moins un paramètre pour rendre le bouton cliquable/valide
      wrapper.vm.configEstimation[0].enabled = true;
      await nextTick();

      const button = wrapper.findAll("button").find((btn) => 
        /lancer l'estimation/i.test(btn.text())
      );
      
      expect(button).toBeDefined();
      await button.trigger("click");

      expect(wrapper.emitted("launch-estimation")).toBeTruthy();
      const payload = wrapper.emitted("launch-estimation")[0][0];
      expect(payload).toHaveProperty("paramsInit");
      expect(payload).toHaveProperty("paramsEstim");
      expect(payload).toHaveProperty("estimationMode");
    });

    it("bloque le lancement du modèle si un champ d'initialisation n'est pas un nombre", async () => {
      const wrapper = mountForm();
      
      // Altération d'une valeur pour lever une erreur de validation
      wrapper.vm.params.encodingTime = Number.NaN;
      await nextTick();

      const button = wrapper.findAll("button").find((btn) => 
        /lancer le modèle/i.test(btn.text())
      );

      await button.trigger("click");
      expect(wrapper.emitted("launch-model")).toBeFalsy();
    });
  });

  describe("Gestion de la configuration par défaut (LocalStorage)", () => {
    it("ouvre la modal de configuration et persiste les données lors de la sauvegarde", async () => {
      const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");
      const wrapper = mountForm();

      const openBtn = wrapper.findAll("button").find((btn) => 
        /modifier les paramètres par défaut/i.test(btn.text())
      );
      await openBtn.trigger("click");
      expect(wrapper.find(".settings-modal-backdrop").exists()).toBe(true);

      const saveBtn = wrapper.findAll("button").find((btn) => 
        /enregistrer/i.test(btn.text())
      );
      await saveBtn.trigger("click");

      expect(setItemSpy).toHaveBeenCalled();
    });

    it("réinitialise les configurations aux valeurs d'usine", async () => {
      const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");
      const wrapper = mountForm();

      wrapper.vm.openSettings();
      await nextTick();

      const resetBtn = wrapper.findAll("button").find((btn) => 
        /réinitialiser/i.test(btn.text())
      );
      await resetBtn.trigger("click");

      expect(setItemSpy).toHaveBeenCalled();
      expect(wrapper.vm.params.encodingTime).toBe(DEFAULT_PARAMS_INIT.encodingTime);
    });
  });

  describe("API Exposée (defineExpose)", () => {
    it("permet la mise à jour externe des paramètres d'estimation via setParamsEstim", () => {
      const wrapper = mountForm();
      expect(wrapper.vm.paramsEstimation.alpha).not.toBe(999);
      
      wrapper.vm.setParamsEstim({ alpha: 999 });
      expect(wrapper.vm.paramsEstimation.alpha).toBe(999);
    });

    it("remet à zéro tous les champs d'initialisation et d'estimation via resetParams", () => {
      const wrapper = mountForm();
      
      // Modification temporaire de l'état interne
      wrapper.vm.params.encodingTime = 9999;
      wrapper.vm.paramsEstimation.alpha = 8888;
      
      wrapper.vm.resetParams();
      
      expect(wrapper.vm.params.encodingTime).toBe(wrapper.vm.savedDefaults.paramsInit.encodingTime);
      expect(wrapper.vm.paramsEstimation.alpha).toBe(wrapper.vm.savedDefaults.paramsEstim.alpha);
    });
  });
});