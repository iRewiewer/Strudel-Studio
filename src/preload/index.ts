import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels, type StudioApi } from '../shared/ipc';

const api: StudioApi = {
  onCloseRequested: (callback) => {
    const listener = (): void => callback();
    ipcRenderer.on(ipcChannels.closeRequested, listener);
    return () => ipcRenderer.removeListener(ipcChannels.closeRequested, listener);
  },
  confirmClose: (shouldClose) => ipcRenderer.invoke(ipcChannels.confirmClose, shouldClose),
  newProjectFolder: () => ipcRenderer.invoke(ipcChannels.newProjectFolder),
  openProjectFolder: () => ipcRenderer.invoke(ipcChannels.openProjectFolder),
  openRecentProject: (projectRoot) => ipcRenderer.invoke(ipcChannels.openRecentProject, projectRoot),
  listRecentProjects: () => ipcRenderer.invoke(ipcChannels.listRecentProjects),
  removeRecentProject: (projectRoot) => ipcRenderer.invoke(ipcChannels.removeRecentProject, projectRoot),
  createStrudelFile: (request) => ipcRenderer.invoke(ipcChannels.createStrudelFile, request),
  readFile: (request) => ipcRenderer.invoke(ipcChannels.readFile, request),
  saveFile: (request) => ipcRenderer.invoke(ipcChannels.saveFile, request),
  saveWorkspace: (request) => ipcRenderer.invoke(ipcChannels.saveWorkspace, request),
  loadWorkspace: () => ipcRenderer.invoke(ipcChannels.loadWorkspace),
  listThemes: () => ipcRenderer.invoke(ipcChannels.listThemes),
  importThemeFile: () => ipcRenderer.invoke(ipcChannels.importThemeFile),
  saveTheme: (request) => ipcRenderer.invoke(ipcChannels.saveTheme, request),
  deleteTheme: (request) => ipcRenderer.invoke(ipcChannels.deleteTheme, request),
  revealThemesDirectory: () => ipcRenderer.invoke(ipcChannels.revealThemesDirectory),
  listSystemFonts: () => ipcRenderer.invoke(ipcChannels.listSystemFonts),
  listPlugins: () => ipcRenderer.invoke(ipcChannels.listPlugins),
  addPluginSource: (request) => ipcRenderer.invoke(ipcChannels.addPluginSource, request),
  importPluginFolder: () => ipcRenderer.invoke(ipcChannels.importPluginFolder),
  deletePlugin: (request) => ipcRenderer.invoke(ipcChannels.deletePlugin, request),
  readPluginScriptBundle: (pluginPath) => ipcRenderer.invoke(ipcChannels.readPluginScriptBundle, pluginPath),
  revealPluginsDirectory: () => ipcRenderer.invoke(ipcChannels.revealPluginsDirectory),
  revealExternalSamplesDirectory: () => ipcRenderer.invoke(ipcChannels.revealExternalSamplesDirectory),
};

contextBridge.exposeInMainWorld('studio', api);
