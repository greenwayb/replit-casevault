import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface TiltedCardProps {
  imageSrc?: string;
  altText?: string;
  captionText?: string;
  containerHeight?: string;
  containerWidth?: string;
  imageHeight?: string;
  imageWidth?: string;
  rotateAmplitude?: number;
  scaleOnHover?: number;
  showMobileWarning?: boolean;
  showTooltip?: boolean;
  displayOverlayContent?: boolean;
  overlayContent?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const TiltedCard: React.FC<TiltedCardProps> = ({
  imageSrc,
  altText = "Card image",
  captionText,
  containerHeight = "300px",
  containerWidth = "300px",
  imageHeight = "300px",
  imageWidth = "300px",
  rotateAmplitude = 12,
  scaleOnHover = 1.05,
  showMobileWarning = false,
  showTooltip = true,
  displayOverlayContent = false,
  overlayContent,
  onClick,
  className = "",
  children
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePosition({ x: 0, y: 0 });
  };

  const calculateRotation = () => {
    if (!isHovered) return { rotateX: 0, rotateY: 0 };
    
    const containerRect = {
      width: parseInt(containerWidth),
      height: parseInt(containerHeight)
    };
    
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    const rotateY = ((mousePosition.x - centerX) / centerX) * rotateAmplitude;
    const rotateX = -((mousePosition.y - centerY) / centerY) * rotateAmplitude;
    
    return { rotateX, rotateY };
  };

  const { rotateX, rotateY } = calculateRotation();

  return (
    <div className="relative inline-block">
      <motion.div
        className={`relative cursor-pointer ${className}`}
        style={{
          width: containerWidth,
          height: containerHeight,
          perspective: "1000px"
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        animate={{
          rotateX,
          rotateY,
          scale: isHovered ? scaleOnHover : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
      >
        {children ? (
          children
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={altText}
            className="w-full h-full object-cover rounded-lg shadow-lg"
            style={{
              width: imageWidth,
              height: imageHeight
            }}
          />
        ) : (
          <div
            className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg shadow-lg flex items-center justify-center"
            style={{
              width: imageWidth,
              height: imageHeight
            }}
          >
            <span className="text-white font-bold text-lg">Card Content</span>
          </div>
        )}
        
        {displayOverlayContent && overlayContent && (
          <motion.div
            className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-white text-center p-4">
              {overlayContent}
            </div>
          </motion.div>
        )}
      </motion.div>
      
      {captionText && (
        <p className="text-center mt-2 text-sm text-gray-600">{captionText}</p>
      )}
      
      {showMobileWarning && (
        <div className="md:hidden text-xs text-gray-500 text-center mt-1">
          Best viewed on desktop
        </div>
      )}
    </div>
  );
};

export default TiltedCard;