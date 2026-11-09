import React, { PureComponent } from 'react'
import {
    View,
    Text,
    Image,
    StyleSheet
} from 'react-native'
import PropTypes from 'prop-types'
import BgBaseView from './BgBaseView'
import PublicMethods from '../../../PublicLibs/PublicMethods';
import { kScaleSize } from '../../../PublicLibs/PublicMacro';

const Images = {
    bgImage: require('../../../img/BGErrorBackgroundSource.png'),
    errorImage: require('../../../img/BGErrorImage.png'),
    errorImage2: require('../../../img/BGErrorImage_2.png'),
    errorImageNew: require('../../../img/BGErrorImageNew.png'),
}

const Fonts = {
    title: PublicMethods.designToPixel(66),
    title2: PublicMethods.designToPixel(72),
    message: PublicMethods.designToPixel(48)
}

const Colors = {
    text: 'white'
}


const ErrorImageSize = {
    width: PublicMethods.designToPixel(433),
    height: PublicMethods.designToPixel(432)
}

const ErrorImageSize2 = {
    width: PublicMethods.designToPixel(300),
    height: PublicMethods.designToPixel(300*1.51)
}

const ErrorImageNewSize = {
    width: PublicMethods.designToPixel(246),
    height: PublicMethods.designToPixel(405)
}

const propTypes = {
    title: PropTypes.string,
    message: PropTypes.string
}
const defaultProps = {
    title: '',
    message: ''
}
export default class BgErrorView extends BgBaseView {
    constructor(props) {
        super(props)

        // this.bgImageSource = Images.bgImage
        this.bgColor = 'black'
    }

    renderInfoView() {
        const { title, message } = this.props
        let titleViewStyle = styles.titleViewCSS
        if (message.length) {
            titleViewStyle = styles.title2ViewCSS
        }
        const titleView = (
            <Text style = {titleViewStyle}>
                {title}
            </Text>
        )
        const messageView = (
            <Text style = {styles.messageViewCSS}>
                {message}
            </Text>
        )

        const {type} =  this.props;
        // let errorImage = null;
        // if(type == 2){
        //     errorImage = (
        //         <Image 
        //             style = {styles.errorImageCSS2}
        //             source = {Images.errorImage2}
        //             resizeMode = {'center'}
        //         />
        //     )
        // }else{
        //     errorImage = (
        //         <Image 
        //             style = {styles.errorImageCSS}
        //             source = {Images.errorImage}
        //             resizeMode = {'center'}
        //         />
        //     )
        // }  

        const errorImage = (
            <Image 
                style = {styles.errorImageNewCSS}
                source = {Images.errorImageNew}
                resizeMode = {'center'}
            />
        )
        return (
           <View style = {styles.infoViewCSS}>
                <View style = {styles.textContainerCSS}>
                    {titleView}
                    {messageView}
                </View>
               {errorImage}
           </View> 
        )
    }
}
BgErrorView.propTypes = propTypes
BgErrorView.defaultProps = defaultProps

const styles = StyleSheet.create({
    infoViewCSS: {
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%'
    },
    textContainerCSS: {
        width: '100%',
        height: kScaleSize.height - ErrorImageSize.height - PublicMethods.designToPixel(60),
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleViewCSS: {
        color: Colors.text,
        fontSize: Fonts.title,
        textAlign: 'center',
    },
    title2ViewCSS: {
        color: Colors.text,
        fontSize: Fonts.title2,
        textAlign: 'center',
    },
    messageViewCSS: {
        color: Colors.text,
        fontSize: Fonts.message,
        textAlign: 'center',
        marginTop: PublicMethods.designToPixel(80)
    },
    errorImageCSS: {
        ...ErrorImageSize
    },
    errorImageCSS2: {
        ...ErrorImageSize2
    },
    errorImageNewCSS: {
        ...ErrorImageNewSize
    }
})