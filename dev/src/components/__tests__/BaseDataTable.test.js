import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseDataTable from "../BaseDataTable.vue";

const columns = [
  { key: "id", label: "#" },
  { key: "value", label: "Valeur" }
];

describe("BaseDataTable", () => {
  it("gère l'affichage conditionnel du bouton d'importation", async () => {
    const wrapper = mount(BaseDataTable, {
      props: { columns, rows: [], showButton: true, hideButtonWhenEmpty: true }
    });
    expect(wrapper.find("button").exists()).toBe(false);

    await wrapper.setProps({ hideButtonWhenEmpty: false });
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("affiche l'état de chargement et masque le tableau", () => {
    const wrapper = mount(BaseDataTable, {
      props: { columns, rows: [{ id: 1, value: 10 }], isLoading: true }
    });
    expect(wrapper.text()).toContain("Import en cours");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("déclenche l'événement clear lorsque le bouton de vidage est cliqué", async () => {
    const wrapper = mount(BaseDataTable, {
      props: { columns, rows: [{ id: 1, value: 10 }], clearable: true }
    });
    const clearButton = wrapper.find("button.btn-outline-danger, button");
    await clearButton.trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
  });

  it("gère de manière robuste le tri de types mixtes, nulls et chaînes de caractères", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [
          { id: 1, value: null },
          { id: 2, value: " 15.5 " },
          { id: 3, value: 5 },
          { id: 4, value: "abc" },
          { id: 5, value: "ABC" },
          { id: 6, value: undefined }
        ],
        sortable: true,
        initialSortKey: "value",
        initialSortDirection: "asc",
        pagination: false
      }
    });

    // Ordre attendu ascendant (les nombres d'abord, puis les chaînes triées, puis les valeurs null/undefined à la fin)
    let renderedTexts = wrapper.findAll("tbody tr").map(tr => tr.find("td:nth-child(2)").text());
    expect(renderedTexts[0]).toBe("5");
    expect(renderedTexts[1]).toBe("15.5");
    expect(renderedTexts[2]).toBe("abc"); // Tolérance casse incluse (toLowerCase)
    expect(renderedTexts[3]).toBe("ABC");

    // Inversion du tri en cliquant sur l'en-tête
    const headerBtn = wrapper.find("thead th button");
    await headerBtn.trigger("click");

    renderedTexts = wrapper.findAll("tbody tr").map(tr => tr.find("td:nth-child(2)").text());
    // En ordre descendant, la logique inverse s'applique
    expect(renderedTexts[renderedTexts.length - 1]).toBe("");
  });

  it("gère correctement la pagination et les changements de taille de page", async () => {
    const multiRows = Array.from({ length: 15 }, (_, i) => ({ id: i, value: i }));
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: multiRows,
        pagination: true,
        pageSize: 5,
        pageSizeOptions: [5, 10]
      }
    });

    expect(wrapper.findAll("tbody tr")).toHaveLength(5);
    
    // Boutons de navigation
    const nextBtn = wrapper.findAll(".pagination-controls button").find(b => b.text().includes("Suivant"));
    const prevBtn = wrapper.findAll(".pagination-controls button").find(b => b.text().includes("Précédent"));
    
    expect(prevBtn.attributes("disabled")).toBeDefined();
    
    await nextBtn.trigger("click"); // Aller page 2
    expect(wrapper.findAll("tbody tr")[0].text()).toContain("5");
    
    // Changement dynamique de la taille de page via le select
    const select = wrapper.find("select");
    await select.setValue(10);
    expect(wrapper.findAll("tbody tr")).toHaveLength(10);
  });
});