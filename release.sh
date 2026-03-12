#!/bin/bash

# Script para automatizar releases com auto-update
# Uso: ./release.sh [version] [github|server|s3]

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 SolicitaWeb Release Manager${NC}\n"

# Validar argumentos
if [ $# -lt 1 ]; then
    echo -e "${RED}❌ Uso: ./release.sh [version] [provider]${NC}"
    echo "Exemplo: ./release.sh 1.0.1 github"
    echo ""
    echo "Providers disponíveis:"
    echo "  - github   : GitHub Releases (recomendado)"
    echo "  - server   : Servidor HTTP customizado"
    echo "  - s3       : Amazon S3"
    exit 1
fi

VERSION=$1
PROVIDER=${2:-github}

# Validar versão
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ Versão inválida: $VERSION${NC}"
    echo "Use formato semântico: 1.0.0"
    exit 1
fi

echo -e "${BLUE}📦 Configuração:${NC}"
echo "  Version: $VERSION"
echo "  Provider: $PROVIDER"
echo "  Output: release/"
echo ""

# Atualizar versão no package.json
echo -e "${BLUE}1️⃣  Atualizando version em package.json...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
fi

echo -e "${GREEN}✓ Versão atualizada para $VERSION${NC}"

# Build
echo -e "${BLUE}2️⃣  Compilando aplicação...${NC}"
npm run dist

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build falhou!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build concluído${NC}"

# Processos específicos por provider
case $PROVIDER in
    github)
        echo -e "${BLUE}3️⃣  Preparando para GitHub Releases...${NC}"
        
        # Verificar se existe tag existente
        if git tag | grep -q "v$VERSION"; then
            echo -e "${RED}❌ Tag v$VERSION já existe!${NC}"
            exit 1
        fi
        
        # Commit
        git add package.json
        git commit -m "Release v$VERSION" || true
        
        # Tag
        git tag -a "v$VERSION" -m "Release version $VERSION"
        git push origin "v$VERSION"
        
        echo -e "${GREEN}✓ Tag criada: v$VERSION${NC}"
        echo -e "${BLUE}4️⃣  Próximas etapas:${NC}"
        echo "  1. Ir para: https://github.com/seu-usuario/apr-desktop/releases"
        echo "  2. Clicar 'Draft a new release'"
        echo "  3. Selecionar tag: v$VERSION"
        echo "  4. Upload do arquivo: release/SolicitaWeb Setup $VERSION.exe"
        echo "  5. Publicar release"
        ;;
        
    server)
        echo -e "${BLUE}3️⃣  Preparando para servidor HTTP...${NC}"
        
        # Verificar arquivos necessários
        if [ ! -f "release/latest.yml" ]; then
            echo -e "${RED}❌ Arquivo release/latest.yml não encontrado!${NC}"
            exit 1
        fi
        
        if [ ! -f "release/SolicitaWeb Setup $VERSION.exe" ]; then
            echo -e "${RED}❌ Arquivo release/SolicitaWeb Setup $VERSION.exe não encontrado!${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Arquivos prontos para upload:${NC}"
        echo "  - release/latest.yml"
        echo "  - release/SolicitaWeb Setup $VERSION.exe"
        echo "  - release/SolicitaWeb Setup $VERSION.exe.blockmap"
        echo ""
        echo -e "${BLUE}4️⃣  Próximas etapas:${NC}"
        echo "  1. Fazer upload dos arquivos para seu servidor"
        echo "  2. URL de configuração: https://seu-dominio.com/updates/"
        echo "  3. Verificar permissões de acesso público"
        echo ""
        echo "💡 Dica: Copie os arquivos com:"
        echo "  scp release/latest.yml user@servidor:/var/www/updates/"
        echo "  scp 'release/SolicitaWeb Setup $VERSION.exe*' user@servidor:/var/www/updates/"
        ;;
        
    s3)
        echo -e "${BLUE}3️⃣  Preparando para AWS S3...${NC}"
        
        # Verificar AWS CLI
        if ! command -v aws &> /dev/null; then
            echo -e "${RED}❌ AWS CLI não está instalado!${NC}"
            echo "Instale com: pip install awscli"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Arquivos prontos para S3:${NC}"
        echo "  - release/latest.yml"
        echo "  - release/SolicitaWeb Setup $VERSION.exe"
        echo "  - release/SolicitaWeb Setup $VERSION.exe.blockmap"
        echo ""
        echo -e "${BLUE}4️⃣  Próximas etapas:${NC}"
        echo "  Configure o bucket S3 em package.json:"
        echo ""
        echo '  "publish": {'
        echo '    "provider": "s3",'
        echo '    "bucket": "seu-bucket-name",'
        echo '    "region": "us-east-1"'
        echo '  }'
        ;;
        
    *)
        echo -e "${RED}❌ Provider desconhecido: $PROVIDER${NC}"
        echo "Use: github, server ou s3"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Release v$VERSION pronto!${NC}"
echo ""
