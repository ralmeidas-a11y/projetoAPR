# Plano: Adicionar campo de pesquisa para Condições Padronizadas

## Objetivo
Adicionar um campo de pesquisa/filtro na seção "Condições Padronizadas" do Technical Execution Panel para que o usuário possa filtrar os itens.

## Localização
- **Arquivo**: `src/pages/TechnicalExecutionPanel.tsx`
- **Seção**: Linhas 2639-2712 (bloco "Condições Padronizadas")

## Implementação

### 1. Adicionar estado para filtro (linha ~113)
```typescript
const [standardConditionsFilter, setStandardConditionsFilter] = useState('');
```

### 2. Modificar availableBlocks para filtrar (linhas 144-167)
Adicionar filtro por termo de busca que pesquise tanto na `descricao` quanto nos `itens`:

```typescript
const availableBlocks = useMemo(() => {
  const filterTerm = standardConditionsFilter.toLowerCase();
  
  let blocks = Object.entries(STANDARDIZED_CONDITIONS_BLOCKS).map(([id, block]) => ({
    id,
    ...block,
    itens: block.itens.filter(item => !responseObsList.includes(item))
  }));

  if (filterTerm) {
    blocks = blocks.map(block => ({
      ...block,
      descricao: block.descricao,
      itens: block.itens.filter(item => 
        item.toLowerCase().includes(filterTerm)
      ),
      availableItens: block.availableItens.filter(item =>
        item.toLowerCase().includes(filterTerm)
      )
    })).filter(block => block.itens.length > 0 || block.id === 'PrevRevision');
  }

  // ... resto do código existente
}, [responseObsList, previousStudyObs, standardConditionsFilter]);
```

### 3. Adicionar campo de pesquisa UI (linha ~2643)
Após o título "Condições Padronizadas", adicionar input de pesquisa:

```tsx
<input
  type="text"
  placeholder="Filtrar condições..."
  value={standardConditionsFilter}
  onChange={(e) => setStandardConditionsFilter(e.target.value)}
  className="w-full px-3 py-2 text-[10px] border border-slate-200 rounded-lg mb-2 focus:outline-none focus:border-indigo-400"
/>
{standardConditionsFilter && (
  <button
    onClick={() => setStandardConditionsFilter('')}
    className="text-[9px] text-slate-400 hover:text-slate-600"
  >
    Limpar filtro
  </button>
)}
```

## Checklist
- [ ] Adicionar useState para standardConditionsFilter
- [ ] Modificar useMemo availableBlocks para filtrar
- [ ] Adicionar input de pesquisa na UI
- [ ] Adicionar botão para limpar filtro