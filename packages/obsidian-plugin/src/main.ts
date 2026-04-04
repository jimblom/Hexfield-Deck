import { Plugin, TFile, Menu, MenuItem, MarkdownView } from "obsidian";
import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HexfieldDeckView, VIEW_TYPE } from "./HexfieldDeckView.js";
import { HexfieldSettingTab } from "./HexfieldSettingTab.js";
import { hexfieldDecorationExtension } from "./HexfieldDecorator.js";
import { DEFAULT_SETTINGS, type HexfieldSettings } from "./HexfieldSettings.js";

export default class HexfieldDeckPlugin extends Plugin {
  settings!: HexfieldSettings;
  private readonly _decoratorCompartment = new Compartment();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new HexfieldDeckView(leaf, this));

    // Editor text decorations (project tags, priorities, due dates, etc.)
    this.registerEditorExtension(
      this._decoratorCompartment.of(hexfieldDecorationExtension(this)),
    );

    this.addSettingTab(new HexfieldSettingTab(this.app, this));

    this.addCommand({
      id: "open-board",
      name: "Open as Hexfield Deck",
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) void this._openBoardForFile(file);
      },
    });

    // File explorer / editor tab right-click context menu
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: unknown) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item: MenuItem) => {
          item
            .setTitle("Open as Hexfield Deck")
            .setIcon("layout-grid")
            .onClick(() => void this._openBoardForFile(file));
        });
      })
    );
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Deep-merge colors so new color keys get defaults even on upgrade
    this.settings.colors = Object.assign({}, DEFAULT_SETTINGS.colors, this.settings.colors);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Reconfigure the decorator compartment in all open editors to pick up new settings. */
  refreshDecorations(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView)) return;
      const cm = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
      if (!cm) return;
      cm.dispatch({
        effects: this._decoratorCompartment.reconfigure(
          hexfieldDecorationExtension(this),
        ),
      });
    });
  }

  private async _openBoardForFile(file: TFile): Promise<void> {
    const { workspace } = this.app;

    // Re-use an existing leaf for this file if one is open
    for (const leaf of workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view as HexfieldDeckView;
      if (view.file?.path === file.path) {
        workspace.revealLeaf(leaf);
        return;
      }
    }

    // Open in a new tab
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE,
      state: { filePath: file.path },
      active: true,
    });
    workspace.revealLeaf(leaf);
  }
}
