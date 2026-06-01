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
  let workerStub;

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

        if (resultIndex > 25) {
          return;
        }

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
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    workerStub = class WorkerStub {
      constructor() {
        this.onmessage = null;
        this.onerror = null;
      }

      terminate() {}

      postMessage(message) {
        if (message?.type !== "generate") {
          return;
        }

        try {
          const result = generateEquations(message.payload);
          this.onmessage?.({ data: { type: "result", result } });
        } catch (error) {
          this.onmessage?.({
            data: { type: "error", message: error?.message || "Erreur inconnue" },
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
