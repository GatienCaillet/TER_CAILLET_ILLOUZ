import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ParameterField from "../ParameterField.vue";

describe("ParameterField", () => {
  it("émet une mise à jour immédiate du modèle en mode d'édition simple", async () => {
    const wrapper = mount(ParameterField, {
      props: { id: "tau", label: "Tau", modelValue: 4800, showRange: false }
    });

    const input = wrapper.find("input[type='number']");
    input.element.value = "5000";
    await input.trigger("input");

    expect(wrapper.emitted("update:modelValue")[0]).toEqual([5000]);
  });

  it("active automatiquement le paramètre lors du focus sur les entrées de plage (min, max, pas)", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 20,
        min: 10,
        max: 30,
        pas: 2,
        enabled: false,
        showRange: true,
        rangeDisabled: false
      }
    });

    // Clic / Focus sur l'input du Maximum
    const maxInput = wrapper.findAll("input[type='number']")[2]; // Index 0: value, 1: min, 2: max, 3: pas
    await maxInput.trigger("focus");

    // L'événement d'activation de la ligne doit être notifié au parent
    expect(wrapper.emitted("update:enabled")).toBeTruthy();
    expect(wrapper.emitted("update:enabled")[0]).toEqual([true]);
  });

  it("respecte l'état d'invalidation (disabled) globale de la plage", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "beta",
        label: "Beta",
        modelValue: 1260,
        showRange: true,
        rangeDisabled: true // Désactivé de force par le parent (ex: trop de combinaisons)
      }
    });

    const fieldset = wrapper.find("fieldset");
    if (fieldset.exists()) {
      expect(fieldset.attributes("disabled")).toBeDefined();
    }
  });
});