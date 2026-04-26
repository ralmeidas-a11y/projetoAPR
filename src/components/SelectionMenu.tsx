
import React from 'react';
import { FormType } from '../types/types';
import { FORM_OPTIONS } from '../constants/constants';

interface SelectionMenuProps {
  onStart: (id: FormType) => void;
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({ onStart }) => {
  // Sort options alphabetically by label
  const sortedOptions = [...FORM_OPTIONS].sort((a, b) => a.label.localeCompare(b.label));

  // Icon backgrounds for each form type
  const iconStyles: Record<string, string> = {
    'fa-house-user': 'from-blue-500 to-blue-700',
    'fa-city': 'from-teal-500 to-teal-700',
    'fa-industry': 'from-orange-500 to-orange-700',
    'fa-gas-pump': 'from-emerald-500 to-emerald-700'
  };

  const iconBgColors: Record<string, string> = {
    'fa-house-user': 'bg-blue-100 text-blue-600',
    'fa-city': 'bg-teal-100 text-teal-600',
    'fa-industry': 'bg-orange-100 text-orange-600',
    'fa-gas-pump': 'bg-emerald-100 text-emerald-600'
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
      {/* Decorative gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#004080] via-blue-600 to-orange-500"></div>
      
      <div className="mb-8 pt-4 text-center md:text-left">
        <h1 className="text-2xl font-black text-[#004080] mb-2">Novo Estudo Técnico</h1>
        <p className="text-slate-500 text-sm">Selecione o tipo de estudo para iniciar o preenchimento.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sortedOptions.map((option, index) => (
          <button
            key={option.id}
            onClick={() => onStart(option.id)}
            className="group relative flex flex-col items-center text-center p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-[#004080] hover:bg-blue-50/30 hover:shadow-xl hover:shadow-blue-500/20 transition-all active:scale-[0.99] overflow-hidden min-h-[260px]"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Hover gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-50/50 to-blue-50/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className={`flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-xl bg-gradient-to-r ${iconStyles[option.icon] || 'from-slate-400 to-slate-600'} text-white shadow-lg transform group-hover:scale-110 transition-all duration-300 mb-3`}>
              <i className={`fa-solid ${option.icon} text-xl`}></i>
            </div>
            <div className="relative z-10 w-full">
              <div className="flex flex-col items-center mb-2">
                <span className="text-xs font-black text-[#004080] uppercase tracking-widest">
                  {option.id}
                </span>
              </div>
              <span className="font-bold text-xs text-slate-800 group-hover:text-[#004080] transition-colors block mb-2 h-10 overflow-hidden">
                {option.label}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-600 h-10 overflow-hidden">{option.description}</p>
            </div>
          </button>
        ))}
      </div>

    </div>
  );
};
