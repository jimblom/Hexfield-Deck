import type { HostBridge, HostState, OutboundMessage, UpdatePayload } from "@hexfield-deck/webview-ui";

/**
 * HostBridge implementation for Obsidian.
 *
 * Phase 10C: onUpdate + pushUpdate wire up the read-only board.
 * send() handles "ready" to trigger the initial data load; all
 * other message types are stubs filled in by Phase 10D.
 */
export class ObsidianBridge implements HostBridge {
  private _updateHandler: ((payload: UpdatePayload) => void) | null = null;
  private _state: HostState = {};
  private _onReady: (() => void) | null = null;

  /** Called by HexfieldDeckView to hook the "ready" signal from App. */
  setReadyCallback(cb: () => void): void {
    this._onReady = cb;
  }

  send(message: OutboundMessage): void {
    if (message.type === "ready") {
      this._onReady?.();
    }
    // Phase 10D will add handlers for move, edit, delete, etc.
  }

  onUpdate(handler: (payload: UpdatePayload) => void): () => void {
    this._updateHandler = handler;
    return () => {
      this._updateHandler = null;
    };
  }

  getState(): HostState | null {
    return this._state;
  }

  setState(state: HostState): void {
    this._state = { ...this._state, ...state };
  }

  /** Push a fresh board payload into the mounted React UI. */
  pushUpdate(payload: UpdatePayload): void {
    this._updateHandler?.(payload);
  }
}
