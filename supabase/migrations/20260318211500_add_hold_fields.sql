-- Migration: Add fields for "Aguandando Informação" (Hold) logic
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS hold_reason TEXT,
ADD COLUMN IF NOT EXISTS hold_response TEXT,
ADD COLUMN IF NOT EXISTS hold_response_seen BOOLEAN DEFAULT FALSE;

-- Update existing records if needed (optional)
-- UPDATE public.requests SET hold_reason = data->>'holdReason' WHERE data->'holdReason' IS NOT NULL;
-- UPDATE public.requests SET hold_response = data->>'holdResponse' WHERE data->'holdResponse' IS NOT NULL;
