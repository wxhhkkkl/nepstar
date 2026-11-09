#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${KH503_JAVA_HOME:-$(/usr/libexec/java_home -v 1.8)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export KH503_DISABLE_WATCH=1
if [[ -z "${KH503_NODE_BINARY:-}" ]]; then
  if [[ -x /usr/local/bin/node && "$(/usr/local/bin/node -v)" == v12.* ]]; then
    export KH503_NODE_BINARY=/usr/local/bin/node
  else
    export KH503_NODE_BINARY="$(command -v node)"
  fi
fi
export PATH="$(dirname "$KH503_NODE_BINARY"):$PATH"

if [[ ! -f node_modules/react-native/package.json ]]; then
  echo "请先安装 package-lock.json 中的依赖，再运行本脚本。" >&2
  exit 1
fi

adb get-state
cd android
./gradlew :app:assembleDebug -PphonePreview=true --max-workers=2
cd ..
"$KH503_NODE_BINARY" --check < android/app/build/generated/assets/react/debug/index.android.bundle
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
adb shell am start -n robot.kj.com.phone/com.kang_jia.MainActivity
