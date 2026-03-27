import { ItemView, WorkspaceLeaf, TFile, ViewStateResult } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { App } from "@hexfield-deck/webview-ui";
import { parseBoard, allCards } from "@hexfield-deck/core";
import { ObsidianBridge } from "./ObsidianBridge.js";
import type HexfieldDeckPlugin from "./main.js";
// @ts-expect-error — esbuild bundles CSS as a text string via --loader:.css=text
import stylesContent from "@hexfield-deck/webview-ui/styles.css";

export const VIEW_TYPE = "hexfield-deck";

export class HexfieldDeckView extends ItemView {
  private _bridge: ObsidianBridge;
  private _root: Root | null = null;
  private _file: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: HexfieldDeckPlugin) {
    super(leaf);
    this._bridge = new ObsidianBridge({
      obsApp: this.app,
      plugin,
      getFile: () => this._file,
      reload: () => this._load(),
    });
  }

  get file(): TFile | null {
    return this._file;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return this._file?.basename ?? "Hexfield Deck";
  }

  getIcon(): string {
    return "layout-grid";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Inject component styles (bundled from @hexfield-deck/webview-ui/styles.css)
    const style = document.createElement("style");
    style.textContent = stylesContent as string;
    container.appendChild(style);

    // Mount React
    const mountPoint = container.createDiv({ cls: "hexfield-deck-root" });
    this._root = createRoot(mountPoint);
    this._root.render(<App bridge={this._bridge} />);

    // Trigger initial load when App signals ready
    this._bridge.setReadyCallback(() => this._load());

    // Watch for file saves
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (file === this._file) await this._load();
      }),
    );
  }

  async onClose(): Promise<void> {
    this._root?.unmount();
    this._root = null;
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as { filePath?: string } | null;
    if (s?.filePath) {
      const file = this.app.vault.getFileByPath(s.filePath);
      if (file) await this.setFile(file);
    }
    await super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return { filePath: this._file?.path };
  }

  async setFile(file: TFile): Promise<void> {
    this._file = file;
    this.titleEl.setText(file.basename);
    if (this._root) await this._load();
  }

  async _load(): Promise<void> {
    if (!this._file) return;
    const content = await this.app.vault.read(this._file);
    const boardData = parseBoard(content);
    const cards = allCards(boardData);
    const storedData = (await this.plugin.loadData()) ?? {};
    const projects = (storedData.projects as Record<string, unknown>) ?? {};
    this._bridge.pushUpdate({ boardData, cards, projects });
  }
}
