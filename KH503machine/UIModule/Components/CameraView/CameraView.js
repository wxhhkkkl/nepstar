import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    ImageBackground,
    Text,
    Image,
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods'
import { RNCamera } from 'react-native-camera';

const Strings = {
    title: '请始终保持面部在镜头中        '
}

const Images = {
    CameraImage: require('../../../img/Camera_Mask.png')
}

export const CameraImageSize = {
    width: PublicMethods.designToPixel(354),
    height: PublicMethods.designToPixel(454)
}

export default class CameraView extends PureComponent {
    constructor(props) {
        super(props)

        this._renderCameraImageView = this._renderCameraImageView.bind(this)
        this._renderContentView = this._renderContentView.bind(this)
    }

    /** 渲染相机图片视图 */
    _renderCameraImageView() {
        return (
            <Image 
                style = {styles.cameraImageViewCSS}
                source = {Images.CameraImage}
            >
                {/** TODO - 相机组件 */}
                {/* <RNCamera
                        ref={ref => {
                            this.camera = ref;
                        }}
                        style = {styles.preview}
                        type={RNCamera.Constants.Type.back}
                        flashMode={RNCamera.Constants.FlashMode.off}
                        permissionDialogTitle={'Permission to use camera'}
                        permissionDialogMessage={'We need your permission to use your camera phone'}
                        onGoogleVisionBarcodesDetected={({ barcodes }) => {
                            console.log(barcodes)
                        }}
                /> */}
            </Image>
        )
    }

    /** 渲染内容视图 */
    _renderContentView() {
        // 相机
        const cameraImageView = this._renderCameraImageView()
        return (
            <View style = {styles.contentViewCSS}>
                <RNCamera
                        ref={ref => {
                            this.camera = ref;
                        }}
                        style = {styles.preview}
                        type={RNCamera.Constants.Type.back}
                        flashMode={RNCamera.Constants.FlashMode.off}
                        permissionDialogTitle={'Permission to use camera'}
                        permissionDialogMessage={'We need your permission to use your camera phone'}
                        onGoogleVisionBarcodesDetected={({ barcodes }) => {
                            console.log(barcodes)
                        }}
                />
                {cameraImageView}
            </View>
        )
    }

    render() {
        const contentView = this._renderContentView()
        return (
            <View>
                {contentView}
            </View>
        )
    }
}

const styles = StyleSheet.create({
    cameraImageViewCSS: {
        position:'absolute',
        ...CameraImageSize,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        // opacity:0.3
    },
    preview: {
        position: 'absolute',
        top:10,
        height:PublicMethods.designToPixel(350),
        width:PublicMethods.designToPixel(350)*0.75,
        opacity:1.0,
        alignItems: 'center'
      },
    contentViewCSS: {
        alignItems: 'center'
    }
})