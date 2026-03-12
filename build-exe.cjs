const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const releaseDir = path.join(__dirname, 'release');

// Força criação de novo diretório
if (fs.existsSync(releaseDir)) {
  console.log('📦 Removendo release anterior...');
  try {
    execSync(`rd /s /q "${releaseDir}"`, { stdio: 'pipe', shell: 'cmd' });
    console.log('✅ Release removido');
  } catch (e) {
    console.log('⚠️ Falha ao remover, continuando...');
  }
}

// Aguarda com sync
console.log('⏳ Aguardando 2 segundos...');
const start = Date.now();
while (Date.now() - start < 2000) {}

console.log('🔨 Iniciando build do Electron...');
try {
  execSync('npx electron-builder --publish never', {
    stdio: 'inherit',
    cwd: __dirname,
    shell: 'cmd'
  });
  console.log('✅ Build concluído com sucesso!');
} catch (e) {
  console.error('❌ Erro no build');
  process.exit(1);
}

// Verifica se o exe foi criado
const exePath = path.join(releaseDir, 'SolicitaWeb 1.0.0.exe');
if (fs.existsSync(exePath)) {
  const stats = fs.statSync(exePath);
  console.log(`\n✅ SUCESSO! Executável criado:\n   ${exePath}\n   Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
  console.log('\n⚠️ O executável não foi encontrado no local esperado');
  const files = fs.readdirSync(releaseDir).slice(0, 10);
  console.log('Arquivos em release:', files);
}
