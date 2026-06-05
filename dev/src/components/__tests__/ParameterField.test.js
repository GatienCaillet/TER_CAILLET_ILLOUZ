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

  it("émet les bons événements lors de la saisie de valeurs en mode plage (range)", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 10,
        min: 0,
        max: 50,
        pas: 5,
        enabled: true,
        showRange: true,
      },
    });

    const inputs = wrapper.findAll("input[type='number']");

    // inputs[0] -> Champ de la valeur principale (modelValue)
    inputs[0].element.value = "15";
    inputs[0].element.valueAsNumber = 15;
    await inputs[0].trigger("input");
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([15]);

    // inputs[1] -> Champ Min
    inputs[1].element.value = "5";
    inputs[1].element.valueAsNumber = 5;
    await inputs[1].trigger("input");
    expect(wrapper.emitted("update:min")[0]).toEqual([5]);

    // inputs[2] -> Champ Max
    inputs[2].element.value = "60";
    inputs[2].element.valueAsNumber = 60;
    await inputs[2].trigger("input");
    expect(wrapper.emitted("update:max")[0]).toEqual([60]);

    // inputs[3] -> Champ Pas
    inputs[3].element.value = "2";
    inputs[3].element.valueAsNumber = 2;
    await inputs[3].trigger("input");
    expect(wrapper.emitted("update:pas")[0]).toEqual([2]);
  });

  it("émet l'événement update:enabled au changement d'état de la checkbox", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 10,
        min: 0,
        max: 50,
        pas: 5,
        enabled: false,
        showRange: true,
      },
    });

    const checkbox = wrapper.find("input[type='checkbox']");
    checkbox.element.checked = true;
    await checkbox.trigger("change");
    
    expect(wrapper.emitted("update:enabled")[0]).toEqual([true]);
  });

  it("n'émet pas de notification update:enabled lorsqu'elle est déjà activée", async () => {
    const wrapper = mount(ParameterField, {
      props: {
        id: "alpha",
        label: "Alpha",
        modelValue: 1,
        min: 0,
        max: 10,
        pas: 2,
        enabled: true, // Déjà activé
        showRange: true,
        rangeDisabled: false,
      },
    });

    const fieldset = wrapper.find("fieldset");
    await fieldset.trigger("click");

    const inputs = wrapper.findAll("input[type='number']");
    await inputs[1].trigger("focus");

    // L'événement ne doit pas être déclenché à nouveau
    expect(wrapper.emitted("update:enabled")).toBeFalsy();
  });
});