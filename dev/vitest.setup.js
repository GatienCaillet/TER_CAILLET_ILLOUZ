import { vi } from "vitest";

class WorkerMock {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }
  postMessage(payload) {
    setTimeout(() => {
      this.onmessage({
        data: {
          type: "SUCCESS",
          results: [{ augend: "A", addend: 1, result: "B", time: 450, method: "retrieval", session: 1 }],
          bestParams: { alpha: 22, beta: 1210, delta: 340 }
        }
      });
    }, 0);
  }
  terminate() {
    // vi.fn() crée une nouvelle fonction, utilise plutôt une fonction vide ou un espion persistant
    this.terminateMock();
  }
  terminateMock = vi.fn();
}

vi.stubGlobal("Worker", WorkerMock);