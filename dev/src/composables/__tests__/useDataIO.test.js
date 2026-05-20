import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("exceljs", () => {
  class Worksheet {
    constructor() {
      this.rows = [];
    }

    addRow = vi.fn((values) => {
      this.rows.push(values);
    });

    getRow = vi.fn((rowNumber) => ({
      eachCell: (cb) => {
        if (rowNumber !== 1) {
          return;
        }

        const headers = ["augend", "addend", "result", "time", "session"];
        headers.forEach((value, index) => cb({ value }, index + 1));
      },
    }));

    eachRow = vi.fn((cb) => {
      const row = {
        eachCell: (cellCb) => {
          const values = ["A", 1, "B", 100, 1];
          values.forEach((value, index) => cellCb({ value }, index + 1));
        },
      };

      cb(row, 2);
    });
  }

  class Workbook {
    constructor() {
      this._worksheet = new Worksheet();
      this.xlsx = {
        load: vi.fn(async () => {}),
        writeBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
      };
      this.csv = {
        writeBuffer: vi.fn(async () => new Uint8Array([4, 5, 6])),
      };
    }

    addWorksheet() {
      return this._worksheet;
    }

    getWorksheet() {
      return this._worksheet;
    }
  }

  return {
    default: {
      Workbook,
    },
  };
});

const buildJsonFile = (payload, name = "data.json") =>
  new File([JSON.stringify(payload)], name, { type: "application/json" });

const buildBinaryFile = (name) => new File([new Uint8Array([1, 2])], name);

const setupCreateElementSpy = () => {
  const originalCreateElement = document.createElement.bind(document);
  return vi.spyOn(document, "createElement").mockImplementation((tag) => {
    const element = originalCreateElement(tag);
    if (tag === "input" || tag === "a") {
      element.click = vi.fn();
    }
    return element;
  });
};

describe("useDataIO", () => {
  let alertSpy;
  let createElementSpy;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    createElementSpy = setupCreateElementSpy();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 14, 34, 56));

    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:mock");
    } else {
      vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mock");
    }

    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn(() => {});
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    alertSpy.mockRestore();
    createElementSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("imports JSON data and maps rows", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };
    const onStart = vi.fn();
    const onDone = vi.fn();

    importData(targetRef, { onStart, onDone });

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    await input.onchange({
      target: {
        files: [
          buildJsonFile([
            {
              Augend: "A",
              Addend: 1,
              Result: "B",
              Time: 100,
              Session: 1,
            },
          ]),
        ],
      },
    });

    expect(onStart).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
    expect(targetRef.value).toHaveLength(1);
    expect(targetRef.value[0].id).toBe(1);
  });

  it("imports JSON data from a data envelope", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };

    importData(targetRef);

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    await input.onchange({
      target: {
        files: [
          buildJsonFile({
            data: [
              {
                augend: "A",
                addend: 1,
                result: "B",
                time: 120,
                session: 1,
              },
            ],
          }),
        ],
      },
    });

    expect(targetRef.value).toHaveLength(1);
  });

  it("handles empty file selection", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };
    const onDone = vi.fn();

    importData(targetRef, { onDone });

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    await input.onchange({ target: { files: [] } });

    expect(onDone).toHaveBeenCalled();
  });

  it("alerts when format is unsupported", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };
    const onDone = vi.fn();

    importData(targetRef, { onDone });

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    await input.onchange({
      target: {
        files: [buildBinaryFile("data.txt")],
      },
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("alerts when JSON parsing fails", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };
    const onDone = vi.fn();

    importData(targetRef, { onDone });

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    const invalidFile = new File(["not-json"], "data.json", {
      type: "application/json",
    });

    await input.onchange({ target: { files: [invalidFile] } });

    expect(alertSpy).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("imports spreadsheet data", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };
    const onDone = vi.fn();

    importData(targetRef, { onDone });

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    await input.onchange({
      target: {
        files: [buildBinaryFile("data.xlsx")],
      },
    });

    expect(targetRef.value).toHaveLength(1);
    expect(targetRef.value[0].augend).toBe("A");
    expect(onDone).toHaveBeenCalled();
  });

  it("alerts when mapped rows are empty", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { importData } = useDataIO();
    const targetRef = { value: [] };
    const onDone = vi.fn();

    importData(targetRef, { onDone });

    const input = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "INPUT",
    ).value;

    await input.onchange({
      target: {
        files: [buildJsonFile([{ foo: "bar" }])],
      },
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("exports JSON data", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    await exportTable(
      [{ value: 1 }],
      { format: "json", filename: "table" },
    );

    expect(URL.createObjectURL).toHaveBeenCalled();
    const anchor = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "A",
    ).value;
    expect(anchor.download).toBe("table-20260520-143456.json");
  });

  it("exports spreadsheet data", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    const columns = [
      { key: "value", label: "Value" },
    ];

    await exportTable(
      [{ value: 1 }],
      { format: "xlsx", filename: "table", columns },
    );

    expect(URL.createObjectURL).toHaveBeenCalled();
    const anchor = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "A",
    ).value;
    expect(anchor.download).toBe("table-20260520-143456.xlsx");
  });

  it("exports CSV data", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    await exportTable(
      [{ value: 1 }],
      { format: "csv", filename: "table" },
    );

    expect(URL.createObjectURL).toHaveBeenCalled();
    const anchor = createElementSpy.mock.results.find(
      (result) => result.value?.tagName === "A",
    ).value;
    expect(anchor.download).toBe("table-20260520-143456.csv");
  });

  it("alerts when export format is invalid", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    await exportTable([{ value: 1 }], { format: "pdf" });

    expect(alertSpy).toHaveBeenCalled();
  });

  it("alerts when export rows are empty", async () => {
    const { useDataIO } = await import("../useDataIO.js");
    const { exportTable } = useDataIO();

    await exportTable([], { format: "json" });

    expect(alertSpy).toHaveBeenCalled();
  });
});
