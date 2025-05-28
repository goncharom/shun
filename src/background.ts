import browser from "webextension-polyfill";

async function handleSnapshotRequest(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length === 0) return;

    const tabId = tabs[0].id;
    if (tabId !== undefined) {
      await browser.tabs.sendMessage(tabId, { action: "takeSnapshot" });
    }
  } catch (error) {
    console.error("Error handling snapshot request:", error);
  }
}

browser.action.onClicked.addListener(handleSnapshotRequest);

browser.commands.onCommand.addListener((command: string) => {
  if (command === "snapshot") {
    handleSnapshotRequest();
  }
});
