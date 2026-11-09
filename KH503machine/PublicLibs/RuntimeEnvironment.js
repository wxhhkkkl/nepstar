import {NativeModules} from 'react-native';

// Enabled only by the Android debug build's -PphonePreview=true option.
export const isPhonePreview = NativeModules.RNConfigModule.phonePreview === true;
