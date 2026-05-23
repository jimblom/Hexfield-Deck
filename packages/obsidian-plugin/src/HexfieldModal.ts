import { App, Modal, Setting } from "obsidian";

/**
 * A simple text-input modal that resolves with the entered string,
 * or null if the user dismissed without submitting.
 */
export class TextInputModal extends Modal {
  private _value: string;
  private _submitted = false;

  constructor(
    app: App,
    private readonly opts: {
      title: string;
      label: string;
      initial?: string;
      placeholder?: string;
    },
    private readonly onDone: (value: string | null) => void,
  ) {
    super(app);
    this._value = opts.initial ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.opts.title });

    new Setting(contentEl).setName(this.opts.label).addText((text) => {
      text.setValue(this._value);
      if (this.opts.placeholder) text.setPlaceholder(this.opts.placeholder);
      text.onChange((v) => {
        this._value = v;
      });
      text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          this._submit();
        }
      });
      // Auto-focus and select all so the user can type immediately
      window.setTimeout(() => {
        text.inputEl.focus();
        text.inputEl.select();
      }, 30);
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("OK")
          .setCta()
          .onClick(() => this._submit()),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this._submitted) {
      this.onDone(null);
    }
  }

  private _submit(): void {
    this._submitted = true;
    this.close();
    this.onDone(this._value);
  }
}

/**
 * A confirmation modal. Resolves with true only when the user
 * clicks the destructive confirm button.
 */
export class ConfirmModal extends Modal {
  private _confirmed = false;

  constructor(
    app: App,
    private readonly opts: { title: string; message: string; confirmLabel: string },
    private readonly onDone: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.opts.title });
    contentEl.createEl("p", { text: this.opts.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText(this.opts.confirmLabel)
          .setWarning()
          .onClick(() => {
            this._confirmed = true;
            this.close();
          }),
      )
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
    this.onDone(this._confirmed);
  }
}

/** Prompts the user for a text value. Returns null if dismissed. */
export function promptText(
  app: App,
  opts: { title: string; label: string; initial?: string; placeholder?: string },
): Promise<string | null> {
  return new Promise((resolve) => {
    new TextInputModal(app, opts, resolve).open();
  });
}

/** Shows a confirmation dialog. Returns true if confirmed. */
export function promptConfirm(
  app: App,
  opts: { title: string; message: string; confirmLabel: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, opts, resolve).open();
  });
}
