import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, StudyStatus, UserRole } from '../types/types';
import { useDialog } from '../components/AppDialog';
import { PRESSURE_BASES } from '../constants/constants';

interface MathModelData {
  id?: string;
  idsigep?: number;
  titulo?: string;
  localiz?: string;
  isRevision?: boolean;
}

interface StudySearchResult {
  id: string;
  studyNumber: string;
  studyTitle: string;
  clientName: string;
  address: string;
  city: string;
  neighborhood?: string;
  studySubType: string;
  gasType: string;
  pressure: string;
  assignedTo?: string;
  empresa?: string;
  requesterName?: string;
  email?: string;
  requesterArea?: string;
  previousStudy?: string;
}

interface MathModelFormProps {
  currentUser: User;
  initialData?: MathModelData | null;
  allUsers: User[];
  onBack: () => void;
  onSaved: () => void;
}

export const MathModelForm: React.FC<MathModelFormProps> = ({
  currentUser,
  initialData,
  allUsers,
  onBack,
  onSaved
}) => {
  const { showToast } = useDialog();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Tab 0: Revision search
  const [studyId, setStudyId] = useState('');
  const [searchResults, setSearchResults] = useState<StudySearchResult[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<StudySearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Tab 0: Dados da Solicitação (matching TEP SubTab0)
  const [formData, setFormData] = useState({
    titulo: initialData?.titulo || '',
    localiz: initialData?.localiz || '',
    empresa: '',
    solicitante: '',
    email: '',
    areaSolicitante: '',
    bairro: '',
    municipio: '',
    gasType: '',
    pressaoRange: '',
    pressaoMin: '',
    observacoes: ''
  });

  // Manual IDSIGEP input for new model creation
  const [manualIdsigep, setManualIdsigep] = useState('');
  const [idsigepError, setIdsigepError] = useState('');
  const [checkingIdsigep, setCheckingIdsigep] = useState(false);

  // Tab 1: Validação (matching ValidationModal)
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [validatorObservations, setValidatorObservations] = useState('');

  const isRevision = initialData?.isRevision || false;

  // Auto-select study from initialData when creating a revision
  // The model is already known — no need to search manually
  const [autoSelected, setAutoSelected] = useState(false);

  useEffect(() => {
    if (isRevision && initialData?.id && initialData?.idsigep && !autoSelected) {
      const num = String(initialData.idsigep || '').replace(/\D/g, '');
      const autoStudy: StudySearchResult = {
        id: initialData.id,
        studyNumber: num,
        studyTitle: initialData.titulo || '',
        clientName: '',
        address: initialData.localiz || '',
        city: '',
        neighborhood: '',
        studySubType: '',
        gasType: '',
        pressure: '',
        assignedTo: '',
        empresa: '',
        requesterName: '',
        email: '',
        requesterArea: '',
        previousStudy: ''
      };
      setSelectedStudy(autoStudy);
      setStudyId(num);

      // Pre-fill form data from original model
      setFormData(prev => ({
        ...prev,
        titulo: initialData.titulo || prev.titulo,
        localiz: initialData.localiz || prev.localiz,
      }));

      // Fetch full details in background to enrich form data
      fetch(`/api/requests/study/${num}`)
        .then(res => res.ok ? res.json() : null)
        .then(fullStudy => {
          if (!fullStudy) return;
          let meta: any = {};
          if (fullStudy.meta_data) {
            try {
              meta = typeof fullStudy.meta_data === 'string' ? JSON.parse(fullStudy.meta_data) : fullStudy.meta_data;
            } catch { }
          }
          setFormData(prev => ({
            titulo: fullStudy.titulo || fullStudy.studyTitle || prev.titulo,
            localiz: fullStudy.localiz || fullStudy.address || prev.localiz,
            municipio: fullStudy.municipio || fullStudy.city || meta.municipio || prev.municipio,
            bairro: fullStudy.bairro || fullStudy.neighborhood || meta.bairro || prev.bairro,
            gasType: fullStudy.gasType || meta.gasType || prev.gasType,
            pressaoRange: fullStudy.pressaoRange || fullStudy.pressure || meta.pressaoRange || prev.pressaoRange,
            pressaoMin: String(fullStudy.pressaoMin !== undefined && fullStudy.pressaoMin !== null ? fullStudy.pressaoMin : (meta.pressaoMin || prev.pressaoMin)),
            empresa: fullStudy.empresa || meta.empresa || prev.empresa,
            solicitante: fullStudy.requesterName || meta.solicitante || prev.solicitante,
            email: fullStudy.email || meta.email || prev.email,
            areaSolicitante: fullStudy.requesterArea || meta.areaSolicitante || prev.areaSolicitante,
            observacoes: fullStudy.observacoes || meta.observacoes || prev.observacoes
          }));
        })
        .catch(() => { });

      setAutoSelected(true);
    }
  }, [isRevision, initialData, autoSelected]);

  // Compute the next IDSIGEP for the revision (base8 + currentRev + 1)
  const nextIdsigep = useMemo(() => {
    if (!isRevision || !initialData?.idsigep) return null;
    const num = String(initialData.idsigep || '').replace(/\D/g, '');
    if (num.length >= 10) {
      const base8 = num.substring(0, 8);
      const currentRev = parseInt(num.substring(8, 10)) || 0;
      const newRev = String(currentRev + 1).padStart(2, '0');
      return `${base8}${newRev}`;
    }
    return null;
  }, [isRevision, initialData]);

  // Validate IDSIGEP for new model creation
  const validateIdsigep = useCallback(async (value: string) => {
    if (!value || isRevision) {
      setIdsigepError('');
      return true;
    }

    // Only digits allowed, exactly 10 characters
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setIdsigepError(cleaned.length > 0 ? 'Deve ter exatamente 10 dígitos' : '');
      return false;
    }

    setCheckingIdsigep(true);
    try {
      const res = await fetch(`/api/math-models/check-idsigep/${cleaned}`);
      const data = await res.json();
      if (data.exists) {
        setIdsigepError('Este ID.MODELO já está cadastrado');
        setCheckingIdsigep(false);
        return false;
      }
      setIdsigepError('');
      setCheckingIdsigep(false);
      return true;
    } catch {
      setIdsigepError('');
      setCheckingIdsigep(false);
      return true;
    }
  }, [isRevision]);

  // Auto-complete search for math models (GRUPO_EST=190)
  const searchStudy = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/math-models/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        const results = data.map((r: any) => ({
          id: r.id,
          studyNumber: r.idsigep,
          studyTitle: r.titulo,
          clientName: '',
          address: r.localiz,
          city: '',
          studySubType: '',
          gasType: '',
          pressure: '',
          assignedTo: '',
          empresa: '',
          requesterName: '',
          email: '',
          requesterArea: '',
          previousStudy: ''
        }));
        setSearchResults(results.slice(0, 5));
      }
    } catch (error) {
      console.error('Error searching math models:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isRevision && studyId) {
        searchStudy(studyId);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studyId, isRevision, searchStudy]);

  const handleSelectStudy = async (study: StudySearchResult) => {
    setSelectedStudy(study);
    setStudyId(study.studyNumber);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/requests/study/${study.studyNumber}`);
      if (res.ok) {
        const fullStudy = await res.json();

        // Extract meta_data properties if available
        let meta: any = {};
        if (fullStudy.meta_data) {
          try {
            meta = typeof fullStudy.meta_data === 'string' ? JSON.parse(fullStudy.meta_data) : fullStudy.meta_data;
          } catch (e) {
            console.error('Error parsing study meta_data:', e);
          }
        }

        setFormData({
          titulo: fullStudy.titulo || fullStudy.studyTitle || study.studyTitle || '',
          localiz: fullStudy.localiz || fullStudy.address || study.address || '',
          municipio: fullStudy.municipio || fullStudy.city || meta.municipio || '',
          bairro: fullStudy.bairro || fullStudy.neighborhood || meta.bairro || '',
          gasType: fullStudy.gasType || meta.gasType || '',
          pressaoRange: fullStudy.pressaoRange || fullStudy.pressure || meta.pressaoRange || '',
          pressaoMin: String(fullStudy.pressaoMin !== undefined && fullStudy.pressaoMin !== null ? fullStudy.pressaoMin : (meta.pressaoMin || '')),
          empresa: fullStudy.empresa || meta.empresa || '',
          solicitante: fullStudy.requesterName || meta.solicitante || '',
          email: fullStudy.email || meta.email || '',
          areaSolicitante: fullStudy.requesterArea || meta.areaSolicitante || '',
          observacoes: fullStudy.observacoes || meta.observacoes || ''
        });
        showToast(`Estudo ${study.studyNumber} carregado com sucesso`, 'success');
      } else {
        // Fallback to basic search result
        setFormData(prev => ({
          ...prev,
          titulo: study.studyTitle || study.clientName || '',
          localiz: study.address || '',
          municipio: study.city || '',
          gasType: study.gasType || '',
          pressaoRange: study.pressure || '',
          empresa: study.empresa || '',
          solicitante: study.requesterName || '',
          email: study.email || '',
          areaSolicitante: study.requesterArea || '',
        }));
        showToast(`Estudo ${study.studyNumber} selecionado (dados parciais)`, 'success');
      }
    } catch (err) {
      console.error('Error loading study details:', err);
      showToast(`Erro ao carregar detalhes completos do estudo`, 'warning');
    }
  };

  const handleNextTab = () => {
    if (activeTab === 0) {
      if (isRevision && !selectedStudy) {
        showToast('Selecione um estudo para criar revisão', 'error');
        return;
      }
      if (!isRevision && !formData.titulo.trim()) {
        showToast('Preencha o título do modelo', 'error');
        return;
      }
      if (!isRevision && manualIdsigep.length !== 10) {
        showToast('Informe o ID MODELO com 10 dígitos', 'error');
        return;
      }
      if (!isRevision && idsigepError) {
        showToast(idsigepError, 'error');
        return;
      }
      setActiveTab(1);
    }
  };

  const handlePrevTab = () => {
    if (activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let endpoint: string;
      let body: any;

      if (isRevision && selectedStudy) {
        endpoint = `/api/math-models/${initialData?.id}/revision`;
        body = {
          sap: currentUser.sap,
          previousStudy: selectedStudy.studyNumber,
          assignedTo: assignedTo || currentUser.id,
          estimatedDelivery,
          ...formData
        };
      } else {
        endpoint = '/api/math-models';
        body = {
          sap: currentUser.sap,
          idsigep: manualIdsigep ? parseInt(manualIdsigep) : undefined,
          assignedTo: assignedTo || currentUser.id,
          estimatedDelivery,
          ...formData
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Erro ao salvar modelo', 'error');
        return;
      }

      showToast(isRevision ? 'Revisão criada com sucesso' : 'Modelo criado com sucesso', 'success');
      onSaved();
    } catch (error) {
      showToast('Erro ao salvar modelo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePressureChange = (value: string) => {
    const selected = PRESSURE_BASES.find(p => p.base === value);
    setFormData(prev => ({
      ...prev,
      pressaoRange: value,
      pressaoMin: selected ? String(selected.pmin) : ''
    }));
  };

  const renderField = (label: string, value: string | undefined, icon?: string) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-bold text-slate-700">{value || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center">
          <i className="fa-solid fa-arrow-left text-sm"></i>
        </button>
        <div>
          <h2 className="text-lg font-black text-[#004080] uppercase tracking-tight">
            {isRevision ? 'Criar Revisão de Modelo' : 'Novo Modelo Matemático'}
          </h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Winflow - Elaboração e Revisão</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => activeTab === 1 && handlePrevTab()}
          className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab === 0
              ? 'bg-[#004080] text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
        >
          <i className="fa-solid fa-database text-[9px] mr-1"></i>
          Dados da Solicitação
        </button>
        <i className="fa-solid fa-chevron-right text-slate-300 text-[8px]"></i>
        <button
          onClick={() => activeTab === 0 && handleNextTab()}
          className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab === 1
              ? 'bg-[#004080] text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
        >
          <i className="fa-solid fa-check-double text-[9px] mr-1"></i>
          Validação
        </button>
      </div>

      {/* Tab 0: Dados da Solicitação (matching TEP SubTab0) */}
      {activeTab === 0 && (
        <div className="space-y-4">
          {/* Card 1: Revision Search (only for revision mode) */}
          {isRevision && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-code-branch text-blue-500"></i>
                Criar Revisão de Modelo
              </h3>

              {/* Auto-selected model from list — no manual search needed */}
              {selectedStudy && nextIdsigep && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-blue-700 uppercase">Modelo Selecionado</span>
                    <button
                      onClick={() => {
                        setSelectedStudy(null);
                        setStudyId('');
                        setAutoSelected(false);
                        setFormData(prev => ({ ...prev, titulo: '', localiz: '' }));
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700"
                    >
                      <i className="fa-solid fa-times mr-1"></i>Limpar
                    </button>
                  </div>
                  <div className="text-sm font-black text-[#004080]">{selectedStudy.studyNumber}</div>
                  <div className="text-xs text-slate-600">{selectedStudy.studyTitle || selectedStudy.clientName || 'Sem título'}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{selectedStudy.address}</div>
                  {/* Next IDSIGEP auto-generated */}
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <span className="text-[10px] font-bold text-blue-600">
                      <i className="fa-solid fa-arrow-right mr-1"></i>
                      Próxima revisão: <span className="font-black text-[#004080] text-sm">{nextIdsigep}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Manual search only if no auto-selected model */}
              {!selectedStudy && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    ID do Modelo (digite para buscar)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studyId}
                      onChange={(e) => {
                        setStudyId(e.target.value);
                        setSelectedStudy(null);
                      }}
                      placeholder="Ex: 2026028401"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    {searching && (
                      <i className="fa-solid fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                    )}
                  </div>

                  {searchResults.length > 0 && !selectedStudy && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((study) => (
                        <button
                          key={study.id}
                          onClick={() => handleSelectStudy(study)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        >
                          <div className="text-xs font-bold text-[#004080]">{study.studyNumber}</div>
                          <div className="text-[10px] text-slate-600 truncate">{study.studyTitle || study.clientName}</div>
                          <div className="text-[9px] text-slate-400">{study.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Card 1: Dados da Solicitação e Identificação */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-square-root-variable text-blue-500"></i>
              Dados da Solicitação e Identificação
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {isRevision && selectedStudy && (
                <>
                  {renderField('Modelo Original', selectedStudy.studyNumber)}
                  {nextIdsigep && renderField('Nova Revisão', nextIdsigep)}
                </>
              )}
              {!isRevision && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    ID MODELO (IDSIGEP) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualIdsigep}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setManualIdsigep(val);
                        if (val.length === 10) {
                          validateIdsigep(val);
                        } else {
                          setIdsigepError(val.length > 0 ? 'Deve ter exatamente 10 dígitos' : '');
                        }
                      }}
                      onBlur={() => validateIdsigep(manualIdsigep)}
                      placeholder="Ex: 2026028401"
                      maxLength={10}
                      className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${idsigepError ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-blue-400'
                        }`}
                    />
                    {checkingIdsigep && (
                      <i className="fa-solid fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                    )}
                  </div>
                  {idsigepError && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold">{idsigepError}</p>
                  )}
                  <p className="text-[9px] text-slate-400 mt-0.5">10 dígitos numéricos. Será validado contra o banco.</p>
                </div>
              )}
              {renderField('Data de Solicitação', new Date().toLocaleDateString('pt-BR'))}
              {renderField('Solicitante', isRevision ? selectedStudy?.requesterName : currentUser.name)}
              {renderField('E-mail', isRevision ? selectedStudy?.email : currentUser.email)}
              {renderField('Área Solicitante', isRevision ? selectedStudy?.requesterArea : currentUser.area)}
            </div>
          </div>

          {/* Card 2: Localização e Cliente */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-location-dot text-blue-500"></i>
              Localização e Cliente
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Título/Cliente *</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => handleChange('titulo', e.target.value)}
                  placeholder="Título do modelo ou nome do cliente"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Endereço ou Localidade</label>
                <input
                  type="text"
                  value={formData.localiz}
                  onChange={(e) => handleChange('localiz', e.target.value)}
                  placeholder="Endereço / Localização"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Município</label>
                <input
                  type="text"
                  value={formData.municipio}
                  onChange={(e) => handleChange('municipio', e.target.value)}
                  placeholder="Município"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bairro</label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => handleChange('bairro', e.target.value)}
                  placeholder="Bairro"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Empresa</label>
                <select
                  value={formData.empresa}
                  onChange={(e) => handleChange('empresa', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="">Selecione</option>
                  <option value="NATURGY">NATURGY</option>
                  <option value="SPS">SPS</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Demanda e Parâmetros Técnicos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-gears text-blue-500"></i>
              Demanda e Parâmetros Técnicos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Gás</label>
                <select
                  value={formData.gasType}
                  onChange={(e) => handleChange('gasType', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="">Selecione</option>
                  <option value="GN">GN</option>
                  <option value="GLP">GLP</option>
                  <option value="GNL">GNL</option>
                  <option value="GNC">GNC</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Faixa de Pressão</label>
                <select
                  value={formData.pressaoRange}
                  onChange={(e) => handlePressureChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="">Selecione</option>
                  {PRESSURE_BASES.map(p => (
                    <option key={p.base} value={p.base}>{p.base}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pressão Mín. (mbar)</label>
                <input
                  type="text"
                  value={formData.pressaoMin}
                  readOnly
                  placeholder="Auto-preenchido"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações adicionais sobre o modelo..."
                rows={3}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl text-[10px] font-bold text-slate-500 hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleNextTab}
              disabled={isRevision && !selectedStudy}
              className="px-6 py-2 rounded-xl text-[10px] font-bold bg-[#004080] text-white hover:bg-[#003060] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Próximo
              <i className="fa-solid fa-arrow-right text-[9px]"></i>
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Validação (matching ValidationModal) */}
      {activeTab === 1 && (
        <div className="space-y-4">
          {/* Summary of selected data */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-clipboard-list text-blue-500"></i>
              Resumo dos Dados
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              {isRevision && selectedStudy && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Modelo:</span>
                  <span className="font-bold text-[#004080]">{selectedStudy.studyNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Título:</span>
                <span className="font-semibold text-slate-700">{formData.titulo || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Localização:</span>
                <span className="text-slate-600">{formData.localiz || '-'}</span>
              </div>
              {formData.gasType && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Gás:</span>
                  <span className="text-slate-600">{formData.gasType}</span>
                </div>
              )}
              {formData.empresa && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Empresa:</span>
                  <span className="text-slate-600">{formData.empresa}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 1: Responsável pela Execução */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-user-check text-blue-500"></i>
              Responsável pela Execução
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Analista Responsável
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="">Selecione o analista</option>
                {allUsers
                  .filter(u => (u.role === UserRole.ADM || u.role === UserRole.ANALISTA) && u.isActive !== false)
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.sap || u.email})</option>
                  ))
                }
              </select>
            </div>
          </div>

          {/* Card 2: Prazo de Entrega Estimado */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-calendar-check text-blue-500"></i>
              Prazo de Entrega Estimado
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Data Estimada de Entrega
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Card 3: Observações do Validador */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[11px] font-black text-[#004080] uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-comment-dots text-blue-500"></i>
              Observações do Validador
            </h3>

            <textarea
              value={validatorObservations}
              onChange={(e) => setValidatorObservations(e.target.value)}
              placeholder="Observações adicionais sobre a validação..."
              rows={3}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[10px] text-blue-700">
              <i className="fa-solid fa-info-circle"></i>
              <span className="font-bold">Informação:</span>
              <span>O modelo será criado com status <strong>"Em Uso"</strong> para o analista selecionado.</span>
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handlePrevTab}
              className="px-4 py-2 rounded-xl text-[10px] font-bold text-slate-500 hover:bg-slate-100 transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-left text-[9px]"></i>
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !assignedTo}
              className="px-6 py-2 rounded-xl text-[10px] font-bold bg-[#004080] text-white hover:bg-[#003060] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                  Criando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-[9px]"></i>
                  {isRevision ? 'Criar Revisão' : 'Criar Modelo'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
