import React from 'react';

export const NaturgyBranding: React.FC = () => {
  const logoPath = 'C:\\Users\\00805217\\NATURGY\\SolicitaWebEstu - Documentos\\Solicitacoes\\logo.png';
  const logoUrl = `file:///${logoPath.replace(/\\/g, '/')}`;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img 
        src={logoUrl}
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
          console.log('Caminho do logo:', logoUrl);
        }}
        onLoad={() => {
          console.log('Logo carregada com sucesso!');
        }}
      />
    </div>
  );
};
