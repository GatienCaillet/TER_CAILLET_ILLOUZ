import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

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

  it("handles invalid stored defaults", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.localStorage.setItem("ter-default-params", "not-json");
    vi.resetModules();

    const wrapper = await mountForm();
    expect(wrapper.exists()).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
