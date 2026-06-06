import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels, type StudioApi } from '../shared/ipc';

const api: StudioApi = {
  newProjectFolder: () => ipcRenderer.invoke(ipcChannels.newProjectFolder),
  openProjectFolder: () => ipcRenderer.invoke(ipcChannels.openProjectFolder),
  openRecentProject: (projectRoot) => ipcRenderer.invoke(ipcChannels.openRecentProject, projectRoot),
  listRecentProjects: () => ipcRenderer.invoke(ipcChannels.listRecentProjects),
  createStrudelFile: (request) => ipcRenderer.invoke(ipcChannels.createStrudelFile, request),
  readFile: (request) => ipcRenderer.invoke(ipcChannels.readFile, request),
  saveFile: (request) => ipcRenderer.invoke(ipcChannels.saveFile, request),
  saveWorkspace: (request) => ipcRenderer.invoke(ipcChannels.saveWorkspace, request),
  loadWorkspace: () => ipcRenderer.invoke(ipcChannels.loadWorkspace),
};

contextBridge.exposeInMainWorld('studio', api);
