const shuffleInPlace = (items) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
};

const ensureNoConsecutiveAugends = (items, previousAugend = null) => {
  if (items.length === 0) {
    return items;
  }

  if (previousAugend !== null && items[0].augend === previousAugend) {
    const swapIndex = items.findIndex(
      (item, idx) => idx > 0 && item.augend !== previousAugend,
    );

    if (swapIndex !== -1) {
      [items[0], items[swapIndex]] = [items[swapIndex], items[0]];
    }
  }

  for (let i = 1; i < items.length; i += 1) {
    if (items[i].augend !== items[i - 1].augend) {
      continue;
    }

    const swapIndex = items.findIndex(
      (item, idx) => idx > i && item.augend !== items[i - 1].augend,
    );

    if (swapIndex === -1) {
      return items;
    }

    [items[i], items[swapIndex]] = [items[swapIndex], items[i]];
  }

  return items;
};

self.onmessage = (event) => {
  const { type, payload } = event.data || {};

  if (type !== "generate") {
    return;
  }

  const {
    selectedAugends = [],
    selectedAddends = [],
    sessionsCount = 0,
    repetitionCount = 0,
  } = payload || {};

  try {
    const generatedEquations = [];
    let id = 1;

    const combinations = [];
    selectedAugends.forEach((augend) => {
      selectedAddends.forEach((addend) => {
        const augendIndex = augend.charCodeAt(0) - 65;
        const resultIndex = augendIndex + parseInt(addend, 10);

        if (resultIndex > 25) {
          return;
        }

        const result = String.fromCharCode(65 + resultIndex);

        for (let rep = 1; rep <= repetitionCount; rep += 1) {
          combinations.push({
            augend,
            addend: parseInt(addend, 10),
            result,
          });
        }
      });
    });

    let previousAugend = null;
    for (let session = 1; session <= sessionsCount; session += 1) {
      const shuffledCombinations = ensureNoConsecutiveAugends(
        shuffleInPlace([...combinations]),
        previousAugend,
      );

      shuffledCombinations.forEach((combination) => {
        generatedEquations.push({
          id: id++,
          augend: combination.augend,
          addend: combination.addend,
          result: combination.result,
          session,
        });
      });

      previousAugend =
        shuffledCombinations[shuffledCombinations.length - 1]?.augend ??
        previousAugend;
    }

    self.postMessage({ type: "result", result: generatedEquations });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Erreur inconnue",
    });
  }
};
