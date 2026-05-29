import { getClearClipboardSeconds } from "./settings";

export async function copySecret(text: string) {
  await navigator.clipboard.writeText(text);

  const clearAfterMs = getClearClipboardSeconds() * 1000;
  window.setTimeout(() => {
    void clearClipboardIfUnchanged(text);
  }, clearAfterMs);
}

async function clearClipboardIfUnchanged(originalText: string) {
  try {
    const currentText = await navigator.clipboard.readText();
    if (currentText === originalText) {
      await navigator.clipboard.writeText("");
    }
  } catch {
    // Clipboard permissions vary between webview environments.
  }
}
