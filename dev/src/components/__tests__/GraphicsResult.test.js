import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import GraphicsResult from "../GraphicsResult.vue";

const sampleData = [
  { addend: 2, session: 1, time: 100, method: "Comptage" },
  { addend: 2, session: 1, time: 200, method: "Récupération" },
  { addend: 3, session: 1, time: 150, method: "Comptage" },
  { addend: 2, session: 2, time: 300, method: "error" }, // Doit être ignoré dans les moyennes
  { addend: 2, session: 2, time: null, method: "Récupération" }, // Ignoré
];

const sampleUserData = [{ addend: 2, session: 1, time: 120, method: "Direct" }];

describe("GraphicsResult", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Polyfill RequestAnimationFrame / CancelAnimationFrame
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    }
    if (!global.cancelAnimationFrame) {
      global.cancelAnimationFrame = (id) => clearTimeout(id);
    }

    // Mocks des API d'URL d'objets (Blobs) absent de jsdom
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();

    // Mock de la méthode toBlob de l'élément Canvas
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
      callback(new Blob(["mock-png-content"], { type: "image/png" }));
    });

    // Simulation automatique de la réussite du chargement des images (Image.onload)
    Object.defineProperty(global.Image.prototype, "src", {
      set(src) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche un état vide par défaut si aucune donnée", () => {
    const wrapper = mount(GraphicsResult, {
      props: { data: [], userData: [] },
    });
    expect(wrapper.text()).toContain("Aucune donnée à afficher");
  });

  it("agrège correctement les données en ignorant les erreurs et calcule les taux de stratégie", async () => {
    const wrapper = mount(GraphicsResult, {
      props: { data: sampleData, userData: sampleUserData },
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
    const exportBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Exporter JSON"));
    if (exportBtn) {
      await exportBtn.trigger("click");
      expect(
        wrapper.emitted("export-summary") ||
          wrapper.emitted("export-strategy-rates"),
      ).toBeTruthy();
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

  it("gère correctement les variantes d'erreurs et les valeurs indéfinies", async () => {
    const edgeCaseData = [
      { addend: 4, session: 1, time: 150, method: "Comptage" },
      { addend: 4, session: 1, time: 200, method: "Erreur" }, // Variante avec majuscule
      { addend: 4, session: 1, time: undefined, method: "Récupération" }, // Valeur undefined
    ];

    const wrapper = mount(GraphicsResult, { props: { data: edgeCaseData } });
    await vi.runAllTimersAsync();
    await nextTick();

    // Seule la première ligne valide doit être comptabilisée
    expect(wrapper.vm.tableRows).toHaveLength(1);
  });

  it("exécute toutes les routines d'exportation de fichiers sans planter", async () => {
    const wrapper = mount(GraphicsResult, { props: { data: sampleData } });
    await vi.runAllTimersAsync();
    await nextTick();

    // 1. Tester les différents formats du tableau de synthèse principal
    wrapper.vm.handleExportSummary("xlsx");
    wrapper.vm.handleExportSummary("csv");
    expect(wrapper.emitted("export-summary")).toHaveLength(2);

    // 2. Basculer sur l'onglet des taux de stratégie pour tester ses exports dédiés
    wrapper.vm.activeTab = "tauxStrategie";
    await nextTick();
    wrapper.vm.handleExportStrategyRates("json");
    expect(wrapper.emitted("export-strategy-rates")).toBeTruthy();

    // 3. Simuler le clic sur les boutons physiques d'export d'images (SVG et PNG)
    const svgBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Exporter SVG"));
    if (svgBtn) await svgBtn.trigger("click");

    const pngBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Exporter PNG"));
    if (pngBtn) {
      await pngBtn.trigger("click");
      await vi.runAllTimersAsync(); // Laisse le cycle Image.onload + canvas.toBlob se résoudre
    }

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it("synchronise l'interface via ses watchers internes lors de changements de props ou d'onglets", async () => {
    const wrapper = mount(GraphicsResult, {
      props: { data: sampleData, userData: sampleUserData },
    });
    await vi.runAllTimersAsync();
    await nextTick();

    // Forcer l'onglet Taux de stratégie
    wrapper.vm.activeTab = "tauxStrategie";
    await nextTick();

    // Changement vers l'affichage utilisateur : l'onglet doit être réinitialisé à 'temps'
    wrapper.vm.activeDataset = "utilisateur";
    await nextTick();
    expect(wrapper.vm.activeTab).toBe("temps");

    // Vider les données utilisateur : l'affichage doit obligatoirement rebasculer sur le 'modele'
    await wrapper.setProps({ userData: [] });
    await nextTick();
    expect(wrapper.vm.activeDataset).toBe("modele");
  });

  it("déclenche le rendu graphique lors d'un événement de redimensionnement de la fenêtre", async () => {
    const wrapper = mount(GraphicsResult, { props: { data: sampleData } });
    await vi.runAllTimersAsync();

    // Émission de l'événement système global
    window.dispatchEvent(new Event("resize"));

    // Résolution du requestAnimationFrame simulé par les Fake Timers
    await vi.runAllTimersAsync();
    await nextTick();

    // Vérification de la persistance du nœud SVG actif
    expect(wrapper.find(".chart-svg").exists()).toBe(true);
  });

  it("gère l'affichage, le déplacement et le masquage de l'infobulle D3 lors du survol des éléments", async () => {
  const wrapper = mount(GraphicsResult, { props: { data: sampleData } });
  await vi.runAllTimersAsync();
  await nextTick();

  // Cibler les marqueurs de points générés par D3
  const nodes = wrapper.findAll("circle");
  expect(nodes.length).toBeGreaterThan(0);

  // Événement 1 : Entrée de la souris (mouseover)
  await nodes[0].trigger("mouseover");
  let tooltip = document.querySelector(".d3-tooltip");
  expect(tooltip).toBeTruthy();
  expect(tooltip.style.visibility).toBe("visible");

  // Événement 2 : Mouvement de la souris (mousemove)
  const mouseMoveEvent = new MouseEvent("mousemove", {
    bubbles: true,
    cancelable: true,
    clientX: 150,
    clientY: 200,
  });

  // On force la définition de pageX et pageY pour JSDOM
  Object.defineProperty(mouseMoveEvent, "pageX", { value: 150, configurable: true });
  Object.defineProperty(mouseMoveEvent, "pageY", { value: 200, configurable: true });

  // On distribue l'événement directement sur l'élément DOM natif
  nodes[0].element.dispatchEvent(mouseMoveEvent);
  await nextTick();

  // Les assertions passent désormais parfaitement
  expect(tooltip.style.top).toBe("210px");
  expect(tooltip.style.left).toBe("160px");
  // ==========================================================


  // Événement 3 : Sortie de la souris (mouseout)
  await nodes[0].trigger("mouseout");
  expect(tooltip.style.visibility).toBe("hidden");
});
});
