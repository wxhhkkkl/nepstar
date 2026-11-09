'use strict';
var React = require('react');
var PropTypes = require('prop-types');
var createReactClass = require('create-react-class');
var View = require('react-native').View;
var WebView = require('react-native-webview').WebView;

// Literal ES5 scripts also report failure if render.toString() is not executable
// in the kiosk WebView. Never send the QR value or the HTML back to native.
var diagnosticStart = "<script>(function(){window.__khQRSend=function(v){try{window.ReactNativeWebView.postMessage(JSON.stringify(v));}catch(e){}};window.addEventListener('error',function(e){window.__khQRSend({stage:'script-error',errorName:e.error&&e.error.name||'ScriptError',line:e.lineno||0});});window.__khQRSend({stage:'script-start'});})();</script>";
var diagnosticEnd = "<script>(function(){function probe(stage){var c=document.querySelector('canvas'),r=c.getBoundingClientRect(),v={stage:stage,width:c.width,height:c.height,cssWidth:r.width,cssHeight:r.height,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,dpr:window.devicePixelRatio||1};try{var x=c.getContext('2d');v.context2d=!!x;if(x&&c.width&&c.height){var p=x.getImageData(0,0,c.width,c.height).data,b=0;for(var i=0;i<p.length;i+=4){if(p[i+3]>0&&p[i]<128&&p[i+1]<128&&p[i+2]<128)b++;}v.blackPixels=b;}}catch(e){v.errorName=e.name;}window.__khQRSend(v);}probe('canvas-immediate');setTimeout(function(){probe('canvas-delayed');},700);})();</script>";

var Canvas = createReactClass({
    propTypes: {
        style: PropTypes.object,
        context: PropTypes.object,
        render: PropTypes.func.isRequired,
        onLoad: PropTypes.func,
        onLoadEnd: PropTypes.func,
        onDiagnostic: PropTypes.func,
    },
    componentDidMount: function() {
        if (this.props.onDiagnostic) {
            this._diagnosticTimer = setTimeout(() => {
                this.reportDiagnostic({stage: 'watchdog', canvasProbeReceived: !!this._canvasProbeReceived});
            }, 8000);
        }
    },
    componentWillUnmount: function() {
        clearTimeout(this._diagnosticTimer);
    },
    reportDiagnostic: function(data) {
        if (this.props.onDiagnostic) this.props.onDiagnostic(data);
    },
    onDiagnosticMessage: function(event) {
        try {
            var data = JSON.parse(event.nativeEvent.data);
            if (data.stage === 'canvas-delayed') this._canvasProbeReceived = true;
            this.reportDiagnostic(data);
        } catch (error) {
            this.reportDiagnostic({stage: 'message-error', errorName: error.name});
        }
    },
    render: function() {
        var contextString = JSON.stringify(this.props.context);
        var renderString = this.props.render.toString();
        var diagnostic = !!this.props.onDiagnostic;
        var draw = '(' + renderString + ').call(' + contextString + ', canvas);';
        if (diagnostic) draw = "try{" + draw + "window.__khQRSend({stage:'draw-return'});}catch(e){window.__khQRSend({stage:'draw-error',errorName:e.name});}";
        var html = "<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'><style>*{margin:0;padding:0;}html,body{width:100%;height:100%;overflow:hidden;}canvas{position:absolute;left:0;top:0;width:100%;height:100%;transform:translateZ(0);}</style><canvas></canvas>" +
            (diagnostic ? diagnosticStart : '') + "<script>var canvas = document.querySelector('canvas');" + draw + "</script>" + (diagnostic ? diagnosticEnd : '');
        return (
            <View style={this.props.style}>
                <WebView
                    automaticallyAdjustContentInsets={false}
                    scalesPageToFit={false}
                    contentInset={{top: 0, right: 0, bottom: 0, left: 0}}
                    source={{html: html}}
                    opaque={false}
                    underlayColor={'transparent'}
                    style={this.props.style}
                    javaScriptEnabled={true}
                    scrollEnabled={false}
                    onLoad={this.props.onLoad}
                    onLoadEnd={this.props.onLoadEnd}
                    onMessage={diagnostic ? this.onDiagnosticMessage : undefined}
                    onLoadStart={diagnostic ? () => this.reportDiagnostic({stage: 'native-load-start'}) : undefined}
                    onError={diagnostic ? (event) => this.reportDiagnostic({stage: 'native-error', code: event.nativeEvent.code}) : undefined}
                    onLayout={diagnostic ? (event) => this.reportDiagnostic({stage: 'native-layout', width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height}) : undefined}
                    originWhitelist={['*']}
                />
            </View>
        );
    }
});
module.exports = Canvas;
