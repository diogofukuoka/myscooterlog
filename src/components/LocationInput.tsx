import { useState, useEffect, useRef } from 'react';
import { X, Crosshair } from 'lucide-react';
import { SAVED_LOCATIONS } from '../data/constants';
import { MapContextType } from '../types';

interface LocationInputProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    onPickMap: () => void;
    isPicking: boolean;
    activeTab: MapContextType;
}

export function LocationInput({ label, value, onChange, placeholder, onPickMap, isPicking, activeTab }: LocationInputProps) {
    const [showList, setShowList] = useState(false);
    const [filteredLocations, setFilteredLocations] = useState(SAVED_LOCATIONS);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!value) {
            setFilteredLocations(SAVED_LOCATIONS);
        } else {
            const lowerVal = value.toLowerCase();
            const filtered = SAVED_LOCATIONS.filter(loc => 
                loc.name.toLowerCase().includes(lowerVal) || 
                loc.address.toLowerCase().includes(lowerVal)
            );
            setFilteredLocations(filtered);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowList(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (address: string) => {
        onChange(address);
        setShowList(false);
    };

    const currentName = SAVED_LOCATIONS.find(l => l.address === value)?.name;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
                {currentName && <span className={`text-[10px] font-bold truncate max-w-[150px] ${activeTab === 'official' ? 'text-emerald-600' : 'text-blue-600'}`}>{currentName}</span>}
            </div>
            
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <input 
                        type="text" 
                        value={value} 
                        onChange={(e) => { onChange(e.target.value); setShowList(true); }}
                        onFocus={() => setShowList(true)}
                        placeholder={placeholder}
                        className={`w-full border rounded-lg p-3 text-sm focus:ring-2 outline-none shadow-sm transition-all ${isPicking ? 'border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]' : 'border-slate-300'} ${activeTab === 'official' ? 'focus:ring-emerald-500' : 'focus:ring-blue-500'}`} 
                    />
                    {value && (
                        <button 
                            type="button"
                            onClick={() => onChange('')} 
                            className="absolute right-3 top-3 text-slate-400 hover:text-red-500"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                <button 
                    type="button"
                    onClick={onPickMap}
                    className={`p-3 rounded-lg border transition-colors flex-shrink-0 ${isPicking ? (activeTab === 'official' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                    title="Selecionar no mapa"
                >
                    <Crosshair size={20} />
                </button>
            </div>

            {showList && filteredLocations.length > 0 && (
                <ul className="absolute z-[100] w-full bg-white mt-1 rounded-lg shadow-xl border border-slate-100 max-h-60 overflow-y-auto custom-scroll">
                    {filteredLocations.map((loc, idx) => (
                        <li 
                            key={idx} 
                            onClick={() => handleSelect(loc.address)}
                            className={`p-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${activeTab === 'official' ? 'hover:bg-emerald-50' : 'hover:bg-blue-50'}`}
                        >
                            <div className="font-bold text-slate-700 text-sm">{loc.name}</div>
                            <div className="text-xs text-slate-500 truncate">{loc.address}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
