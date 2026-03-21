import React from 'react';
import logoImg from '../assets/logo.png';

export const NaturgyBranding: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img 
        src={logoImg}
        alt="Naturgy Logo" 
        style={{ 
          maxWidth: '280px', 
          height: 'auto',
          objectFit: 'contain',
          backgroundColor: 'transparent',
          filter: 'drop-shadow(0px 10px 25px rgba(0,0,0,0.2))'
        }}
      />
    </div>
  );
};
