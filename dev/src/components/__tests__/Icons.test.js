import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import IconCommunity from "../icons/IconCommunity.vue";
import IconDocumentation from "../icons/IconDocumentation.vue";
import IconEcosystem from "../icons/IconEcosystem.vue";
import IconSupport from "../icons/IconSupport.vue";
import IconTooling from "../icons/IconTooling.vue";

describe("icons", () => {
  it("renders icon components", () => {
    const components = [
      IconCommunity,
      IconDocumentation,
      IconEcosystem,
      IconSupport,
      IconTooling,
    ];

    components.forEach((Component) => {
      const wrapper = mount(Component);
      expect(wrapper.find("svg").exists()).toBe(true);
    });
  });
});
