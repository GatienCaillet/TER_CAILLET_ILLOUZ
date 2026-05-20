import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import GraphicsResult from "../GraphicsResult.vue";

const sampleData = [
  { addend: 2, session: 1, time: 100 },
  { addend: 2, session: 1, time: 200 },
  { addend: 3, session: 1, time: 150 },
  { addend: 2, session: 2, time: 300 },
];

describe("GraphicsResult", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    }
    if (!global.cancelAnimationFrame) {
      global.cancelAnimationFrame = (id) => clearTimeout(id);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows empty state when no data", () => {
    const wrapper = mount(GraphicsResult, {
      props: {
        data: [],
      },
    });

    const text = wrapper.text().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    expect(text).toContain("Aucune donnee");
  });

  it("renders chart and emits export events", async () => {
    const wrapper = mount(GraphicsResult, {
      props: {
        data: sampleData,
      },
    });

    await vi.runAllTimersAsync();
    await nextTick();

    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    expect(svg.element.querySelectorAll("path").length).toBeGreaterThan(0);

    const exportButton = wrapper
      .findAll("button")
      .find((btn) => btn.text().includes("Exporter CSV"));

    await exportButton.trigger("click");

    const emitted = wrapper.emitted("export-summary");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].format).toBe("csv");
  });
});
