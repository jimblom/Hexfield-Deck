import { Plugin, TFile, Menu, MenuItem } from "obsidian";
import { HexfieldDeckView, VIEW_TYPE } from "./HexfieldDeckView.js";

export default class HexfieldDeckPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE, (leaf) => new HexfieldDeckView(leaf));

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
