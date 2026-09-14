import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    processColor
} from 'react-native'
import PropTypes from 'prop-types'
import { LineChart } from 'react-native-charts-wrapper'
import PublicMethods from '../../../PublicLibs/PublicMethods';

const propTypes = {
    /** 线颜色 */
    lineColor: PropTypes.string,
    /** 线宽 */
    lineWidth: PropTypes.number,
    /** 数值数组 */
    values: PropTypes.arrayOf(PropTypes.number),
    /** Y轴最大值 */
    maxYValue: PropTypes.number,
    /** Y轴最小值 */
    minYValue: PropTypes.number,
    /** 高度 */
    height: PropTypes.number
}
const defaultProps = {
    lineColor: 'blue',
    lineWidth: 2,
    values: [0],
    maxYValue: 0,
    minYValue: 0,
    height: -1
}
export default class LineChartView extends PureComponent {
    constructor(props) {
        super(props)

        this._configUpdateDataSource = this._configUpdateDataSource.bind(this)
        this._chart = null
    }

    /** 配置待更新数据 */
    _configUpdateDataSource(
        values = [0],
        color = processColor('blue'),
        lineWidth = 2
    ) {
        
        /** 数据源及配置 */
        const dataSets = [
            {
                values,
                label: '',
                config: {
                    color,
                    lineWidth,
                    // mode: 'CUBIC_BEZIER',
                    drawValues: false,
                    drawCircles: false
                }
            }
        ]
        // 坐标轴配置
        /** x轴 */
        const xAxis = {
            enabled: false
            // axisLineWidth: 0,
            // drawLabels: false,
            // position: 'BOTTOM',
            // drawGridLines: false
        }
        /** y轴 */
        let yAxis = {
            enabled: false
            // axisLineWidth: 0,
            // drawLabels: false,
            // position: 'OUTSIDE_CHART',
            // drawGridLines: false,
            // zeroLine: {
            //     enabled: false
            // }
        }
        const { maxYValue, minYValue } = this.props
        if (maxYValue !== minYValue) {
            yAxis = Object.assign(yAxis, {
                axisMaximum: maxYValue,
                axisMinimum: minYValue
            })
        }

        return {
            data: { dataSets },
            xAxis,
            yAxis: {
                left: yAxis,
                right: yAxis
            }
        }
    }

    render() {
        const { 
            values, 
            lineColor, 
            lineWidth,
            height
        } = this.props
        const {
            data,
            xAxis,
            yAxis
        } = this._configUpdateDataSource(values, processColor(lineColor), lineWidth)
        
        const sizeStyle = (height === -1) ? { flex: 1 } : { height }
        const chartView = (
            <LineChart 
                ref = {(chart) => this._chart = chart}
                style = {[ styles.chartViewCSS, sizeStyle]}
                marker = {{ enabled: false} }
                data = {data}
                xAxis = {xAxis}
                yAxis = {yAxis}
                drawBorders = {false}
                touchEnabled = {false}
                drawGridBackground = {false}
                scaleEnabled = {false}
                dragEnabled = {false}
                pinchZoom = {false}
                doubleTapToZoomEnabled = {false}
                chartDescription = {{text: ''}}
                legend = {{enabled: false}}
            />
        )
        return chartView
    }
}
LineChartView.propTypes = propTypes
LineChartView.defaultProps = defaultProps

const styles = StyleSheet.create({
    chartViewCSS: {
        width: '100%',
        backgroundColor: 'transparent'
    }
})