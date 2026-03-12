# Script para automatizar releases com auto-update (Windows PowerShell)
# Uso: .\release.ps1 -Version "1.0.1" -Provider "github"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$Provider = "github"
)

# Validar versão
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "❌ Versão inválida: $Version" -ForegroundColor Red
    Write-Host "Use formato semântico: 1.0.0"
    exit 1
}

Write-Host "🚀 SolicitaWeb Release Manager" -ForegroundColor Blue
Write-Host ""
Write-Host "📦 Configuração:" -ForegroundColor Blue
Write-Host "  Version: $Version"
Write-Host "  Provider: $Provider"
Write-Host "  Output: release/"
Write-Host ""

# 1. Atualizar versão no package.json
Write-Host "1️⃣  Atualizando version em package.json..." -ForegroundColor Blue

$packageJson = Get-Content package.json -Raw
$packageJson = $packageJson -replace '"version":\s*"[^"]*"', "`"version`": `"$Version`""
Set-Content package.json $packageJson

Write-Host "✓ Versão atualizada para $Version" -ForegroundColor Green
Write-Host ""

# 2. Build
Write-Host "2️⃣  Compilando aplicação..." -ForegroundColor Blue
npm run dist

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build falhou!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build concluído" -ForegroundColor Green
Write-Host ""

# 3. Processos específicos por provider
switch ($Provider) {
    "github" {
        Write-Host "3️⃣  Preparando para GitHub Releases..." -ForegroundColor Blue
        
        # Verificar se tag existe
        $tagExists = & git tag | Where-Object { $_ -eq "v$Version" }
        if ($tagExists) {
            Write-Host "❌ Tag v$Version já existe!" -ForegroundColor Red
            exit 1
        }
        
        # Commit
        git add package.json
        git commit -m "Release v$Version" -ErrorAction SilentlyContinue
        
        # Tag
        git tag -a "v$Version" -m "Release version $Version"
        git push origin "v$Version"
        
        Write-Host "✓ Tag criada: v$Version" -ForegroundColor Green
        Write-Host "4️⃣  Próximas etapas:" -ForegroundColor Blue
        Write-Host "  1. Ir para: https://github.com/seu-usuario/apr-desktop/releases"
        Write-Host "  2. Clicar 'Draft a new release'"
        Write-Host "  3. Selecionar tag: v$Version"
        Write-Host "  4. Upload do arquivo: release/SolicitaWeb Setup $Version.exe"
        Write-Host "  5. Publicar release"
        Write-Host ""
    }
    
    "server" {
        Write-Host "3️⃣  Preparando para servidor HTTP..." -ForegroundColor Blue
        
        # Verificar arquivos necessários
        if (-not (Test-Path "release/latest.yml")) {
            Write-Host "❌ Arquivo release/latest.yml não encontrado!" -ForegroundColor Red
            exit 1
        }
        
        if (-not (Test-Path "release/SolicitaWeb Setup $Version.exe")) {
            Write-Host "❌ Arquivo release/SolicitaWeb Setup $Version.exe não encontrado!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✓ Arquivos prontos para upload:" -ForegroundColor Green
        Write-Host "  - release/latest.yml"
        Write-Host "  - release/SolicitaWeb Setup $Version.exe"
        Write-Host "  - release/SolicitaWeb Setup $Version.exe.blockmap"
        Write-Host ""
        Write-Host "4️⃣  Próximas etapas:" -ForegroundColor Blue
        Write-Host "  1. Fazer upload dos arquivos para seu servidor"
        Write-Host "  2. URL de configuração: https://seu-dominio.com/updates/"
        Write-Host "  3. Verificar permissões de acesso público"
        Write-Host ""
        Write-Host "💡 Dica: Copie os arquivos com:" -ForegroundColor Yellow
        Write-Host "  scp release/latest.yml user@servidor:/var/www/updates/"
        Write-Host "  scp 'release/SolicitaWeb Setup $Version.exe*' user@servidor:/var/www/updates/"
        Write-Host ""
    }
    
    "s3" {
        Write-Host "3️⃣  Preparando para AWS S3..." -ForegroundColor Blue
        
        # Verificar AWS CLI
        $awsExists = Get-Command aws -ErrorAction SilentlyContinue
        if (-not $awsExists) {
            Write-Host "❌ AWS CLI não está instalado!" -ForegroundColor Red
            Write-Host "Instale com: pip install awscli"
            exit 1
        }
        
        Write-Host "✓ Arquivos prontos para S3:" -ForegroundColor Green
        Write-Host "  - release/latest.yml"
        Write-Host "  - release/SolicitaWeb Setup $Version.exe"
        Write-Host "  - release/SolicitaWeb Setup $Version.exe.blockmap"
        Write-Host ""
        Write-Host "4️⃣  Próximas etapas:" -ForegroundColor Blue
        Write-Host "  Configure o bucket S3 em package.json:"
        Write-Host ""
        Write-Host '  "publish": {' -ForegroundColor Cyan
        Write-Host '    "provider": "s3",' -ForegroundColor Cyan
        Write-Host '    "bucket": "seu-bucket-name",' -ForegroundColor Cyan
        Write-Host '    "region": "us-east-1"' -ForegroundColor Cyan
        Write-Host '  }' -ForegroundColor Cyan
        Write-Host ""
    }
    
    default {
        Write-Host "❌ Provider desconhecido: $Provider" -ForegroundColor Red
        Write-Host "Use: github, server ou s3"
        exit 1
    }
}

Write-Host "✅ Release v$Version pronto!" -ForegroundColor Green
Write-Host ""
