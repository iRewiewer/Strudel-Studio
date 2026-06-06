import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels, type StudioApi } from '../shared/ipc';

const api: StudioApi = {
  openProjectFolder: () => ipcRenderer.invoke(ipcChannels.openProjectFolder),
  createStrudelFile: (request) => ipcRenderer.invoke(ipcChannels.createStrudelFile, request),
  readFile: (request) => ipcRenderer.invoke(ipcChannels.readFile, request),
  saveFile: (request) => ipcRenderer.invoke(ipcChannels.saveFile, request),
  saveWorkspace: (request) => ipcRenderer.invoke(ipcChannels.saveWorkspace, request),
  loadWorkspace: () => ipcRenderer.invoke(ipcChannels.loadWorkspace),
};

contextBridge.exposeInMainWorld('studio', api);
