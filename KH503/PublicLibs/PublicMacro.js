/**
 * 宏定义
 */

import {
    Dimensions,
    StatusBar,
    Platform
} from 'react-native';

/**
 * 比例信息
 * width：屏幕宽度
 * height：屏幕高度
 * scale：比例
 * fontScale：字体比例
 */
export const kScaleSize = Dimensions.get('window');

/** 状态栏高度 */
export const kStatusBarHeight = (Platform.OS === 'ios') ? 20 : StatusBar.currentHeight;