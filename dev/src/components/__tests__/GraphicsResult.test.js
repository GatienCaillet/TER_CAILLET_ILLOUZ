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

  it("shows tooltip on point hover", async () => {
    const wrapper = mount(GraphicsResult, {
      props: {
        data: sampleData,
      },
    });

    await vi.runAllTimersAsync();
    await nextTick();

    const circle = wrapper.find("circle");
    expect(circle.exists()).toBe(true);

    circle.element.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true, clientX: 10, clientY: 20 }),
    );

    const tooltip = document.querySelector(".d3-tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip.style.visibility).toBe("visible");

    circle.element.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 30, clientY: 40 }),
    );
    expect(tooltip.style.top).toContain("50px");
    expect(tooltip.style.left).toContain("40px");

    await circle.trigger("mouseout");
    expect(tooltip.style.visibility).toBe("hidden");
  });

  it("reacts to resize and cleans up animation frame", async () => {
    const cancelSpy = vi.fn();
    global.cancelAnimationFrame = cancelSpy;

    const wrapper = mount(GraphicsResult, {
      props: {
        data: sampleData,
      },
    });

    await vi.runAllTimersAsync();
    await nextTick();

    window.dispatchEvent(new Event("resize"));

    wrapper.unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it("emits export-summary with json format", async () => {
    const wrapper = mount(GraphicsResult, {
      props: {
        data: sampleData,
      },
    });

    await vi.runAllTimersAsync();
    await nextTick();

    const exportButton = wrapper
      .findAll("button")
      .find((btn) => btn.text().includes("Exporter JSON"));

    await exportButton.trigger("click");

    const emitted = wrapper.emitted("export-summary");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].format).toBe("json");
  });
});
