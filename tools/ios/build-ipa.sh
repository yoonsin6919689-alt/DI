#!/usr/bin/env bash
# Builds an unsigned iOS .ipa on macOS. Sign it with your Apple ID when installing
# (Sideloadly / AltStore), or archive it in Xcode for a signed Ad Hoc build.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode가 필요합니다. 이 스크립트는 macOS에서만 실행됩니다." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen이 필요합니다: brew install xcodegen" >&2
  exit 1
fi

xcodegen generate --spec project.yml
rm -rf build
mkdir -p build

xcodebuild \
  -project DIMENSION.xcodeproj \
  -scheme DIMENSION \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData \
  CONFIGURATION_BUILD_DIR="$PWD/build/Release-iphoneos" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

mkdir -p build/Payload
cp -R build/Release-iphoneos/DIMENSION.app build/Payload/
(cd build && zip -qry DIMENSION-unsigned.ipa Payload)

echo "IPA_READY $(pwd)/build/DIMENSION-unsigned.ipa"
