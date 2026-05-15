import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string; // the 'name' of the location
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder, className, required }: SearchableSelectProps & { required?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative">
      {/* Hidden input to support required validation in standard HTML forms */}
      <input 
        type="text" 
        value={value} 
        onChange={() => {}}
        required={required} 
        className="absolute w-full h-full opacity-0 pointer-events-none -z-10 focus:outline-none" 
        tabIndex={-1} 
      />
      <div 
        className={`w-full flex justify-between items-center cursor-pointer ${className || 'bg-theme-black/40 rounded-2xl p-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-theme-white text-start min-h-[44px]'}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearch('');
        }}
      >
        <span className={value ? "text-theme-white" : "text-zinc-500 font-normal"}>
          {value || placeholder || "Select..."}
        </span>
        <ChevronDown size={16} className="text-zinc-500" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-theme-white/10 rounded-2xl shadow-xl overflow-hidden max-h-60 flex flex-col">
          <div className="p-2 border-b border-theme-white/5 flex items-center gap-2 bg-zinc-900/50 sticky top-0">
            <Search size={14} className="text-zinc-500" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full bg-transparent border-none outline-none text-sm text-theme-white placeholder-zinc-500"
              placeholder="Search..."
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-zinc-500 text-center">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.id}
                  className={`p-3 text-sm cursor-pointer hover:bg-theme-white/5 transition-colors ${value === opt.name ? 'text-amber-500 font-bold bg-theme-white/5' : 'text-theme-white'}`}
                  onClick={() => {
                    onChange(opt.name);
                    setIsOpen(false);
                  }}
                >
                  {opt.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
