# KH503machine 项目分析

## 项目用途与结构

这是「名医云检测仪」KH503 健康检测一体机客户端，以横屏运行，Android 是实际业务平台；iOS 目录主要保留 RN 工程骨架，硬件能力未做同等实现。

- `index.js` / `App.js`：注册 `kang_jia`，用 React Navigation 2 的 Switch Navigator 切换启动、待机、信息采集、测量、上传、错误、升级和工装模块。
- `UIModule/Main/Checking`：扫码、预约码、用户信息、性别选择、拍照与穿戴指引。
- `UIModule/Main/Measurement`：测量进度、波形、心电/血氧/生物电相关界面。
- `Cloud/DeviceManager.js`：封装原生硬件方法，订阅 `DeviceEventEmitter` 返回的数据。
- `Cloud/CloudManager.js`：设备注册、用户/报告接口、MQTT 指令、OSS 上传、定时开关机等业务。
- `Cloud/AutoUpdateManager.js`：应用/设备升级；`Cloud/CloudChecker.js`：网络监测与 4G 重启。
- `PublicLibs`：尺寸换算、事件总线、日志、轮询等公共能力。
- `android/app/src/main/java/com/kang_jia`：串口、心电、摄像头人脸识别、录音、FTP、配置等 RN 原生模块。
- `android/EBOLIB2ND/CommonLib`：Android 公共组件库；其他 EBOLIB2ND 模块未被当前主工程包含。

## 主要运行依赖

1. 一体机通过 `/dev/ttyS*`、115200 波特率访问测量板；随项目附带的 JNI 库只有 `armeabi-v7a`。
2. 开机先读取硬件信息并自检，再初始化云端、待机和后续测量。普通手机没有对应串口和测量板，直接走完整流程会失败。
3. 使用自定义 `react-native-camera` 分支，原生代码依赖其扩展的 Camera1 成员，不能直接换成官方相机包。
4. 生产接口与资源域名直接写在 JS/Java 中，多处使用 HTTP；还存在应用签名信息和第三方服务标识/凭据。应在后续发布前独立整理配置和凭据管理。
5. 具备自动更新、设备重启、系统设置和设备管理相关能力，部分依赖定制系统/root，普通 Android 手机无法提供相同权限。

## 发现的构建问题

- README 声明 RN 0.60.3，但 npm 锁文件缺少顶层 React/RN 项，Yarn 锁文件仍锁定 RN 0.57.1，三者不一致。
- 原 Gradle 4.1 / Android Gradle Plugin 3.0.1 与 RN 0.60 的 AndroidX 依赖不一致；机器默认 Java 21 也不适合这套旧工具链。
- npm/Yarn 锁文件有旧淘宝仓库地址，已出现证书失效；Android 有 JCenter、HTTP Maven 地址和动态 SDK 版本。
- 原生模块采用手工链接；新增或迁移原生包时需同步检查 `settings.gradle`、`app/build.gradle` 和 `MainApplication.java`。
- 不应使用 `sudo react-native run-android`；使用当前用户的 Java 8、SDK 和 ADB 即可。

## 手机预览

构建参数 `-PphonePreview=true` 仅作用于 debug，包名为 `robot.kj.com.phone`，与一体机正式包 `robot.kj.com` 分开。界面标记“手机预览”，跳过串口初始化、心电初始化、设备自检、自动升级及后台云端监测。真实检测、报告和设备固件流程仍需连接对应硬件与可用服务，手机预览不代表这些能力已验证。

运行命令：在项目目录执行 `npm run android:phone`。

按设备实际使用场景保留大屏横屏布局与原始字体，不针对手机上的换行做适配。

## 本次兼容修复

- 统一 RN/React/CLI 与 Babel 版本，重建 npm 锁文件；移除过期且版本不一致的 Yarn 锁文件。
- Android 工具链调整为 AGP 3.4.1、Gradle 6.0.1、Java 8、SDK/Build Tools 28；迁移 AndroidX，启用 Java 8 desugaring。
- 最低 Android API 调整为 21，以匹配已有 OSS 原生库的最低要求；原有 API 19/20 设备不在当前构建支持范围。
- 手工链接 NetInfo 和 SVG，补上独立 JavaScriptCore；Fresco 动图与 RN 的 Fresco 2.0.0 对齐。
- 固定原先动态下载的定位、Bugly、OSS 依赖，增加可用 Maven 镜像和随包提供的本地 AAR 仓库。
- 相机 fork 的 YuvUtil 包名与目录不符，且缺少业务层调用的预览尺寸/帧缓冲接口；在 `scripts/prepare-legacy-android.js` 中提供可重复应用的修复。人脸识别能力需在实际相机/一体机上另行验证。
- 视频依赖改用原 `^4.0.0` 范围内的 4.4.5，避开 4.0.0 npm 包缺少 FilterType 文件的问题。
- `android/app/libs/classes.jar` 是 Android 系统框架/隐藏 API 的编译参考，改为 compileOnly，避免把系统类打进 APK。
- 增加独立手机预览构建、可见提示和运行脚本，原生预览模式跳过专用硬件初始化、锁屏崩溃重启与 Bugly 初始化。

这些改动解决旧项目在本机恢复构建的问题，并不代表完成 RN 升级到当前版本。生产发布仍需针对一体机、云端接口、相机和测量流程回归。

## 真机启动阶段发现的源码问题

- 旧 Metro 的 Symbol fallback 插件调用 `path.stop()`，中止整个文件的后续转换，导致输出中残留 import/Flow 类型；兼容脚本改用 `path.skip()`，并在安装前检查整份 JS 包语法。
- `later` 的 Node 入口使用动态 require；业务改用该库自带的浏览器入口。
- `react-native-qrcode` 仍从 RN 导入已移除的 WebView；补充独立 WebView 5.12.1 与 Kotlin 1.3.72，并迁移该依赖的导入。
- 示例波形转换函数在模块加载时重赋值 const，直接导致全应用启动失败；改为 let，并验证初始化及 8/16 位有符号范围。静态扫描还修正了报告构建异常分支中 bioDataList 的同类问题。
- App.js 静态导入全部业务页面，任一页面或其依赖的初始化错误都会阻塞整个应用。这也是多个错误逐步在真机启动时暴露的原因。

## 本次验证结果（2026-11-02）

- 连接设备：Samsung SM-S908U，Android 12，支持 armeabi-v7a。
- 已完成完整 debug APK 构建、整包 JavaScript 语法检查、ADB 覆盖安装与冷启动。
- 冷启动返回 Status: ok / LaunchState: COLD，首页显示「欢迎使用名医云检测健康评估系统」「开始检测」及手机预览提示，轮播定时器正常执行，检查期间应用保持前台。
- 已撤回手机字体缩放调整，保留原大屏布局与字体。首页原有 React 列表缺 key、模块循环依赖等开发警告仍存在，不阻塞本次启动。
- 示例波形模块可独立初始化，8 位/16 位有符号范围检查通过；修改文件的 diff 空白检查及运行脚本语法检查通过。
- 未验证一体机串口、心电板、真实测量、云端报告、人脸识别及正式 release。

APK：`android/app/build/outputs/apk/debug/app-debug.apk`，约 50 MB。
运行脚本：`scripts/run-android-phone.sh`；运行截图：`.local-run/phone-running.png`。
