import type { HostBridge, HostState, OutboundMessage, UpdatePayload } from "./HostBridge.js";

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): HostState | null;
  setState(state: HostState): void;
};

/** HostBridge implementation for VS Code webviews. */
export class VsCodeBridge implements HostBridge {
  // Acquired in the constructor so this module has no top-level side effects.
  // Obsidian bundles webview-ui too; a module-level acquireVsCodeApi() call
  // would blow up immediately since that global doesn't exist there.
  private readonly _api = acquireVsCodeApi();

  send(message: OutboundMessage): void {
    this._api.postMessage(message);
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
    return this._api.getState();
  }

  setState(state: HostState): void {
    this._api.setState(state);
  }
}
