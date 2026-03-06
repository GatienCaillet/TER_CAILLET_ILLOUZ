export function useDataImporter() {
  const importEquations = (targetRef) => {
    console.log("Logique d'importation des équations en cours...");
    // Simulation : on remplit la ref avec des données après un délai
    setTimeout(() => {
      targetRef.value = [
        { id: 1, augend: "A", addend: 2, result: "C" },
        { id: 2, augend: "B", addend: 4, result: "E" },
        { id: 3, augend: "C", addend: 2, result: "E" },
      ];
    }, 500);
  };

  const importData = (targetRef) => {
    console.log("Logique d'importation des données en cours...");
    // Simulation : on remplit la ref avec des données après un délai
    setTimeout(() => {
      targetRef.value = [
        {
          id: 1,
          augend: "A",
          addend: 2,
          result: "C",
          time: "3845",
          session: 2,
        },
        {
          id: 2,
          augend: "B",
          addend: 4,
          result: "E",
          time: "5594",
          session: 2,
        },
        {
          id: 3,
          augend: "C",
          addend: 2,
          result: "E",
          time: "1820",
          session: 2,
        },
      ];
    }, 500);
  };

  return {
    importEquations,
    importData,
  };
}
