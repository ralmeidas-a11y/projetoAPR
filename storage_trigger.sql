-- SQL Migration: Automatic Storage to Database Synchronization (REFINED)
-- Este script sincroniza o bucket do Supabase Storage com a tabela 'requests'.

CREATE OR REPLACE FUNCTION public.handle_storage_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_obj record;
    v_path_parts text[];
    v_year text;
    v_study_id text;
    v_rev_suffix text;
    v_category text;
    v_study_number text;
    v_request_id uuid;
    v_files_jsonb jsonb;
    v_categorized_jsonb jsonb;
    v_cat text;
    v_current_data jsonb;
BEGIN
    -- 1. Identificar o objeto
    IF (TG_OP = 'DELETE') THEN
        v_obj := OLD;
    ELSE
        v_obj := NEW;
    END IF;

    -- 2. Validar o bucket
    IF v_obj.bucket_id <> 'request-files' THEN
        RETURN v_obj;
    END IF;

    -- 3. Parsear o caminho
    -- Caminho esperado: Solicitacoes_APR/YYYY/BaseID/REVX/Category/FileName
    v_path_parts := string_to_array(v_obj.name, '/');
    
    -- Debug: log do caminho processado
    RAISE NOTICE 'Sincronizando objeto no Storage: %', v_obj.name;

    IF v_path_parts[1] <> 'Solicitacoes_APR' OR cardinality(v_path_parts) < 5 THEN
        RAISE NOTICE 'Caminho ignorado (não segue o padrão do App): %', v_obj.name;
        RETURN v_obj;
    END IF;

    v_year := v_path_parts[2];
    v_study_id := v_path_parts[3];      -- Ex: APR-2024-0001
    v_rev_suffix := v_path_parts[4];    -- Ex: REV0 ou REV1
    
    -- Construir o identificador completo
    v_study_number := v_study_id || '-' || v_rev_suffix;
    
    -- 4. Localizar o registro na tabela 'requests'
    -- Usamos uma busca flexível para suportar diversos formatos de study_number
    SELECT id, data INTO v_request_id, v_current_data 
    FROM public.requests 
    WHERE study_number = v_study_number 
       OR study_number = v_study_id
       OR study_number = 'PROV-' || v_study_number
       OR study_number = 'PROV-' || v_study_id
       OR data->>'studyNumber' = v_study_number
       OR data->>'studyNumber' = v_study_id
    LIMIT 1;

    IF v_request_id IS NULL THEN
        RAISE NOTICE 'Estudo não encontrado no Banco para ID: % ou %', v_study_id, v_study_number;
        RETURN v_obj;
    END IF;

    -- 5. Reconstruir a lista de arquivos categorizada
    v_categorized_jsonb := '{}'::jsonb;
    
    FOR v_cat IN SELECT unnest(ARRAY['Solicitacao', 'Resposta', 'Calculos', 'Outros']) LOOP
        SELECT jsonb_agg(
            jsonb_build_object(
                'name', (string_to_array(name, '/'))[cardinality(string_to_array(name, '/'))],
                'size', COALESCE((metadata->>'size')::bigint, 0),
                'type', COALESCE(metadata->>'mimetype', 'application/octet-stream'),
                'lastModified', extract(epoch from created_at) * 1000
            )
        ) INTO v_files_jsonb
        FROM storage.objects
        WHERE bucket_id = 'request-files'
          AND name LIKE 'Solicitacoes_APR/' || v_year || '/' || v_study_id || '/' || v_rev_suffix || '/' || v_cat || '/%'
          AND name NOT LIKE '%.keep';
        
        v_categorized_jsonb := v_categorized_jsonb || jsonb_build_object(v_cat, COALESCE(v_files_jsonb, '[]'::jsonb));
    END LOOP;

    -- 6. Atualizar a tabela public.requests
    UPDATE public.requests
    SET data = data || jsonb_build_object(
        'selectedFiles', COALESCE(v_categorized_jsonb->'Solicitacao', '[]'::jsonb),
        'categorizedFiles', v_categorized_jsonb
    ),
    updated_at = NOW()
    WHERE id = v_request_id;
    
    RAISE NOTICE 'Sincronização concluída com sucesso para o banco: %', v_study_number;

    RETURN v_obj;
END;
$$;

-- Recriar o Gatilho
DROP TRIGGER IF EXISTS on_storage_sync_trigger ON storage.objects;
CREATE TRIGGER on_storage_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.handle_storage_sync();
