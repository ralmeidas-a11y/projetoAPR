
import React from 'react';
import { FormType } from './types';
import { FORM_OPTIONS } from './constants';

interface SelectionMenuProps {
  onStart: (id: FormType) => void;
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({ onStart }) => {
  // Sort options alphabetically by label
  const sortedOptions = [...FORM_OPTIONS].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-extrabold text-[#004080] mb-2">Selecione o Estudo</h1>
        <p className="text-slate-500">Escolha uma das opções abaixo para abrir o formulário técnico correspondente.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-10">
        {sortedOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onStart(option.id)}
            className="group relative flex items-center gap-5 p-6 rounded-xl border-2 border-slate-100 bg-white hover:border-[#FF8000] hover:bg-orange-50/30 hover:shadow-lg hover:shadow-orange-100/50 transition-all text-left w-full active:scale-[0.99]"
          >
            <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-[#FF8000] shadow-sm transition-all">
              <i className={`fa-solid ${option.icon} text-2xl`}></i>
            </div>
            <div className="flex-grow">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-lg text-slate-700 group-hover:text-[#004080] transition-colors">
                  {option.label}
                </span>
                <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-[#FF8000] transition-all transform group-hover:translate-x-1"></i>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{option.description}</p>
            </div>
          </button>
        ))}
      </div>

    </div>
  );
};
