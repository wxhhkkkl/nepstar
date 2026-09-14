import React from 'react'
import {
    View,
    Text,
} from 'react-native'
import PublicMethods from '../../../PublicLibs/PublicMethods'
renderDotted = (index, height) => {
    const dottes = [];
    for (let i = 0; i < height / 8; i++) {
        dottes.push(i);
    }
    return (
        <View
            key={'space' + index}
            style={{
                position:'absolute',
                top:PublicMethods.designToPixel(12),
                flexDirection: 'column',
                marginTop: PublicMethods.designToPixel(0),
                marginBottom: PublicMethods.designToPixel(0),
                marginLeft: PublicMethods.designToPixel(2.5),
                width: PublicMethods.designToPixel(2),
                justifyContent: 'center',
            }}>
            {
                dottes.map((index) => {
                    return (
                        <View key={index}>
                            <View style={{ backgroundColor: '#FFFFFF', opacity: 0.5, width: PublicMethods.designToPixel(1), height: PublicMethods.designToPixel(2) }} />
                            <View style={{ width: PublicMethods.designToPixel(1), height: PublicMethods.designToPixel(2) }} />
                        </View>
                    )
                })
            }
        </View>
    );
};
_renderWorkStepSubView = (top = 0, left = 0, step = 3) => {
    const contentList = ['心血管', '肺功能', '免疫力', '全身评估', '重疾风险']
    const itemList = []
    for (let i = 0; i < 5; i++) {
        let color, opacity
        if (i == step) {
            color = '#3EFFDA'
            opacity = 1.0
        } else {
            color = 'rgba(255, 255, 255, 0.5)'
            opacity = 1.0
        }

        const item = (
            <View
                key={'item' + i}
                style={{
                    flexDirection: 'row',
                    // justifyContent:'center',
                    alignItems: 'center',
                    // backgroundColor:'red',
                }}>
                <View style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: PublicMethods.designToPixel(6),
                    height: PublicMethods.designToPixel(6),
                    borderWidth: PublicMethods.designToPixel(3),
                    borderColor: color,
                    borderRadius: PublicMethods.designToPixel(6 / 2),
                    opacity: opacity,
                }} />
                   
                <Text style={{
                    marginLeft: PublicMethods.designToPixel(16),
                    fontSize: PublicMethods.designToPixel(18),
                    color: color,
                    opacity: opacity
                }}>{contentList[i]}</Text>
            </View>
        )

        itemList.push(item)

        if (i != 4) {
            // const distanceView = renderDotted(i, PublicMethods.designToPixel(42))
            itemList.push((<View style={{height:PublicMethods.designToPixel(20)}} />))
        }
    }

    return (
        <View style={{
            position: 'absolute',
            flexDirection: 'column',
            top: PublicMethods.designToPixel(top),
            left: PublicMethods.designToPixel(left),

        }}>
            {this.renderDotted(32, PublicMethods.designToPixel(361))}
            {itemList}
        </View>

    )
}

export const renderWorkStepView = (top = 0, left = 0, step = 3 ,subStep=0) => {
    const contentList = ['释放静电', '皮肤采集', '佩戴', '检测', '查看结果']
    const itemList = []
    for (let i = 0; i < 5; i++) {
        let color, opacity,item
        if (i == step) {
            color = '#3EFFDA'
            opacity = 1.0
        } else {
            color = 'rgba(255, 255, 255, 0.5)'
            opacity = 1.0
        }

        if(step==3 && i==3){
            item = (
                <View
                    key={'item' + i}
                    style={{
                        flexDirection: 'row',
                        // justifyContent:'center',
                        // alignItems: 'center',
                        width: PublicMethods.designToPixel(124),
                        height: PublicMethods.designToPixel(276),
                        marginTop: PublicMethods.designToPixel(20),
                        borderRadius: PublicMethods.designToPixel(8),
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    }}>
                    <View style={{flexDirection:'row',marginTop:PublicMethods.designToPixel(3)}}>
                        <View style={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: PublicMethods.designToPixel(24),
                            height: PublicMethods.designToPixel(24),
                            marginLeft: PublicMethods.designToPixel(9),
                            borderWidth: PublicMethods.designToPixel(2),
                            borderColor: color,
                            borderRadius: PublicMethods.designToPixel(24 / 2),
                            opacity: opacity,
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        }}>
                            <Text style={{
                                fontSize: PublicMethods.designToPixel(20),
                                fontWeight: '600',
                                color: color,
                                opacity: opacity
                            }}>{i + 1}</Text>
                        </View>
                        <Text style={{
                            marginLeft: PublicMethods.designToPixel(10),
                            fontSize: PublicMethods.designToPixel(18),
                            fontWeight: '600',
                            color: color,
                            opacity: opacity
                        }}>{contentList[i]}</Text>
                    </View>
                    {this._renderWorkStepSubView(PublicMethods.designToPixel(51),PublicMethods.designToPixel(20),subStep)}
                </View>
            )
        }else{
            item = (
                <View
                    key={'item' + i}
                    style={{
                        flexDirection: 'row',
                        // justifyContent:'center',
                        alignItems: 'center',
                        width: PublicMethods.designToPixel(124),
                        height: PublicMethods.designToPixel(33),
                        marginTop: PublicMethods.designToPixel(20),
                        borderRadius: PublicMethods.designToPixel(8),
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    }}>
                        <View style={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: PublicMethods.designToPixel(24),
                            height: PublicMethods.designToPixel(24),
                            marginLeft: PublicMethods.designToPixel(9),
                            borderWidth: PublicMethods.designToPixel(2),
                            borderColor: color,
                            borderRadius: PublicMethods.designToPixel(24 / 2),
                            opacity: opacity,
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        }}>
                            <Text style={{
                                fontSize: PublicMethods.designToPixel(20),
                                fontWeight: '600',
                                color: color,
                                opacity: opacity
                            }}>{i + 1}</Text>
                        </View>
                        <Text style={{
                            marginLeft: PublicMethods.designToPixel(10),
                            fontSize: PublicMethods.designToPixel(18),
                            fontWeight: '600',
                            color: color,
                            opacity: opacity
                        }}>{contentList[i]}</Text>
                   
                </View>
            )
        }

        
        itemList.push(item)
    }

    return (
        <View style={{
            position: 'absolute',
            flexDirection: 'column',
            top: PublicMethods.designToPixel(top),
            left: PublicMethods.designToPixel(left),

        }}>
            {itemList}
        </View>
    )
}