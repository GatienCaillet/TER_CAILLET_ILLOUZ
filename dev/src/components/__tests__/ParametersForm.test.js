import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import {
  DEFAULT_MAX_COMBINATIONS,
  DEFAULT_PARAMS_ESTIM,
  DEFAULT_PARAMS_INIT,
  DEFAULT_RANGES,
  STORAGE_KEY,
} from "../../config/defaults.js";

const baseProps = {
  bestEstimatedParams: null,
  estimationResultsRows: [],
  isEstimating: false,
  dataImported: [],
  hasImportedData: true,
  hasGeneratedData: false,
};

const stripDiacritics = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

const mountForm = async (props = {}) => {
  const { default: ParametersForm } = await import("../ParametersForm.vue");
  return mount(ParametersForm, {
    props: {
      ...baseProps,
      ...props,
    },
    global: {
      stubs: {
        BaseDataTable: {
          template: "<div data-testid='table'></div>",
        },
      },
    },
  });
};

describe("ParametersForm", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows warnings when no data is available", async () => {
    const wrapper = await mountForm({
      hasImportedData: false,
      hasGeneratedData: false,
    });

    const alerts = wrapper.findAll(".alert.alert-danger");
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("emits launch-estimation with payload", async () => {
    const wrapper = await mountForm();

    wrapper.vm.configEstimation[0].enabled = true;
    await nextTick();

    const button = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("lancer l'estimation"));

    expect(button).toBeDefined();

    await button.trigger("click");

    const emitted = wrapper.emitted("launch-estimation");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toHaveProperty("paramsInit");
    expect(emitted[0][0]).toHaveProperty("paramsEstim");
    expect(emitted[0][0]).toHaveProperty("maxCombinations");
  });

  it("emits launch-model with payload", async () => {
    const wrapper = await mountForm();

    const button = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("lancer le modele"));

    expect(button).toBeDefined();

    await button.trigger("click");

    const emitted = wrapper.emitted("launch-model");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toHaveProperty("paramsInit");
  });

  it("exposes rho error when invalid", async () => {
    const wrapper = await mountForm();

    wrapper.vm.paramsEstimation.rho = 0;
    await nextTick();

    expect(wrapper.vm.rhoModelError.length).toBeGreaterThan(0);
  });

  it("validates estimation range parameters", async () => {
    const wrapper = await mountForm();

    wrapper.vm.configEstimation[0].enabled = true;
    wrapper.vm.configEstimation[0].pas = 0;
    await nextTick();

    expect(wrapper.vm.errorMessage.length).toBeGreaterThan(0);
  });

  it("shows alert when no estimation params are selected", async () => {
    const wrapper = await mountForm();

    expect(wrapper.vm.canLaunchEstimation).toBe(false);
    expect(stripDiacritics(wrapper.vm.alertMessage)).toContain(
      "veuillez cocher au moins un parametre",
    );
  });

  it("validates min/max mismatch", async () => {
    const wrapper = await mountForm();

    wrapper.vm.configEstimation[0].enabled = true;
    wrapper.vm.configEstimation[0].min = 10;
    wrapper.vm.configEstimation[0].max = 1;
    await nextTick();

    expect(wrapper.vm.canLaunchEstimation).toBe(false);
    expect(stripDiacritics(wrapper.vm.errorMessage)).toContain("min");
  });

  it("validates rho positivity for estimation", async () => {
    const wrapper = await mountForm();

    const rhoConfig = wrapper.vm.configEstimation.find(
      (item) => item.key === "rho",
    );
    rhoConfig.enabled = true;
    rhoConfig.min = 0;
    await nextTick();

    expect(wrapper.vm.canLaunchEstimation).toBe(false);
    expect(wrapper.vm.errorMessage).toContain("ρ");
  });

  it("opens settings modal and saves defaults", async () => {
    const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");
    const wrapper = await mountForm();

    const openButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("par defaut"));

    expect(openButton).toBeDefined();

    await openButton.trigger("click");
    expect(wrapper.find(".settings-modal").exists()).toBe(true);

    const saveButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("enregistrer"));

    expect(saveButton).toBeDefined();

    await saveButton.trigger("click");
    expect(setItemSpy).toHaveBeenCalled();
  });

  it("closes settings modal with header and cancel buttons", async () => {
    const wrapper = await mountForm();

    const openButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("par defaut"));

    await openButton.trigger("click");
    expect(wrapper.find(".settings-modal").exists()).toBe(true);

    await wrapper.find(".settings-modal .btn-close").trigger("click");
    expect(wrapper.find(".settings-modal").exists()).toBe(false);

    await openButton.trigger("click");
    const cancelButton = wrapper
      .find(".settings-modal")
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("annuler"));

    await cancelButton.trigger("click");
    expect(wrapper.find(".settings-modal").exists()).toBe(false);
  });

  it("closes settings modal on backdrop click", async () => {
    const wrapper = await mountForm();

    const openButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("par defaut"));

    await openButton.trigger("click");
    expect(wrapper.find(".settings-modal").exists()).toBe(true);

    await wrapper.find(".settings-modal-backdrop").trigger("click");
    expect(wrapper.find(".settings-modal").exists()).toBe(false);
  });

  it("resets settings and persists defaults", async () => {
    const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");
    const wrapper = await mountForm();

    const openButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("par defaut"));

    await openButton.trigger("click");

    const resetButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("reinitialiser"));

    await resetButton.trigger("click");

    expect(setItemSpy).toHaveBeenCalled();
    expect(wrapper.vm.params.encodingTime).toBe(DEFAULT_PARAMS_INIT.encodingTime);
  });

  it("emits export-estimation with formatted rows", async () => {
    const wrapper = await mountForm({
      estimationResultsRows: [
        {
          alpha: 0,
          beta: 1200,
          delta: 300,
          eta: 200,
          tau: 4000,
          rho: 50,
          rmse: 1,
        },
      ],
    });

    await nextTick();

    const exportButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("exporter csv"));

    expect(exportButton).toBeDefined();

    await exportButton.trigger("click");

    const emitted = wrapper.emitted("export-estimation");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].format).toBe("csv");
    expect(emitted[0][0].rows[0].alpha).toContain("min");
  });

  it("exports xlsx format", async () => {
    const wrapper = await mountForm({
      estimationResultsRows: [
        {
          alpha: 1,
          beta: 1200,
          delta: 300,
          eta: 200,
          tau: 4000,
          rho: 50,
          rmse: 1,
        },
      ],
    });

    await nextTick();

    const xlsxButton = wrapper
      .findAll("button")
      .find((btn) => btn.text().trim() === "Exporter XLSX");

    await xlsxButton.trigger("click");

    const emitted = wrapper.emitted("export-estimation");
    expect(emitted[0][0].format).toBe("xlsx");
  });

  it("marks min/max values in formatted rows", async () => {
    const wrapper = await mountForm({
      estimationResultsRows: [
        {
          alpha: DEFAULT_RANGES.alpha.min,
          beta: 1200,
          delta: 300,
          eta: 200,
          tau: 4000,
          rho: 50,
          rmse: 1,
        },
      ],
    });

    wrapper.vm.configEstimation[0].min = DEFAULT_RANGES.alpha.min;
    wrapper.vm.configEstimation[0].max = DEFAULT_RANGES.alpha.min;
    await nextTick();

    const exportButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("exporter json"));

    await exportButton.trigger("click");

    const emitted = wrapper.emitted("export-estimation");
    expect(emitted[0][0].rows[0].alpha).toContain("min/max");
  });

  it("handles invalid stored defaults", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.localStorage.setItem("ter-default-params", "not-json");
    vi.resetModules();

    const wrapper = await mountForm();
    expect(wrapper.exists()).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("loads stored defaults with fallbacks", async () => {
    const stored = {
      paramsInit: { encodingTime: "bad", comparisonTime: 250 },
      paramsEstim: { alpha: "30" },
      ranges: { alpha: { min: "bad", max: 70, pas: 5 } },
      maxCombinations: "invalid",
    };
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    vi.resetModules();

    const { default: ParametersForm } = await import("../ParametersForm.vue");
    const wrapper = mount(ParametersForm, {
      props: { ...baseProps },
    });

    expect(wrapper.vm.params.encodingTime).toBe(DEFAULT_PARAMS_INIT.encodingTime);
    expect(wrapper.vm.params.comparisonTime).toBe(250);
    expect(wrapper.vm.paramsEstimation.alpha).toBe(30);
    expect(wrapper.vm.configEstimation[0].min).toBe(DEFAULT_RANGES.alpha.min);
    expect(wrapper.vm.maxCombinations).toBe(DEFAULT_MAX_COMBINATIONS);
  });

  it("setParamsEstim and resetParams update state", async () => {
    const wrapper = await mountForm();
    const previous = wrapper.vm.paramsEstimation.alpha;

    wrapper.vm.setParamsEstim({ alpha: 99 });
    await nextTick();

    expect(wrapper.vm.previousParamsEstimation.alpha).toBe(previous);
    expect(wrapper.vm.paramsEstimation.alpha).toBe(99);

    wrapper.vm.configEstimation[0].enabled = true;
    wrapper.vm.params.encodingTime = 999;
    wrapper.vm.resetParams();

    expect(wrapper.vm.params.encodingTime).toBe(DEFAULT_PARAMS_INIT.encodingTime);
    expect(wrapper.vm.configEstimation[0].enabled).toBe(false);
  });

  it("warns when persisting defaults fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.localStorage.setItem.mockImplementation(() => {
      throw new Error("fail");
    });

    const wrapper = await mountForm();

    const openButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("par defaut"));

    await openButton.trigger("click");

    const saveButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("enregistrer"));

    await saveButton.trigger("click");

    expect(warnSpy).toHaveBeenCalled();
  });

  it("toggles selection buttons and shows generated-data warning", async () => {
    const wrapper = await mountForm({
      hasGeneratedData: false,
    });

    const selectButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("tout selectionner"));
    const deselectButton = wrapper
      .findAll("button")
      .find((btn) => stripDiacritics(btn.text()).includes("tout deselectionner"));

    await selectButton.trigger("click");
    expect(wrapper.vm.configEstimation.every((item) => item.enabled)).toBe(true);

    await deselectButton.trigger("click");
    expect(wrapper.vm.configEstimation.some((item) => item.enabled)).toBe(false);

    await wrapper.setProps({ hasGeneratedData: true });
    const text = stripDiacritics(wrapper.text());
    expect(text).toContain("l'estimation des parametres necessite l'import");
    expect(
      wrapper
        .findAll("button")
        .some((btn) => stripDiacritics(btn.text()).includes("tout selectionner")),
    ).toBe(false);
  });

  it("renders best estimated params with previous values", async () => {
    const wrapper = await mountForm();

    wrapper.vm.setParamsEstim({ alpha: 99 });
    await nextTick();

    await wrapper.setProps({
      bestEstimatedParams: { alpha: 99 },
    });

    const message = wrapper.find(".alert.alert-success");
    expect(message.exists()).toBe(true);

    const text = stripDiacritics(message.text());
    expect(text).toContain("alpha");
    expect(text).toContain("20");
    expect(text).toContain("99");
  });

  it("shows model warning when estimation params are selected", async () => {
    const wrapper = await mountForm();

    wrapper.vm.configEstimation[0].enabled = true;
    await nextTick();

    expect(stripDiacritics(wrapper.vm.alertMessageModel)).toContain(
      "parametres d'estimation sont selectionnes",
    );
    expect(stripDiacritics(wrapper.text())).toContain("parametres d'estimation");
  });

  it("renders rho model error message", async () => {
    const wrapper = await mountForm();

    wrapper.vm.paramsEstimation.rho = 0;
    await nextTick();

    const text = stripDiacritics(wrapper.text());
    expect(text).toContain("valeur de ρ");
  });
});
