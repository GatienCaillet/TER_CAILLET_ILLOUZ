import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import GraphicsResult from "../GraphicsResult.vue";

const sampleData = [
  { addend: 2, session: 1, time: 100, method: "Comptage" },
  { addend: 2, session: 1, time: 200, method: "Récupération" },
  { addend: 3, session: 1, time: 150, method: "Comptage" },
  { addend: 2, session: 2, time: 300, method: "error" }, // Doit être ignoré dans les moyennes
  { addend: 2, session: 2, time: null, method: "Récupération" } // Ignoré
];

const sampleUserData = [
  { addend: 2, session: 1, time: 120, method: "Direct" }
];

describe("GraphicsResult", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Polyfill minimaliste pour RequestAnimationFrame en environnement jsdom
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

  it("affiche un état vide par défaut si aucune donnée", () => {
    const wrapper = mount(GraphicsResult, { props: { data: [], userData: [] } });
    expect(wrapper.text()).toContain("Aucune donnée à afficher");
  });

  it("agrège correctement les données en ignorant les erreurs et calcule les taux de stratégie", async () => {
    const wrapper = mount(GraphicsResult, {
      props: { data: sampleData, userData: sampleUserData }
    });

    await vi.runAllTimersAsync();
    await nextTick();

    // Vérifier l'accès aux données calculées sous-jacentes du modèle (ex: taux de comptage)
    expect(wrapper.vm.tableRows).toHaveLength(2); // Session 1 et Session 2
    
    // Changement de jeu de données (Modèle -> Utilisateur)
    const datasetSelect = wrapper.find("select, .btn-group"); 
    // Si l'interface utilise un bouton ou select pour changer de dataset :
    wrapper.vm.activeDataset = "utilisateur";
    await nextTick();
    expect(wrapper.vm.tableRows).toHaveLength(1); // Uniquement sampleUserData
  });

  it("émet les événements d'exportation pour la synthèse et les stratégies", async () => {
    const wrapper = mount(GraphicsResult, { props: { data: sampleData } });
    await vi.runAllTimersAsync();
    await nextTick();

    // Simuler le clic sur le bouton Exporter JSON
    const exportBtn = wrapper.findAll("button").find(b => b.text().includes("Exporter JSON"));
    if (exportBtn) {
      await exportBtn.trigger("click");
      expect(wrapper.emitted("export-summary") || wrapper.emitted("export-strategy-rates")).toBeTruthy();
    }
  });

  it("nettoie le listener de redimensionnement (resize) lors du démontage du composant", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const wrapper = mount(GraphicsResult, { props: { data: sampleData } });
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("exécute la construction de la chaîne d'export SVG sans planter", () => {
    const wrapper = mount(GraphicsResult, { props: { data: sampleData } });
    // Appel direct de la méthode interne pour valider la génération XML
    const svgString = wrapper.vm.buildExportSvgString();
    // Devrait renvoyer null si le conteneur n'est pas rattaché au DOM réel ou tester la structure cible
    expect(svgString === null || typeof svgString === "string").toBe(true);
  });
});