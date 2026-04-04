import { App, PluginSettingTab, Setting } from "obsidian";
import type { HexfieldColors } from "./HexfieldSettings.js";
import type HexfieldDeckPlugin from "./main.js";

interface ColorSetting {
  key: keyof HexfieldColors;
  label: string;
  desc: string;
}

const COLOR_SETTINGS: ColorSetting[] = [
  { key: "projectTag",          label: "Project tag",           desc: "Color for #project-name tags" },
  { key: "priorityHigh",        label: "Priority — high",       desc: "Color for !!! markers" },
  { key: "priorityMed",         label: "Priority — medium",     desc: "Color for !! markers" },
  { key: "priorityLow",         label: "Priority — low",        desc: "Color for ! markers" },
  { key: "timeEstimate",        label: "Time estimate",         desc: "Color for est:Xh / est:Xm tokens" },
  { key: "inProgressCheckbox",  label: "In-progress checkbox",  desc: "Color for [/] checkboxes" },
  { key: "dueDateOverdue",      label: "Due date — overdue",    desc: "Color for past dates" },
  { key: "dueDateToday",        label: "Due date — today",      desc: "Color for today's date" },
  { key: "dueDateSoon",         label: "Due date — soon",       desc: "Color for dates 1–3 days away" },
  { key: "dueDateFuture",       label: "Due date — future",     desc: "Color for dates > 3 days away" },
  { key: "doneTask",            label: "Done task",             desc: "Color + strikethrough for [x] task lines" },
  { key: "lineComment",         label: "Line comment",          desc: "Color for // comment text" },
];

export class HexfieldSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: HexfieldDeckPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Hexfield Deck" });
    containerEl.createEl("h3", { text: "Token colors" });
    containerEl.createEl("p", {
      text: "Colors applied to hexfield-planner markdown files in the editor.",
      cls: "setting-item-description",
    });

    for (const { key, label, desc } of COLOR_SETTINGS) {
      new Setting(containerEl)
        .setName(label)
        .setDesc(desc)
        .addColorPicker((picker) => {
          picker
            .setValue(this.plugin.settings.colors[key])
            .onChange(async (value) => {
              this.plugin.settings.colors[key] = value;
              await this.plugin.saveSettings();
              this.plugin.refreshDecorations();
            });
        });
    }

    new Setting(containerEl)
      .addButton((btn) => {
        btn.setButtonText("Reset to defaults").onClick(async () => {
          const { DEFAULT_SETTINGS } = await import("./HexfieldSettings.js");
          this.plugin.settings.colors = { ...DEFAULT_SETTINGS.colors };
          await this.plugin.saveSettings();
          this.plugin.refreshDecorations();
          this.display();
        });
      });
  }
}
