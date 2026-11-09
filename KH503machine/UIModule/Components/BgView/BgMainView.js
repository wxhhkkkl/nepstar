import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    Animated,
    Easing
} from 'react-native'

import BgBaseView from './BgBaseView'

export default class BgMainView extends BgBaseView {
    constructor(props) {
        super(props)

        // 背景颜色
        // this.bgColor = '#000000'

        this.bgImageSource = require('../../../img/BackgroundImage.jpg')
    }
}