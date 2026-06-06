# Strudel Studio

Strudel Studio is a local-first desktop studio for Strudel live coding. It lets users organize Strudel code as real files, keep multiple patterns open, save workspaces, and perform selected files together with Play All.

## Run From Source

Install Node.js LTS, then run:

```sh
npm install
npm run dev
```

## Build Desktop Apps

Build output goes to the `build/` folder.

On Windows:

```bat
build-all.bat
```

On macOS or Linux:

```sh
sh build-all.sh
```

The practical release flow is:

- Build Windows packages on Windows.
- Build macOS packages on macOS.
- Build Linux packages on Linux, or later through Docker/CI.

Electron apps share most application code across Windows, macOS, and Linux, but packaging all OS installers from one machine is not fully reliable. macOS packages should be produced on macOS.

## Browser/Web Scope

Strudel itself is web-based, so a future browser edition is realistic. It should be treated as a separate target, tentatively named **Strudel Studio Web**, because the desktop app currently uses Electron IPC for local folders, real file writes, workspace files, and local sample serving.

## Current Packaging Targets

- Windows: NSIS installer and portable `.exe`.
- macOS: `.dmg` and `.zip`, unsigned for now.
- Linux: `.AppImage` and `.deb`.

Code signing, notarization, icons, and auto-update are release tasks after the MVP app flow is stable.
