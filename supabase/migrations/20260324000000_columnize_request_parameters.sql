-- Migration: Columnize request parameters and create sub-tables
-- Description: Adds columns to the requests table and creates related tables for specialized data.
-- Generated at: 2026-03-23T22:04:00

-- 1. Add columns to public.requests
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS naturgy_unit TEXT,
ADD COLUMN IF NOT EXISTS study_type TEXT,
ADD COLUMN IF NOT EXISTS previous_study TEXT,
ADD COLUMN IF NOT EXISTS requester_name TEXT,
ADD COLUMN IF NOT EXISTS request_date DATE,
ADD COLUMN IF NOT EXISTS requester_area TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS study_title TEXT,
ADD COLUMN IF NOT EXISTS market_category TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS "number" TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS network_type TEXT,
ADD COLUMN IF NOT EXISTS map_location TEXT,
ADD COLUMN IF NOT EXISTS pressure TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS gasification_type TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS delivery_point TEXT,
ADD COLUMN IF NOT EXISTS instant_consumption NUMERIC,
ADD COLUMN IF NOT EXISTS work_hours NUMERIC,
ADD COLUMN IF NOT EXISTS monthly_consumption NUMERIC,
ADD COLUMN IF NOT EXISTS consumption_increment NUMERIC,
ADD COLUMN IF NOT EXISTS work_days_per_week NUMERIC,
ADD COLUMN IF NOT EXISTS total_predicted_flow NUMERIC,
ADD COLUMN IF NOT EXISTS min_pressure NUMERIC,
ADD COLUMN IF NOT EXISTS suggested_pressure_range TEXT,
ADD COLUMN IF NOT EXISTS sap_isu_code TEXT,
ADD COLUMN IF NOT EXISTS industry_name TEXT,
ADD COLUMN IF NOT EXISTS current_consumption NUMERIC,
ADD COLUMN IF NOT EXISTS contractual_pressure NUMERIC,
ADD COLUMN IF NOT EXISTS current_pressure_range TEXT,
ADD COLUMN IF NOT EXISTS ute_name TEXT,
ADD COLUMN IF NOT EXISTS press_max_ute NUMERIC,
ADD COLUMN IF NOT EXISTS press_min_ute NUMERIC,
ADD COLUMN IF NOT EXISTS instant_flow NUMERIC,
ADD COLUMN IF NOT EXISTS qdc NUMERIC,
ADD COLUMN IF NOT EXISTS press_max_upgn NUMERIC,
ADD COLUMN IF NOT EXISTS press_min_upgn NUMERIC,
ADD COLUMN IF NOT EXISTS num_clients_res NUMERIC,
ADD COLUMN IF NOT EXISTS flow_unit_res NUMERIC,
ADD COLUMN IF NOT EXISTS total_flow_res NUMERIC,
ADD COLUMN IF NOT EXISTS num_clients_com NUMERIC,
ADD COLUMN IF NOT EXISTS flow_unit_com NUMERIC,
ADD COLUMN IF NOT EXISTS total_flow_com NUMERIC,
ADD COLUMN IF NOT EXISTS deadline_days INTEGER,
ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
ADD COLUMN IF NOT EXISTS comments TEXT,
ADD COLUMN IF NOT EXISTS execution_start_time NUMERIC,
ADD COLUMN IF NOT EXISTS total_execution_time NUMERIC,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_expansion BOOLEAN,
ADD COLUMN IF NOT EXISTS gas_type TEXT,
ADD COLUMN IF NOT EXISTS map_received BOOLEAN,
ADD COLUMN IF NOT EXISTS relevant_study BOOLEAN,
ADD COLUMN IF NOT EXISTS gni_name TEXT,
ADD COLUMN IF NOT EXISTS study_sub_type TEXT,
ADD COLUMN IF NOT EXISTS difficulty TEXT,
ADD COLUMN IF NOT EXISTS validator_observations TEXT,
ADD COLUMN IF NOT EXISTS network_group INTEGER,
ADD COLUMN IF NOT EXISTS network_description TEXT,
ADD COLUMN IF NOT EXISTS response_pressure_base TEXT,
ADD COLUMN IF NOT EXISTS response_max_po NUMERIC,
ADD COLUMN IF NOT EXISTS response_min NUMERIC,
ADD COLUMN IF NOT EXISTS response_garantia NUMERIC,
ADD COLUMN IF NOT EXISTS response_unit TEXT,
ADD COLUMN IF NOT EXISTS response_calculated_pressure NUMERIC,
ADD COLUMN IF NOT EXISTS response_observations TEXT,
ADD COLUMN IF NOT EXISTS reg_sizing_active BOOLEAN,
ADD COLUMN IF NOT EXISTS reg_sizing_flow TEXT,
ADD COLUMN IF NOT EXISTS reg_sizing_cost TEXT,
ADD COLUMN IF NOT EXISTS reg_sizing_in_press TEXT,
ADD COLUMN IF NOT EXISTS reg_sizing_out_press TEXT,
ADD COLUMN IF NOT EXISTS reg_sizing_future_flow TEXT,
ADD COLUMN IF NOT EXISTS analyst_company TEXT,
ADD COLUMN IF NOT EXISTS analyst_role TEXT,
ADD COLUMN IF NOT EXISTS analyst_gb TEXT,
ADD COLUMN IF NOT EXISTS carta_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS qc_data JSONB,
ADD COLUMN IF NOT EXISTS analyst_name TEXT,
ADD COLUMN IF NOT EXISTS qc_request_date TIMESTAMP WITH TIME ZONE;

-- 2. Create sub-tables

-- Table for Interconnection Points
CREATE TABLE IF NOT EXISTS public.interconnection_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
    pressure TEXT,
    material TEXT,
    diameter TEXT,
    location TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Planned Extensions
CREATE TABLE IF NOT EXISTS public.planned_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
    material TEXT,
    diameter TEXT,
    extension NUMERIC,
    network_type TEXT,
    valves INTEGER,
    pressure TEXT,
    gas_type TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for FO02 Grid Data
CREATE TABLE IF NOT EXISTS public.fo02_grid_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    atuais NUMERIC,
    y2 NUMERIC,
    y5 NUMERIC,
    y20 NUMERIC,
    total_q NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Migration script to move data from 'data' column to new fields
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM public.requests WHERE data IS NOT NULL LOOP
        UPDATE public.requests
        SET 
            naturgy_unit = r.data->>'naturgyUnit',
            study_type = r.data->>'studyType',
            previous_study = r.data->>'previousStudy',
            requester_name = r.data->>'requesterName',
            request_date = CASE WHEN NULLIF(r.data->>'requestDate', '') IS NOT NULL THEN (r.data->>'requestDate')::DATE ELSE NULL END,
            requester_area = r.data->>'requesterArea',
            phone = r.data->>'phone',
            email = r.data->>'email',
            study_title = r.data->>'studyTitle',
            market_category = r.data->>'marketCategory',
            address = r.data->>'address',
            "number" = r.data->>'number',
            city = r.data->>'city',
            neighborhood = r.data->>'neighborhood',
            network_type = r.data->>'networkType',
            map_location = r.data->>'mapLocation',
            pressure = r.data->>'pressure',
            file_type = r.data->>'fileType',
            state = r.data->>'state',
            gasification_type = r.data->>'gasificationType',
            client_name = r.data->>'clientName',
            delivery_point = r.data->>'deliveryPoint',
            instant_consumption = NULLIF(r.data->>'instantConsumption', '')::NUMERIC,
            work_hours = NULLIF(r.data->>'workHours', '')::NUMERIC,
            monthly_consumption = NULLIF(r.data->>'monthlyConsumption', '')::NUMERIC,
            consumption_increment = NULLIF(r.data->>'consumptionIncrement', '')::NUMERIC,
            work_days_per_week = NULLIF(r.data->>'workDaysPerWeek', '')::NUMERIC,
            total_predicted_flow = NULLIF(r.data->>'totalPredictedFlow', '')::NUMERIC,
            min_pressure = NULLIF(r.data->>'minPressure', '')::NUMERIC,
            suggested_pressure_range = r.data->>'suggestedPressureRange',
            sap_isu_code = r.data->>'sapIsuCode',
            industry_name = r.data->>'industryName',
            current_consumption = NULLIF(r.data->>'currentConsumption', '')::NUMERIC,
            contractual_pressure = NULLIF(r.data->>'contractualPressure', '')::NUMERIC,
            current_pressure_range = r.data->>'current_pressure_range',
            ute_name = r.data->>'uteName',
            press_max_ute = NULLIF(r.data->>'pressMaxUTE', '')::NUMERIC,
            press_min_ute = NULLIF(r.data->>'pressMinUTE', '')::NUMERIC,
            instant_flow = NULLIF(r.data->>'instantFlow', '')::NUMERIC,
            qdc = NULLIF(r.data->>'qdc', '')::NUMERIC,
            press_max_upgn = NULLIF(r.data->>'pressMaxUPGN', '')::NUMERIC,
            press_min_upgn = NULLIF(r.data->>'pressMinUPGN', '')::NUMERIC,
            num_clients_res = NULLIF(r.data->>'numClientsRes', '')::NUMERIC,
            flow_unit_res = NULLIF(r.data->>'flowUnitRes', '')::NUMERIC,
            total_flow_res = NULLIF(r.data->>'totalFlowRes', '')::NUMERIC,
            num_clients_com = NULLIF(r.data->>'numClientsCom', '')::NUMERIC,
            flow_unit_com = NULLIF(r.data->>'flowUnitCom', '')::NUMERIC,
            total_flow_com = NULLIF(r.data->>'totalFlowCom', '')::NUMERIC,
            deadline_days = NULLIF(r.data->>'deadlineDays', '')::INTEGER,
            estimated_delivery_date = CASE WHEN NULLIF(r.data->>'estimatedDeliveryDate', '') IS NOT NULL THEN (r.data->>'estimatedDeliveryDate')::DATE ELSE NULL END,
            comments = r.data->>'comments',
            execution_start_time = NULLIF(r.data->>'executionStartTime', '')::NUMERIC,
            total_execution_time = NULLIF(r.data->>'totalExecutionTime', '')::NUMERIC,
            started_at = CASE WHEN NULLIF(r.data->>'startedAt', '') IS NOT NULL THEN (r.data->>'startedAt')::TIMESTAMP WITH TIME ZONE ELSE NULL END,
            completed_at = CASE WHEN NULLIF(r.data->>'completedAt', '') IS NOT NULL THEN (r.data->>'completedAt')::TIMESTAMP WITH TIME ZONE ELSE NULL END,
            has_expansion = NULLIF(r.data->>'hasExpansion', '')::BOOLEAN,
            gas_type = r.data->>'gasType',
            map_received = NULLIF(r.data->>'mapReceived', '')::BOOLEAN,
            relevant_study = NULLIF(r.data->>'relevantStudy', '')::BOOLEAN,
            gni_name = r.data->>'gniName',
            study_sub_type = r.data->>'studySubType',
            difficulty = r.data->>'difficulty',
            validator_observations = r.data->>'validatorObservations',
            network_group = NULLIF(r.data->>'networkGroup', '')::INTEGER,
            network_description = r.data->>'networkDescription',
            response_pressure_base = r.data->>'responsePressureBase',
            response_max_po = NULLIF(r.data->>'responseMaxPo', '')::NUMERIC,
            response_min = NULLIF(r.data->>'responseMin', '')::NUMERIC,
            response_garantia = NULLIF(r.data->>'responseGarantia', '')::NUMERIC,
            response_unit = r.data->>'responseUnit',
            response_calculated_pressure = NULLIF(r.data->>'responseCalculatedPressure', '')::NUMERIC,
            response_observations = r.data->>'responseObservations',
            reg_sizing_active = NULLIF(r.data->>'regSizingActive', '')::BOOLEAN,
            reg_sizing_flow = r.data->>'regSizingFlow',
            reg_sizing_cost = r.data->>'regSizingCost',
            reg_sizing_in_press = r.data->>'regSizingInPress',
            reg_sizing_out_press = r.data->>'regSizingOutPress',
            reg_sizing_future_flow = r.data->>'regSizingFutureFlow',
            analyst_company = r.data->>'analystCompany',
            analyst_role = r.data->>'analystRole',
            analyst_gb = r.data->>'analystGB',
            carta_generated_at = CASE WHEN NULLIF(r.data->>'cartaGeneratedAt', '') IS NOT NULL THEN (r.data->>'cartaGeneratedAt')::TIMESTAMP WITH TIME ZONE ELSE NULL END,
            qc_data = r.data->'qcData',
            analyst_name = r.data->>'analystName',
            qc_request_date = CASE WHEN NULLIF(r.data->>'qcRequestDate', '') IS NOT NULL THEN (r.data->>'qcRequestDate')::TIMESTAMP WITH TIME ZONE ELSE NULL END
        WHERE id = r.id;

        -- Migrate interconnection points
        IF r.data->'interconnectionPoints' IS NOT NULL THEN
            INSERT INTO public.interconnection_points (request_id, pressure, material, diameter, location, comment)
            SELECT 
                r.id,
                obj->>'pressure',
                obj->>'material',
                obj->>'diameter',
                obj->>'location',
                obj->>'comment'
            FROM jsonb_array_elements(r.data->'interconnectionPoints') AS obj;
        END IF;

        -- Migrate planned extensions
        IF r.data->'plannedExtensions' IS NOT NULL THEN
            INSERT INTO public.planned_extensions (request_id, material, diameter, extension, network_type, valves, pressure, gas_type, status)
            SELECT 
                r.id,
                obj->>'material',
                obj->>'diameter',
                NULLIF(obj->>'extension', '')::NUMERIC,
                obj->>'networkType',
                NULLIF(obj->>'valves', '')::INTEGER,
                obj->>'pressure',
                obj->>'gasType',
                obj->>'status'
            FROM jsonb_array_elements(r.data->'plannedExtensions') AS obj;
        END IF;

        -- Migrate GridDataFO02
        IF r.data->'gridDataFO02' IS NOT NULL THEN
            INSERT INTO public.fo02_grid_data (request_id, category, atuais, y2, y5, y20, total_q)
            SELECT 
                r.id,
                cat,
                NULLIF(val->>'atuais', '')::NUMERIC,
                NULLIF(val->>'y2', '')::NUMERIC,
                NULLIF(val->>'y5', '')::NUMERIC,
                NULLIF(val->>'y20', '')::NUMERIC,
                NULLIF(val->>'totalQ', '')::NUMERIC
            FROM jsonb_each(r.data->'gridDataFO02') AS grid(cat, val);
        END IF;
    END LOOP;
END $$;

-- 4. Set RLS for new tables
ALTER TABLE public.interconnection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fo02_grid_data ENABLE ROW LEVEL SECURITY;

-- Simple policies for authenticated users
CREATE POLICY "authenticated_select_interconnection_points" ON public.interconnection_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_interconnection_points" ON public.interconnection_points FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_interconnection_points" ON public.interconnection_points FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete_interconnection_points" ON public.interconnection_points FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated_select_planned_extensions" ON public.planned_extensions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_planned_extensions" ON public.planned_extensions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_planned_extensions" ON public.planned_extensions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete_planned_extensions" ON public.planned_extensions FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated_select_fo02_grid_data" ON public.fo02_grid_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_fo02_grid_data" ON public.fo02_grid_data FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_fo02_grid_data" ON public.fo02_grid_data FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete_fo02_grid_data" ON public.fo02_grid_data FOR DELETE TO authenticated USING (true);
