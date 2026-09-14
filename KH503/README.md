1. node 环境 12.22.12  
2. react native 版本 0.60.3
3. python：必须2.6
4. sdk：android 28
5. build tools: 28.0.0
6. 安装 watchman  
7. mac环境下 项目必须放在 用户目录下 与当前使用者目录平级别 否则会因为权限不足打包失败
8. 项目步骤 1. npm run start  2 .source ~/.bash_profile(让 adb devices 生效)    3.sudo raact-native run-android
9. adb shell input keyevent 82 开启热更新 hot