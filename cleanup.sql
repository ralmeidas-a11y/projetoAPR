-- Verificar requests com ID '0' ou duplicados
SELECT id, NRO_ESTUDO, STATUS, createdAt 
FROM Requests 
WHERE id = '0' OR id = 0 
ORDER BY createdAt DESC;

-- Deletar requests órfãos com ID '0' (CUIDADO: apenas se não houver dados importantes)
-- DELETE FROM Requests WHERE id = '0';