const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("vpNative", {
  accounts: () => ipcRenderer.invoke("vp:accounts"),
  openEmbedded: id => ipcRenderer.invoke("vp:open-embedded", id),
  layoutEmbedded: layouts => ipcRenderer.invoke("vp:layout-embedded", layouts),
  closeEmbedded: id => ipcRenderer.invoke("vp:close-embedded", id),
  gameAction: payload => ipcRenderer.invoke("vp:game-action", payload),
  profiles: () => ipcRenderer.invoke("vp:profiles"),
  saveProfile: profile => ipcRenderer.invoke("vp:save-profile", profile),
  deleteProfile: id => ipcRenderer.invoke("vp:delete-profile", id),
  loginProfile: id => ipcRenderer.invoke("vp:login-profile", id)
});
