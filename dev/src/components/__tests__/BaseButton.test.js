import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseButton from "../BaseButton.vue";

describe("BaseButton", () => {
  it("renders default styles and slot", () => {
    const wrapper = mount(BaseButton, {
      slots: {
        default: "Click me",
      },
    });

    const button = wrapper.find("button");
    expect(button.exists()).toBe(true);
    expect(button.classes()).toContain("btn");
    expect(button.classes()).toContain("btn-outline-primary");
    expect(button.text()).toBe("Click me");
  });

  it("supports size, variant, disabled state", () => {
    const wrapper = mount(BaseButton, {
      props: {
        variant: "secondary",
        size: "sm",
        disabled: true,
      },
    });

    const button = wrapper.find("button");
    expect(button.classes()).toContain("btn-outline-secondary");
    expect(button.classes()).toContain("btn-sm");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("emits click when enabled", async () => {
    const wrapper = mount(BaseButton, {
      props: {
        variant: "secondary",
        size: "sm",
        disabled: false,
      },
    });

    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });
});
