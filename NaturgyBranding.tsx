import React from 'react';
import logoImg from './logo.png';

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
        onError={(e) => {
          console.error('Erro ao carregar logo:', e);
        }}
        onLoad={() => {
          console.log('Logo carregada com sucesso!');
        }}
      />
    </div>
  );
};
