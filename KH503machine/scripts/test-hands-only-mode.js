// Offline checks only: no device, patient data, network or report submission.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const types = require('@babel/types');
const babel = require('@babel/core');
const policy = require('../UIModule/Components/Mode/DetectionModePolicy');
let checks = 0;
function check(name, action) { action(); checks++; process.stdout.write(`PASS ${name}\n`); }

check('release logging retains console.assert required by RN networking', () => {
  const ast = parser.parse(fs.readFileSync(path.join(__dirname, '../App.js'), 'utf8'),
    {sourceType: 'module', plugins: ['jsx']});
  const releaseBlock = ast.program.body.find(node => node.type === 'IfStatement' &&
    node.test.type === 'UnaryExpression' && node.test.argument.name === '__DEV__');
  let asserted = false, logged = false;
  const original = {assert: value => { asserted = value; }, log: () => { logged = true; }};
  Object.defineProperty(original, 'time', {value: () => 'timer', enumerable: false});
  const global = {console: original};
  vm.runInNewContext(generate(releaseBlock).code, {__DEV__: false, global});
  assert.strictEqual(global.console, original);
  global.console.assert(true); global.console.log('silenced');
  assert.strictEqual(asserted, true); assert.strictEqual(logged, false);
  assert.strictEqual(global.console.time(), 'timer');
});

check('only official mode 30 skips head and legs', () => {
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 31, 32].forEach(mode => {
    assert.strictEqual(policy.isHandsOnlyMode(mode), false);
    assert.strictEqual(policy.isHandsOnlyMode(String(mode)), false);
  });
  assert.strictEqual(policy.isHandsOnlyMode(30), true);
  assert.strictEqual(policy.isHandsOnlyMode('30'), true);
});

// Run methods extracted from the actual legacy screens, without mounting RN.
function method(relative, name, context) {
  const ast = parser.parse(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'),
    {sourceType: 'module', plugins: ['jsx', 'classProperties']});
  const cls = ast.program.body.find(n => n.type === 'ExportDefaultDeclaration').declaration;
  const member = cls.body.body.find(n => n.key.name === name);
  const fn = member.type === 'ClassMethod'
    ? types.functionExpression(null, member.params, member.body, false, member.async) : member.value;
  const code = babel.transformSync(`(${generate(fn).code})`, {babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx']}).code;
  return vm.runInNewContext(code, context);
}
const equippedFile = 'UIModule/Main/Checking/DeviceEquipped/DeviceEquippedView.js';
check('original wearing screen skips only head and legs in mode 30', () => {
  for (const handsOnly of [false, true]) {
    for (const hand of [false, true]) for (const press of [false, true]) {
      let destination, step;
      const screen = {_handsOnly: handsOnly, state: {
        sensorStatusFoot: false, sensorStatusHead: false,
        sensorStatusHand: hand, sensorStatusPress: press
      }, _resetTimer() {}, props: {navigation: {replace: route => { destination = route; }}},
        _goToStep1: () => { step = 1; }, _goToStep2: () => { step = 2; },
        _goToStep3: () => { step = 3; }, _goToStep4: () => { step = 4; }};
      const update = method(equippedFile, '_updateStepUI', {
        setTimeout: fn => { fn(); return 1; },
        kSensorEquipStep: {foot: 1, head: 2, hand: 3, press: 4},
        kCheckingModuleName: {DeviceFinishPage: 'countdown'}
      });
      update.call(screen);
      assert.strictEqual(destination, handsOnly && hand && press ? 'countdown' : undefined);
      if (!destination) assert.strictEqual(step, handsOnly ? (hand ? 4 : 3) : 1);
      assert.strictEqual(screen.state.sensorStatusHead, false);
      assert.strictEqual(screen.state.sensorStatusFoot, false);
    }
  }
});
check('legacy modes still require the head after both legs are connected', () => {
  let step;
  method(equippedFile, '_updateStepUI', {setTimeout: fn => fn(),
    kSensorEquipStep: {foot: 1, head: 2, hand: 3, press: 4}}).call({
    _handsOnly: false, state: {sensorStatusFoot: true, sensorStatusHead: false,
      sensorStatusHand: true, sensorStatusPress: true},
    _goToStep2: () => { step = 2; }, _resetTimer() {}
  });
  assert.strictEqual(step, 2);
});
check('head and leg panels and overlays are absent only in mode 30', () => {
  ['_renderPanel1', '_renderPanel2', '_renderHeadSensor', '_renderFootSensor'].forEach(name => {
    assert.strictEqual(method(equippedFile, name, {}).call({_handsOnly: true}), null);
  });
});
// Execute the actual CloudManager methods with mocked I/O. Extracting methods
// avoids running the application's singleton timers and MQTT initialization.
function reportFixture(modeValue = 0) {
  const ast = parser.parse(fs.readFileSync(path.join(__dirname, '../Cloud/CloudManager.js'), 'utf8'),
    {sourceType: 'module', plugins: ['classProperties']});
  const cls = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'ClassDeclaration').declaration;
  const requests = [];
  const device = {bioDataList: [[10100, 20], [10200, 21]],
    getECGDataList: async () => [1, 3, 2],
    getOxygenDataList: async () => Array.from({length: 12}, () => [72, 98, 60, [1, 2]]),
    checkBioDataByHuman: () => true};
  const context = {deviceManager: device,
    M: {transfromDateInfo: () => 'test-time', isEmpty: value => !value},
    ErrorCode: {REPORT_DATA_ERROR: '510'}, DeviceInfo: {deviceSN: 'TEST'},
    UserInfo: {userSex: '1', userId: 'saaswxTEST-USER'}, CloudInfo: {type: 'KH503'},
    modeUtil: {getMode: () => modeValue}, Logger: {appendLogInfo() {}},
    AsyncStorage: {setItem: async () => {}}, global: {isPrint: false},
    TAG: 'test', LOG_TAG: 'test', root_header_prefix: 'https://test.invalid', console: {log() {}}};
  const manager = {_reportId: 'TEST-REPORT', request: async request => {
    requests.push(request); return {code: 200, reportUrl: 'https://test.invalid/report'};
  }, _checkOverTime() {}};
  ['uploadReportV2', '_calSpo2Data'].forEach(name => {
    const method = cls.body.body.find(node => node.key.name === name);
    manager[name] = vm.runInNewContext(`(${generate(types.functionExpression(null, method.params, method.body)).code})`, context);
  });
  return {manager, device, requests};
}

async function main() {
  function load(relative, mocks) {
    const filename = path.join(__dirname, '..', relative);
    const code = babel.transformFileSync(filename, {babelrc: false, configFile: false,
      plugins: ['@babel/plugin-proposal-class-properties', '@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs']}).code;
    const module = {exports: {}};
    vm.runInNewContext(code, {module, exports: module.exports,
      require: name => {
        if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
        if (/\.png$/.test(name)) return 1;
        throw new Error(`Unexpected dependency: ${name}`);
      }, setTimeout, clearTimeout, setInterval: () => 0, console}, {filename});
    return module.exports;
  }
  const qrInfo = {handleMode: 30};
  const mode = load('UIModule/Components/Mode/DetectionMode.js', {
    '../../../Cloud/CloudManager': {QRInfo: qrInfo}, './DetectionModePolicy': policy,
  }).detectionMode;
  const React = require('react');
  const util = load('UIModule/Components/Mode/ModeUtil.js', {
    react: React, 'react-native': {StyleSheet: {create: value => value}},
    '../../../PublicLibs/PublicMethods': {designToPixel: value => value, isEmpty: value => !value},
    'react-native-picker': {}, '../../../Cloud/CloudManager': {QRInfo: qrInfo, PackageInfo: {}},
  }).modeUtil;
  assert.strictEqual(util.getMode(), 30);
  assert.strictEqual(util.needJumpInQRView(), true);
  assert.strictEqual(util.needZeroUserId(), false);
  assert.strictEqual(mode.isHandsOnly(), true);
  assert.strictEqual(util.needJumpCodeInput(), false);
  qrInfo.handleMode = 0;
  assert.strictEqual(util.getMode(), 0); assert.strictEqual(mode.isHandsOnly(), false);
  assert.strictEqual(util.needJumpInQRView(), false); assert.strictEqual(util.needJumpCodeInput(), true);
  for (const value of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30, '30', 31, 32, '32']) {
    qrInfo.handleMode = value;
    assert.strictEqual(util.getMode(), value);
    assert.strictEqual(mode.isHandsOnly(), Number(value) === 30);
    assert.strictEqual(util.needZeroUserId(), [2, 3, 4, 5, 6, 7, 10].includes(Number(value)));
    assert.strictEqual(util.needJumpInQRView(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 30, 31].includes(Number(value)));
    assert.strictEqual(util.needJumpCodeInput(), Number(value) === 0);
    let dispatched;
    util.runMode({30: () => { dispatched = 30; }, 32: () => { dispatched = 32; },
      default: () => { dispatched = 'default'; }});
    assert.strictEqual(dispatched, [30, 32].includes(Number(value)) ? Number(value) : 'default');
  }
  qrInfo.handleMode = 30;
  checks++; process.stdout.write('PASS real handleMode controls display, identity routing and acquisition without local override\n');
  const genderAST = parser.parse(fs.readFileSync(path.join(__dirname, '../UIModule/Main/Checking/GenderSelection/GenderSelectionView.js'), 'utf8'),
    {sourceType: 'module', plugins: ['jsx', 'classProperties']});
  let nextAction;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'renderNextButton') nextAction = node.arguments[0];
    Object.values(node).forEach(value => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    });
  }
  walk(genderAST);
  const routeNames = new Proxy({}, {get: (target, name) => name});
  const genderNext = vm.runInNewContext(`(${generate(types.functionExpression(null, nextAction.params, nextAction.body)).code})`,
    {modeUtil: util, clearTimeout() {}, kCheckingModuleName: routeNames});
  const expectedIdentity = {0: 'DischargeElectricityPage', 1: 'DischargeElectricityPage', 2: 'UserInfoView',
    3: 'MobileInputView', 4: 'VerifyCodeInputView', 5: 'SalesmanCodeInputView', 6: 'BothCodeInputView',
    7: 'BothCodeInputView', 8: 'DischargeElectricityPage', 9: 'DischargeElectricityPage',
    10: 'VerifyCodeInputM10View', 30: 'UserInfoView', 31: 'DischargeElectricityPage', 32: 'DischargeElectricityPage'};
  Object.entries(expectedIdentity).forEach(([modeValue, expected]) => {
    qrInfo.handleMode = Number(modeValue); let destination;
    genderNext.call({props: {navigation: {replace: route => { destination = route; }}}});
    assert.strictEqual(destination, expected);
  });
  qrInfo.handleMode = 30;
  checks++; process.stdout.write('PASS mode 30 retains user info and all other identity branches stay unchanged\n');
  check('all modes mount the original wearing, measurement and upload pages directly', () => {
    const routes = [
      ['App.js', 'MeasurementModule', 'MeasureMainView', './UIModule/Main/Measurement/Index/MeasureMainView'],
      ['UIModule/Main/Checking/CheckingModule.js', 'DeviceEquippedPage', 'DeviceEquippedView', './DeviceEquipped/DeviceEquippedView'],
      ['UIModule/Main/System/UploadModule/UploadModule.js', 'SystemUploadPage', 'SystemUploadView', './SystemUploadView']
    ];
    routes.forEach(([file, route, component, source]) => {
      const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      assert(text.includes(route + ': ' + component));
      assert(text.includes("from '" + source + "'"));
      assert(!text.includes('ModeAware'));
    });
  });
  check('mode 30 retains its completion page; all other completion routes stay intact', () => {
    const expected = {0: 'SystemFinishPage', 1: 'SystemMode1FinishView', 2: 'SystemUserInfoFinishPage',
      3: 'SystemSalesmanFinishView', 4: 'SystemVerifyCodeInfoFinishPage', 5: 'SystemSalesmanFinishView',
      6: 'SystemVerifyCodeInfoFinishPage', 7: 'SystemSalesmanFinishView', 8: 'SystemMode8FinishView',
      9: 'SystemVerifyCodeInfoFinishPage', 10: 'SystemMode10FinishView',
      30: 'SystemFinishPage', 31: 'SystemFinishPage', 32: 'SystemFinishPage'};
    const next = method('UIModule/Main/System/UploadModule/SystemUploadView.js', '_goToNextStep', {
      modeUtil: util, kUploadModuleName: routeNames
    });
    for (const [value, route] of Object.entries(expected)) {
      qrInfo.handleMode = Number(value); let destination;
      next.call({props: {navigation: {push: name => { destination = name; }}}});
      assert.strictEqual(destination, route);
    }
  });
  for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9, 30, '30', 31]) {
    qrInfo.handleMode = value;
    let destination;
    await method('UIModule/Main/Checking/QRScanning/QRScanningView.js', 'componentDidMount', {
      modeUtil: util, QRInfo: qrInfo, console: {log() {}}, Logger: {appendLogInfo() {}}, LOG_TAG: 'test', TAG: 'test',
      setTimeout: fn => fn(), kCheckingModuleName: routeNames
    }).call({props: {navigation: {replace: name => { destination = name; }}}});
    const expected = [1, 30, 31].includes(Number(value)) ? 'QRScanningMode1Page' :
      [8, 9].includes(Number(value)) ? 'QRScanningMode8And9Page' : 'GenderSelectionPage';
    assert.strictEqual(destination, expected);
  }
  checks++; process.stdout.write('PASS mode 30 retains the original scanner and all other scanner routes remain intact\n');
  for (const value of [30, '30', 31, 32, '32', 0, 2]) {
    qrInfo.handleMode = value; let sound, timeout;
    method('UIModule/Main/System/UploadModule/SystemFinishView.js', 'componentDidMount', {
      modeUtil: util, Logger: {appendLogInfo() {}}, LOG_TAG: 'test',
      TimeoutTimer: {sharedInstance: () => ({startTimer() {}})},
      global: {isPrint: false}, deviceManager: {playSound: value => { sound = value; }},
      SoundId: {id_zdd_finish: 'mode30', id_test_report: 'default'},
      setTimeout: (fn, ms) => { timeout = ms; return 1; }
    }).call({});
    assert.strictEqual(sound, [30, 31].includes(Number(value)) ? 'mode30' : 'default');
    assert.strictEqual(timeout, 30000);
  }
  checks++; process.stdout.write('PASS mode 30 retains its completion sound and timeout; mode 32 has no alias\n');
  for (const modeValue of [0, 30, 31, 32]) {
    const handsOnly = policy.isHandsOnlyMode(modeValue);
    const timers = [], intervals = [], sounds = [], logs = [];
    const device = {findFaceEnable() {}, controlLockScreen() {}, openNumberOrderLed() {},
      playSound: sound => sounds.push(sound), isTouchingBioBall: true,
      isTouchingLeg: false, isTouchingHead: false, isFaceModuleCrash: false};
    const screen = {_handsOnly: handsOnly, isTouchSpo2: true, allowPlay: true,
      state: {}, lastFindFaceTime: 100000, lastPlayLegOffTime: 0, lastPlayHeadOffTime: 0,
      headOffCount: 0, legOffCount: 0, setState(value) { Object.assign(this.state, value); },
      _recordPlayDuration() {}, findFace() {}};
    await method('UIModule/Main/Measurement/Index/MeasureMainView.js', 'componentDidMount', {
      deviceManager: device, requestAnimationFrame() {},
      setInterval: (fn, ms) => { intervals.push({fn, ms}); return intervals.length; },
      setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
      clearTimeout() {}, clearInterval() {},
      Date: class extends Date { getTime() { return 100000; } },
      Logger: {appendLogInfo: (...args) => logs.push(args)},
      LOG_TAG: 'test', TAG: 'test', console: {log() {}},
      modeUtil: {getMode: () => modeValue},
      TimeoutTimer: {sharedInstance: () => ({stopTimer() {}})},
      DeviceEventEmitter: {addListener() {}},
      SoundId: {id_testing: 'testing', id_keep_leg: 'legs', id_keep_head: 'head',
        id_keep_finger: 'finger', id_keep_hand: 'hands'},
      Strings: {KeepElectroNodeOnFoot: 'legs', KeepElectronNodeOnHead: 'head',
        EquipFingerSensor: 'finger', KeepBothHandOnSensor: 'hands'}
    }).call(screen);
    timers.find(timer => timer.ms === 8000).fn();
    const monitor = intervals.find(timer => timer.ms === 500).fn;
    sounds.length = 0; monitor();
    assert.strictEqual(sounds.includes('legs'), !handsOnly);
    assert.strictEqual(sounds.includes('head'), !handsOnly);
    if (handsOnly) assert.strictEqual(screen.state.showExceptionInfoView, false);
    device.getElectrodeStatusCallback({head: false, leftLeg: false, rightLeg: false,
      leftArm: true, rightArm: true});
    assert.strictEqual(screen.isTouchECG, handsOnly);
    screen.isTouchSpo2 = false; screen.lastPlaySpo2OffTime = 0;
    sounds.length = 0; monitor(); assert(sounds.includes('finger'));
    device.isTouchingBioBall = false; screen.lastPlayHandOffTime = 0; screen.handOffCount = 0;
    sounds.length = 0; monitor(); assert(sounds.includes('hands'));
    checks++; process.stdout.write(`PASS original measurement reminders in mode ${modeValue}: head/leg scope, finger and hands retained\n`);
  }
  for (const [modeValue, result, success] of [
    [30, async () => ({reportUrl: 'https://test.invalid/report'}), true],
    [30, async () => ({}), true],
    [30, async () => { throw {code: '510'}; }, true],
    [0, async () => ({reportUrl: 'https://test.invalid/report'}), true],
    [30, async () => { throw new Error('network'); }, true],
    [32, async () => { throw new Error('network'); }, false],
    [0, async () => { throw new Error('network'); }, false],
    [2, async () => { throw {code: '510'}; }, false]
  ]) {
    let next = 0, errors = 0, options;
    const screen = {_goToNextStep: () => next++, componentWillUnmount() {}};
    await method('UIModule/Main/System/UploadModule/SystemUploadView.js', 'componentDidMount', {
      Logger: {appendLogInfo() {}}, LOG_TAG: 'test', TAG: 'test', console: {log() {}},
      modeUtil: {getMode: () => modeValue},
      cloudManager: {uploadReportV2: value => { options = value; return result(); }},
      deviceManager: {playSound() {}, stopSound() {}}, SoundId: {},
      PublicMethods: {delayTime: async () => {}}, setTimeout: fn => { fn(); return 1; }, clearTimeout() {},
      SharedEventEmitter: {sharedEmitter: () => ({eventEmitter: () => ({emit: () => errors++})})},
      App: {kSwitchToErrorModuleEvent: 'error'}, ErrorCode: {REPORT_DATA_ERROR: '510', UPLOAD_REPORT_ERROR: '500'}
    }).call(screen);
    assert.strictEqual(options, undefined);
    assert.strictEqual(next, success ? 1 : 0);
    assert.strictEqual(errors, success ? 0 : 1);
  }
  checks++; process.stdout.write('PASS mode 30 retains upload completion behavior; other modes retain errors\n');
  for (const modeValue of [0, 2, 30, '30', 31, 32, '32']) {
    const f = reportFixture(modeValue);
    await f.manager.uploadReportV2();
    assert.strictEqual(f.requests.length, 1);
    const body = f.requests[0].body;
    assert.strictEqual(body.userInfo.userId, [30, 31].includes(Number(modeValue)) ? 'HD30TEST-USER' : 'saaswxTEST-USER');
    assert.deepStrictEqual(JSON.parse(body.dataInfos.find(info => info.data_type === 'ECG').data), [1, 3, 2]);
    assert.deepStrictEqual(JSON.parse(body.dataInfos.find(info => info.data_type === 'DDS').data).slice(0, 2), f.device.bioDataList);
    for (const mutate of [
      device => { device.getECGDataList = async () => []; },
      device => { device.bioDataList = [[]]; },
      device => { device.getOxygenDataList = async () => [[72, 98, 60]]; },
      device => { device.checkBioDataByHuman = () => false; }
    ]) {
      const failed = reportFixture(modeValue); mutate(failed.device);
      await assert.rejects(failed.manager.uploadReportV2(), error => error.code === '510');
      assert.strictEqual(failed.requests.length, 0);
    }
  }
  checks++; process.stdout.write('PASS mode 30 retains report user binding and real ECG/SPO2/DDS validation; other modes are unchanged\n');
  const f = reportFixture(30); f.device.getOxygenDataList = async () => { throw new Error('native read failed'); };
  await assert.rejects(f.manager.uploadReportV2(), /native read failed/);
  checks++; process.stdout.write('PASS native read failures reject instead of hanging\n');
  process.stdout.write(`${checks} checks passed\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
