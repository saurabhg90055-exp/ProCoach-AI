import React, { useMemo } from 'react';
import Lottie from 'lottie-react';
import animationDataOriginal from '../../assets/procoach-animation.json';
import './ProCoachAnimation.css';

const ProCoachAnimation = () => {
  // Remove the white solid background layer from the animation
  const animationData = useMemo(() => {
    const data = JSON.parse(JSON.stringify(animationDataOriginal));
    // Filter out the "White Solid 1" layer (layer 16 with ty: 1)
    if (data.layers) {
      data.layers = data.layers.filter(layer => 
        layer.nm !== 'White Solid 1' && layer.ty !== 1
      );
    }
    return data;
  }, []);

  return (
    <div className="procoach-animation-container">
      <div className="animation-wrapper">
        <Lottie 
          animationData={animationData}
          loop={true}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

export default ProCoachAnimation;
