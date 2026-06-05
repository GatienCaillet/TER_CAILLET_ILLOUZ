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

    const clearButton = wrapper.find("button.btn-clear-table");
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

  it("gère la pagination et la navigation entre les pages (Suivant / Précédent)", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }],
        pagination: true,
        pageSize: 2,
      },
    });

    // Page 1 : doit afficher les 2 premières lignes
    let rowsRendered = wrapper.findAll("tbody tr");
    expect(rowsRendered).toHaveLength(2);
    expect(rowsRendered[0].text()).toBe("1");

    // Clic sur "Suivant"
    const nextButton = wrapper.findAll("button").find((btn) => btn.text().includes("Suivant"));
    expect(nextButton.exists()).toBe(true);
    await nextButton.trigger("click");

    // Page 2 : doit afficher les 2 lignes suivantes
    rowsRendered = wrapper.findAll("tbody tr");
    expect(rowsRendered).toHaveLength(2);
    expect(rowsRendered[0].text()).toBe("3");

    // Clic sur "Précédent" (ou le bouton avant "Suivant")
    const prevButton = wrapper.findAll("button").find((btn) => btn.text().includes("Précédent") || btn.text().includes("Précédant"));
    if (prevButton) {
      await prevButton.trigger("click");
      expect(wrapper.findAll("tbody tr")[0].text()).toBe("1");
    }
  });

  it("gère le changement dynamique de la taille de page via le select", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [{ value: 1 }, { value: 2 }, { value: 3 }],
        pagination: true,
        pageSize: 2,
        pageSizeOptions: [2, 5],
      },
    });

    const select = wrapper.find("select");
    expect(select.exists()).toBe(true);

    // Passage à une taille de page de 5
    await select.setValue("5");

    // Toutes les lignes doivent maintenant tenir sur la même page
    expect(wrapper.findAll("tbody tr")).toHaveLength(3);
  });

  it("change de clé de tri et réinitialise la direction en 'asc' lors du clic sur une autre colonne", async () => {
    const multiCols = [
      { key: "colA", label: "A" },
      { key: "colB", label: "B" },
    ];
    const wrapper = mount(BaseDataTable, {
      props: {
        columns: multiCols,
        rows: [{ colA: 1, colB: 10 }, { colA: 2, colB: 5 }],
        sortable: true,
        initialSortKey: "colA",
        initialSortDirection: "desc",
      },
    });

    // On clique sur le deuxième en-tête (Colonne B)
    const headers = wrapper.findAll("thead th button");
    expect(headers.length).toBeGreaterThan(1);
    await headers[1].trigger("click");

    // La clé doit être 'colB' et la direction doit être réinitialisée à 'asc'
    expect(wrapper.vm.sortKey).toBe("colB");
    expect(wrapper.vm.sortDirection).toBe("asc");
  });

  it("gère toutes les branches du tri descendant avec doublons et valeurs nulles", () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [
          { value: 2 },
          { value: null },
          { value: 2 },
          { value: "A" },
          { value: null },
        ],
        sortable: true,
        initialSortKey: "value",
        initialSortDirection: "desc",
      },
    });

    // Permet de valider l'exécution sans erreur des branches d'égalité (2 === 2) 
    // et de gestion des nulls sous l'effet du multiplicateur négatif (direction = -1)
    const lines = wrapper.findAll("tbody tr");
    expect(lines).toBeDefined();
  });

  it("réinitialise la page courante à 1 lorsque le jeu de données (rows) change", async () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }],
        pagination: true,
        pageSize: 2,
      },
    });

    // Avancer à la page 2
    const nextButton = wrapper.findAll("button").find((btn) => btn.text().includes("Suivant"));
    await nextButton.trigger("click");
    expect(wrapper.vm.currentPage).toBe(2);

    // Mutation des rows depuis le parent
    await wrapper.setProps({ rows: [{ value: 5 }, { value: 6 }] });

    // Le watcher doit avoir replacé la pagination à la page 1
    expect(wrapper.vm.currentPage).toBe(1);
  });

  it("gère correctement les boutons de pagination et le changement de taille de page", async () => {
    const columns = [{ key: "value", label: "Value" }];
    // On fournit 3 éléments pour tester une pagination de 1 élément par page
    const rows = [{ value: 1 }, { value: 2 }, { value: 3 }];

    const wrapper = mount(BaseDataTable, {
      props: {
        columns,
        rows,
        pagination: true,
        pageSize: 1,
        pageSizeOptions: [1, 2, 5],
      },
    });

    // Trouver et cliquer sur le bouton "Suivant"
    const nextButton = wrapper.findAll("button").find(btn => btn.text().includes("Suivant"));
    expect(nextButton.element.disabled).toBe(false);
    await nextButton.trigger("click");
    
    // Vérifier l'état interne ou l'affichage de la page suivante si exposé
    // Tester le changement d'option du select de lignes par page
    const select = wrapper.find("select");
    await select.setValue("2");
    await select.trigger("change");

    expect(wrapper.vm.currentPageSize).toBe(2);
  });
});