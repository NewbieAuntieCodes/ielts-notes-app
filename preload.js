// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveData: (data) => ipcRenderer.send("save-data", data),
  onLoadData: (callback) =>
    ipcRenderer.on("load-data", (_event, value) => callback(value)),
  exportAllNotes: (notesData, format) =>
    ipcRenderer.invoke("export-all-notes", notesData, format),

  // --- 新增：加载和保存选中状态的函数 ---
  loadSelectionState: () => ipcRenderer.invoke("load-selection-state"),
  saveSelectionState: (ids) => ipcRenderer.send("save-selection-state", ids),

  // --- 新增：导出选中笔记的函数 ---
  exportSelectedNotes: (selectedData, format) =>
    ipcRenderer.invoke("export-selected-notes", selectedData, format),
});

console.log("preload.js loaded with selection state functions");
