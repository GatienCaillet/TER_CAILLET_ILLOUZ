import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ParameterField from "../ParameterField.vue";

const setNumberInput = async (input, value) => {
  input.element.value = String(value);
  await input.trigger("input");
};

describe("ParameterField", () => {
  it("emits model updates in simple mode", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "field",
        label: "Field",
        modelValue: 1,
        showRange: false,
      },
    });

    const input = wrapper.find("input[type='number']");
    await setNumberInput(input, 5);

    expect(wrapper.emitted("update:modelValue")[0]).toEqual([5]);
  });

  it("supports range mode and enabled toggle", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 1,
        min: 0,
        max: 10,
        pas: 2,
        enabled: false,
        showRange: true,
      },
    });

    const checkbox = wrapper.find("input[type='checkbox']");
    await checkbox.setChecked(true);
    expect(wrapper.emitted("update:enabled")[0]).toEqual([true]);

    const fieldset = wrapper.find("fieldset");
    await fieldset.trigger("click");
    expect(wrapper.emitted("update:enabled").length).toBeGreaterThan(1);

    const inputs = wrapper.findAll("input[type='number']");
    await setNumberInput(inputs[0], 10);
    await setNumberInput(inputs[1], 1);
    await setNumberInput(inputs[2], 9);
    await setNumberInput(inputs[3], 3);

    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:min")).toBeTruthy();
    expect(wrapper.emitted("update:max")).toBeTruthy();
    expect(wrapper.emitted("update:pas")).toBeTruthy();
  });

  it("disables range inputs when needed", () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 1,
        min: 0,
        max: 10,
        pas: 2,
        enabled: false,
        showRange: true,
        rangeDisabled: true,
      },
    });

    const inputs = wrapper.findAll("input[type='number']");
    expect(inputs[1].attributes("disabled")).toBeDefined();
    expect(wrapper.find("fieldset").classes()).toContain("cursor-not-allowed");
  });

  it("enables range when focusing inputs", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 1,
        min: 0,
        max: 10,
        pas: 2,
        enabled: false,
        showRange: true,
        rangeDisabled: false,
      },
    });

    const inputs = wrapper.findAll("input[type='number']");
    await inputs[1].trigger("focus");

    expect(wrapper.emitted("update:enabled")).toBeTruthy();
  });

  it("enables range when focusing max and step inputs", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 1,
        min: 0,
        max: 10,
        pas: 2,
        enabled: false,
        showRange: true,
        rangeDisabled: false,
      },
    });

    const inputs = wrapper.findAll("input[type='number']");
    await inputs[2].trigger("focus");
    await inputs[3].trigger("focus");

    expect(wrapper.emitted("update:enabled")).toBeTruthy();
  });

  it("does not enable range when disabled", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 1,
        min: 0,
        max: 10,
        pas: 2,
        enabled: false,
        showRange: true,
        rangeDisabled: true,
      },
    });

    const fieldset = wrapper.find("fieldset");
    await fieldset.trigger("click");

    const inputs = wrapper.findAll("input[type='number']");
    await inputs[1].trigger("focus");

    expect(wrapper.emitted("update:enabled")).toBeFalsy();
  });
});
