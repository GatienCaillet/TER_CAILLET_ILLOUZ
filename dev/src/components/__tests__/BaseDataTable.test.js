import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseDataTable from "../BaseDataTable.vue";

const columns = [{ key: "value", label: "Value" }];

const rows = [{ value: 2 }, { value: 1 }];

describe("BaseDataTable", () => {
  it("renders import button based on empty state", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [],
        showButton: true,
        hideButtonWhenEmpty: true,
        buttonLabel: "Importer",
      },
    });

    expect(wrapper.find("button").exists()).toBe(false);

    await wrapper.setProps({ hideButtonWhenEmpty: false });
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("shows loading state", () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows,
        isLoading: true,
      },
    });

    expect(wrapper.text()).toContain("Import en cours");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("renders clear button and emits events", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [{ value: 1 }],
        clearable: true,
        buttonLabel: "Importer",
      },
    });

    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");

    expect(wrapper.emitted("import")).toBeTruthy();
    expect(wrapper.emitted("clear")).toBeTruthy();
  });

  it("sorts rows when sortable", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows,
        sortable: true,
        initialSortKey: "value",
        initialSortDirection: "asc",
      },
    });

    const getValues = () =>
      wrapper.findAll("tbody td").map((cell) => cell.text());

    expect(getValues()).toEqual(["1", "2"]);

    await wrapper.find("thead button").trigger("click");
    expect(getValues()).toEqual(["2", "1"]);
  });
});
