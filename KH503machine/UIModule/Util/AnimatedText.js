import React, { PureComponent } from 'react';
import { Animated, Text ,View} from 'react-native';

export default class AnimatedText extends PureComponent {
    constructor(props) {
        super(props)
        this.state = {
            textOpacity:new Animated.Value(0),
        }
        // setTimeout(() => {
        //     this.startAnimation()
        // }, 1000);
    }

    startAnimation =()=>{
        // if (this._stopAnimation) {
        //     return
        // }
        Animated.timing(
            this.state.textOpacity,
            {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true
            }
        ).start(() => {
            Animated.timing(
                this.state.textOpacity,
                {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true
                }
            ).start(() => {
               
                // this.startAnimation()
            })
        })
    }

    render()  {
        return (
            <Animated.View style={
                [this.props.style, { opacity: this.state.textOpacity }]
            }>
                <Text style={{fontSize:52,color:'white',opacity:0.7}}>{this.props.text}</Text> 
            </Animated.View>
        )
    }
}

