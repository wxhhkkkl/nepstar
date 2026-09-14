import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods';
import { kScaleSize } from '../../../PublicLibs/PublicMacro';
import LineChartView from './LineChartView'

const Colors = {
    BorderColor: '#3ee4fa',
}

const BorderWidth = PublicMethods.designToPixel(2)

const propTypes = {
    lineColor: PropTypes.string,
    maxYValueA: PropTypes.number,
    minYValueA: PropTypes.number,
    maxYValueB: PropTypes.number,
    minYValueB: PropTypes.number
}
const defaultProps = {
    lineColor: Colors.BorderColor,
    maxYValueA: 0,
    minYValueA: 0,
    maxYValueB: 0,
    minYValueB: 0
}
export default class ChartView extends PureComponent {
    constructor(props) {
        super(props)

        this.setChartData = this.setChartData.bind(this);
        this.setChartDataA = this.setChartDataA.bind(this);
        this.setChartDataB = this.setChartDataB.bind(this);
        this.setChartDataC = this.setChartDataC.bind(this);
        this.data = [0];

        this.state = {
            values: [[0]],
            valuesA:[0],
            valuesB:[0],
            valuesC:[0]
        }
    }

    /** 设置波形数据 */
    setChartData(data = [[0]]) {
        this.setState({
            values: data
        })
    }

    setChartDataA(data = [0]) {
        this.setState({
            valuesA: data
        })
    }
    setChartDataB(data = [0]) {
        this.setState({
            valuesB: data
        })
    }
    setChartDataC(data = [0]) {
        this.setState({
            valuesC: data
        })
    }

    render() {
        const { values,valuesA ,valuesB,valuesC} = this.state
        // const lineChartViews = values.map((value, index) => {
        //     return (
        //         <LineChartView 
        //             key = {'LineChartView_' + index}
        //             lineColor = {Colors.BorderColor}
        //             lineWidth = {BorderWidth}
        //             values = {value}
        //         />
        //     )
        // })

        const { 
            lineColor,
            maxYValueA, 
            minYValueA,
            maxYValueB,
            minYValueB,
            maxYValueC,
            minYValueC
        } = this.props
        
        return (
            <View style = {styles.containerCSS}>
                {/* {lineChartViews} */}
                <LineChartView 
                    key = {'LineChartView_A'}
                    lineColor = {lineColor}
                    lineWidth = {BorderWidth}
                    values = {valuesA}
                    maxYValue = {maxYValueA}
                    minYValue = {minYValueA}
                    height = {150}
                />
                {/* <View style = {{height: PublicMethods.designToPixel(10)}}/> */}
                {/* <LineChartView 
                    key = {'LineChartView_B'}
                    lineColor = {Colors.BorderColor}
                    lineWidth = {BorderWidth}
                    values = {valuesB}
                    maxYValue = {maxYValueB}
                    minYValue = {minYValueB}
                    height = {130}
                /> */}
                {/* <View  style = {{height:10}}/>
                <LineChartView 
                    key = {'LineChartView_C'}
                    style = {{marginTop:10}}
                    lineColor = {Colors.BorderColor}
                    lineWidth = {BorderWidth}
                    values = {valuesC}
                    maxYValue = {maxYValueC}
                    minYValue = {minYValueC}
                /> */}
            </View>
        );
    }
}
ChartView.propTypes = propTypes
ChartView.defaultProps = defaultProps

const styles = StyleSheet.create({
    containerCSS: {
        justifyContent: 'space-between',
        alignItems: 'center',
        // borderColor: Colors.BorderColor,
        // borderWidth: BorderWidth,
        flex: 1
    }
})