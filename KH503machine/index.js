import React from 'react';
import { AppRegistry, View, Text } from 'react-native';
import App from './App';
import {isPhonePreview} from './PublicLibs/RuntimeEnvironment';

const Root = () => (
    <View style={{flex: 1}}>
        <App />
        {isPhonePreview && <Text pointerEvents="none" style={{position: 'absolute', top: 0, right: 0,
            padding: 6, color: '#fff', backgroundColor: '#805300', fontSize: 12}}>
            手机预览 · 测量需连接专用硬件
        </Text>}
    </View>
);

AppRegistry.registerComponent('kang_jia', () => Root);
