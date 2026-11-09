import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity
} from 'react-native'
import * as App from '../../../../App';
import Button from 'react-native-flat-button';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
const M = PublicMethods
const ROW_HEIGHT = 40;
export default class ToolingCellView extends PureComponent {
    constructor(props){
        super(props)
    }

    componentDidMount () {
        
    }

    render(){
        const {title,description,extDescription,onPress,onExtPress,isShowButton,isShowExtButton,result,extView} = this.props;
        let resultText = '';
        let fontColor = 'white'
        switch (result) {
            case 0:
                resultText = '待检测'
                fontColor = 'white'
                // resultText = '不合格'
                // fontColor = 'red'
                break;
            case 1:
                resultText = '合格'
                fontColor = 'rgba(138,238,120,1.0)'

                break;
            case 2:
                resultText = '不合格'
                fontColor = 'red'
                break;
            default:
                break;
        }
        let buttonView = null;
        let extButtonView = null;
        if(isShowButton){
            buttonView = (
                <View>
                    <Button
                        containerStyle = {{
                            width:M.designToPixel(60),
                            height:M.designToPixel(40)
                        }}
                        onPress = {onPress}
                    >
                    {description}
                </Button>
                    {extView}
                </View>
                
            )
        }else{
            buttonView = <Text style={
                [styles.infoText,
                    {
                        width:M.designToPixel(260),
                        fontSize:
                            description.length>M.designToPixel(20)?M.designToPixel(16):M.designToPixel(25)}
                        ]}>{description}</Text>
        }

        if(isShowExtButton){
            extButtonView = (
                <Button
                    containerStyle = {{
                        marginLeft:M.designToPixel(20),
                        width:M.designToPixel(60),
                        height:M.designToPixel(40)
                    }}
                    onPress = {onExtPress}
                    >
                    {extDescription}
                </Button>
            )
        }

        let viewHeight = ROW_HEIGHT;
        if(isShowButton){
            viewHeight = M.designToPixel(60);
        }
        if(!PublicMethods.isEmpty(extView)){
            viewHeight = M.designToPixel(200);
        }

        return (
            <View style={
                {
                    flexDirection: 'row',
                }
            }>
                <Text style={
                    [styles.infoText,
                        {height:viewHeight,width:M.designToPixel(200)}]
                }>{title}</Text>
                <View style={
                    {
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        width:M.designToPixel(300),
                        height:viewHeight,
                        // backgroundColor:'yellow'
                    }
                }>
                    {buttonView}
                    {extButtonView}
                </View>
                
                <TouchableOpacity onPressIn={this.props.onResultPress}>
                    <Text style={[styles.infoText,
                        {
                            color:fontColor,
                            height:viewHeight,
                            // backgroundColor:'red'
                        }]}>
                        {resultText}
                    </Text>
                </TouchableOpacity>

            </View>
        )
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    title:{
        fontSize:M.designToPixel(25),
        color:'white',
        fontWeight:'bold'
    },
    infoText:{
        fontSize:M.designToPixel(25),
        color:'white',
        justifyContent: 'center',
        alignItems: 'flex-start',
        height:ROW_HEIGHT,
        textAlignVertical:'center'
    }
})