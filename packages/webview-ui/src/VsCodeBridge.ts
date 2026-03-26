import type { HostBridge, HostState, OutboundMessage, UpdatePayload } from "./HostBridge.js";

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): HostState | null;
  setState(state: HostState): void;
};

// Acquired once at module level — VS Code requires this.
const vsCodeApi = acquireVsCodeApi();

/** HostBridge implementation for VS Code webviews. */
export class VsCodeBridge implements HostBridge {
  send(message: OutboundMessage): void {
    vsCodeApi.postMessage(message);
  }

  onUpdate(handler: (payload: UpdatePayload) => void): () => void {
    const listener = (event: MessageEvent) => {
      if (event.data?.type === "update") {
        handler(event.data as UpdatePayload);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }

  getState(): HostState | null {
    return vsCodeApi.getState();
  }

  setState(state: HostState): void {
    vsCodeApi.setState(state);
  }
}
