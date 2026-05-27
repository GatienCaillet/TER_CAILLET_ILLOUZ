import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../App.vue";

vi.mock("../composables/useDataIO.js", () => ({
  useDataIO: () => ({
    importData: vi.fn(),
    exportTable: vi.fn(),
  }),
}));

vi.mock("bootstrap/dist/js/bootstrap.bundle", () => ({
  Alert: class {},
}));

describe("App - generation d'equations", () => {
  let randomSpy;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.999);
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    randomSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("evite les augends identiques consecutifs quand c'est possible", async () => {
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
          BaseDataTable: { template: "<div />" },
          GraphicsResult: { template: "<div />" },
          ParametersForm: { template: "<div />" },
          BaseButton: { template: "<button><slot /></button>" },
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
