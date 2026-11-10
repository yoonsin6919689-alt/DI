#!/usr/bin/env bash
# Builds and signs the DIMENSION Android wrapper APK without Gradle.
# d8/apksigner run on JDK 17 because the SDK's R8 crashes on newer JDKs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK="C:/Users/qw691/AppData/Local/Android/Sdk"
JAVA17="C:/Users/qw691/AppData/Local/Android/jdk/jdk-17.0.21+9"
BT="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
APP="$ROOT/app"
OUT="$ROOT/build"
KS="$ROOT/keystore/dimension-release.jks"
PASS_FILE="$ROOT/keystore/password.txt"
VERSION="1.1.0"
VERSION_CODE="2"

if [ ! -f "$KS" ]; then
  mkdir -p "$ROOT/keystore"
  printf '%s' "$(node -e "process.stdout.write(require('crypto').randomBytes(16).toString('hex'))")" > "$PASS_FILE"
  "$JAVA17/bin/keytool.exe" -genkeypair -keystore "$KS" -storetype JKS -alias dimension \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$(cat "$PASS_FILE")" -keypass "$(cat "$PASS_FILE")" \
    -dname "CN=DIMENSION, OU=Server, O=DIMENSION, L=Seoul, C=KR" >/dev/null
fi
PASS="$(cat "$PASS_FILE")"

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/obj" "$OUT/dex"

"$BT/aapt2.exe" compile --dir "$APP/res" -o "$OUT/res.zip"
"$BT/aapt2.exe" link -o "$OUT/base.apk" -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" -A "$APP/assets" \
  --java "$OUT/gen" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION" \
  "$OUT/res.zip"

"$JAVA17/bin/javac.exe" -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -encoding UTF-8 \
  -d "$OUT/obj" \
  $(find "$APP/src" "$OUT/gen" -name '*.java')

CLASSES=$(find "$OUT/obj" -name '*.class' | while read -r f; do cygpath -w "$f"; done)
"$JAVA17/bin/java.exe" -cp "$(cygpath -w "$BT/lib/d8.jar")" com.android.tools.r8.D8 \
  --lib "$(cygpath -w "$ANDROID_JAR")" --min-api 24 \
  --output "$(cygpath -w "$OUT/dex")" $CLASSES

cp "$OUT/base.apk" "$OUT/app.apk"
"$JAVA17/bin/jar.exe" uf "$OUT/app.apk" -C "$OUT/dex" classes.dex

"$BT/zipalign.exe" -f -p 4 "$OUT/app.apk" "$OUT/aligned.apk"
"$JAVA17/bin/java.exe" -jar "$(cygpath -w "$BT/lib/apksigner.jar")" sign \
  --ks "$(cygpath -w "$KS")" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$(cygpath -w "$OUT/DIMENSION-$VERSION.apk")" \
  "$(cygpath -w "$OUT/aligned.apk")"

echo "APK_READY $OUT/DIMENSION-$VERSION.apk"
