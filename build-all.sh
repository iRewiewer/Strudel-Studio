#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

echo
echo "Strudel Studio desktop build"
echo "Output folder: build"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js LTS first: https://nodejs.org/"
  exit 1
fi

npm install
npm run build:app

OS_NAME="$(uname -s)"

case "$OS_NAME" in
  Darwin)
    echo
    echo "Building macOS DMG/ZIP packages..."
    npx electron-builder --mac --x64 --arm64

    echo
    echo "Trying Windows packages from macOS..."
    if ! npx electron-builder --win --x64; then
      echo "Windows packaging did not complete on this Mac. Install Wine or build Windows on Windows/CI."
    fi

    echo
    echo "Trying Linux packages from macOS..."
    if ! npx electron-builder --linux --x64; then
      echo "Linux packaging did not complete on this Mac. Build Linux on Linux, or use Docker/electron-builder CI later."
    fi
    ;;

  Linux)
    echo
    echo "Building Linux AppImage/DEB packages..."
    npx electron-builder --linux --x64

    echo
    echo "Trying Windows packages from Linux..."
    if ! npx electron-builder --win --x64; then
      echo "Windows packaging did not complete on this Linux machine. Install Wine or build Windows on Windows/CI."
    fi

    echo
    echo "macOS DMG/ZIP packages must be built on macOS because Apple signing and packaging tools are macOS-only."
    ;;

  *)
    echo "Unsupported shell host: $OS_NAME"
    echo "Use build-all.bat on Windows, or build-all.sh on macOS/Linux."
    exit 1
    ;;
esac

echo
echo "Build output is in the build folder."
