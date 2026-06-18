import { useState, useRef, useEffect, FormEvent } from 'react';
import { Settings, Zap, Calculator, Trash2, Calendar, MapPin, Map, Copy, Clock, Battery } from 'lucide-react';
import { useTrips } from './hooks/useTrips';
import { AUTONOMIA, TEMPO_CARGA_POR_1_PORCENTO, PREDEFINED_ROUTES, SAVED_LOCATIONS } from './data/constants';
import { calculateMetrics, checkIsHoliday } from './lib/utils';
import { MapModal } from './components/MapModal';
import { TabType, MapContextType, Trip } from './types';

export default function App() {
    const { trips, simulatedTrips, syncConfig, setSyncConfig, saveTrips, saveSimulatedTrips, syncWithGithub } = useTrips();
    
    // UI states
    const [activeTab, setActiveTab] = useState<TabType>('official');
    const [showSettings, setShowSettings] = useState(false);
    
    // Map states
    const [showMap, setShowMap] = useState(false);
    const [mapContext, setMapContext] = useState<MapContextType>('official');
    
    // Duplicate Modal states
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [tripToDuplicate, setTripToDuplicate] = useState<Trip | null>(null);
    const [dateForDuplication, setDateForDuplication] = useState('');

    // Form states
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [distance, setDistance] = useState('');
    const [route, setRoute] = useState('');
    
    const [simDate, setSimDate] = useState(new Date().toISOString().split('T')[0]);
    const [simDistance, setSimDistance] = useState('');
    const [simRoute, setSimRoute] = useState('');

    const [showRouteList, setShowRouteList] = useState(false);
    const routeInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (routeInputRef.current && !routeInputRef.current.contains(event.target as Node)) {
                setShowRouteList(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handlers
    const handleClearAll = () => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja apagar TODOS os registros de viagem oficiais? Essa ação não pode ser desfeita.")) {
            saveTrips([]);
            localStorage.removeItem('scooter_last_dest');
            setShowSettings(false);
        }
    };

    const handleClearSimulation = () => {
        if (window.confirm("Deseja limpar todos os dados da simulação?")) {
            saveSimulatedTrips([]);
        }
    };

    const handleCopyOfficialToSimulation = () => {
        if (window.confirm("Deseja copiar todos os trajetos oficiais para a simulação? Isso substituirá os dados simulados atuais.")) {
            const copiedTrips = trips.map((t, index) => ({ ...t, id: Date.now() + index, active: true }));
            saveSimulatedTrips(copiedTrips);
        }
    };

    const updateLastDest = (routeStr: string) => {
        if (routeStr) {
            const parts = routeStr.split('/');
            const lastLocationName = parts[parts.length - 1].trim();
            const foundLocation = SAVED_LOCATIONS.find(loc => loc.name.toLowerCase() === lastLocationName.toLowerCase());
            const finalAddress = foundLocation ? foundLocation.address : lastLocationName;
            localStorage.setItem('scooter_last_dest', finalAddress);
        }
    };

    const handleAddTrip = (e: FormEvent) => {
        e.preventDefault();
        
        if (activeTab === 'official') {
            if (!distance || !route) return;
            const distValue = parseFloat(distance.toString().replace(',', '.'));
            const updatedTrips = [{ id: Date.now(), date, distance: distValue, route }, ...trips];
            saveTrips(updatedTrips);
            updateLastDest(route);
            setRoute(''); setDistance('');
        } else {
            if (!simDistance || !simRoute) return;
            const distValue = parseFloat(simDistance.toString().replace(',', '.'));
            const updatedSims = [{ id: Date.now(), date: simDate, distance: distValue, route: simRoute, active: true }, ...simulatedTrips];
            saveSimulatedTrips(updatedSims);
            updateLastDest(simRoute);
            setSimRoute(''); setSimDistance('');
        }
    };

    const handleDeleteTrip = (id: number) => {
        if (activeTab === 'official') {
            saveTrips(trips.filter(t => t.id !== id));
        } else {
            saveSimulatedTrips(simulatedTrips.filter(t => t.id !== id));
        }
    };

    const handleToggleTrip = (id: number) => {
        const updatedSims = simulatedTrips.map(t => 
            t.id === id ? { ...t, active: t.active === undefined ? false : !t.active } : t
        );
        saveSimulatedTrips(updatedSims);
    };

    const openDuplicateModal = (trip: Trip) => {
        setTripToDuplicate(trip);
        setDateForDuplication(new Date().toISOString().split('T')[0]);
        setDuplicateModalOpen(true);
    };

    const confirmDuplicate = () => {
        if (!tripToDuplicate || !dateForDuplication) return;
        
        const newTrip: Trip = {
            id: Date.now(),
            date: dateForDuplication,
            distance: tripToDuplicate.distance,
            route: tripToDuplicate.route,
            active: true
        };

        if (activeTab === 'official') {
            saveTrips([newTrip, ...trips]);
        } else {
            saveSimulatedTrips([newTrip, ...simulatedTrips]);
        }
        
        setDuplicateModalOpen(false);
        setTripToDuplicate(null);
    };

    const handleConfirmMap = (mapDistance: number, nameOrigin: string, nameDest: string, addrDest: string) => {
        const finalRoute = `${nameOrigin} / ${nameDest}`;
        if (mapContext === 'official') {
            setDistance(mapDistance.toString());
            setRoute(finalRoute);
        } else {
            setSimDistance(mapDistance.toString());
            setSimRoute(finalRoute);
        }
        localStorage.setItem('scooter_last_dest', addrDest);
        setShowMap(false);
    };

    const activeRouteInput = activeTab === 'official' ? route : simRoute;
    const tripsToCalculate = activeTab === 'official' ? trips : simulatedTrips.filter(t => t.active !== false);

    const totalKm = tripsToCalculate.reduce((acc, curr) => acc + curr.distance, 0);
    const totalCost = tripsToCalculate.reduce((acc, curr) => acc + parseFloat(calculateMetrics(curr.distance).value.replace(',', '.')), 0);
    const totalPercentRaw = (totalKm / AUTONOMIA) * 100;
    const totalPercentStr = totalPercentRaw.toFixed(2).replace('.', ',');
    const totalChargeMinutes = Math.ceil(totalPercentRaw * TEMPO_CARGA_POR_1_PORCENTO);
    const totalChargeHours = Math.floor(totalChargeMinutes / 60);
    const totalChargeMins = totalChargeMinutes % 60;
    const totalChargeStr = `${String(totalChargeHours).padStart(2, '0')}:${String(totalChargeMins).padStart(2, '0')}`;

    let batteryBgClass = "bg-white";
    let batteryTextClass = "text-slate-700";
    let batteryLabelClass = "text-slate-400";

    if (totalPercentRaw < 21) {
        batteryBgClass = "bg-red-100";
        batteryTextClass = "text-red-800";
        batteryLabelClass = "text-red-600";
    } else if (totalPercentRaw >= 50) {
        batteryBgClass = "bg-red-700";
        batteryTextClass = "text-white";
        batteryLabelClass = "text-red-200";
    }

    const currentTrips = activeTab === 'official' ? trips : simulatedTrips;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8 pb-20">
            {duplicateModalOpen && tripToDuplicate && (
                <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-lg text-slate-700 mb-2 flex items-center gap-2">
                            <Copy size={20} className={activeTab === 'official' ? 'text-emerald-500' : 'text-blue-500'} /> Duplicar Viagem
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Trajeto: <span className="font-bold text-slate-700">{tripToDuplicate.route}</span>
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Data</label>
                            <input 
                                type="date" 
                                value={dateForDuplication} 
                                onChange={(e) => setDateForDuplication(e.target.value)} 
                                className={`w-full bg-slate-50 border rounded-lg p-3 outline-none focus:ring-2 ${activeTab === 'official' ? 'focus:ring-emerald-500' : 'focus:ring-blue-500'}`} 
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setDuplicateModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Cancelar</button>
                            <button onClick={confirmDuplicate} className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow-md ${activeTab === 'official' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {showMap && (
                <MapModal 
                    mapContext={mapContext} 
                    onClose={() => setShowMap(false)} 
                    onConfirm={handleConfirmMap} 
                    initialOrigin={localStorage.getItem('scooter_last_dest') || ''}
                />
            )}

            {showSettings && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
                        <h2 className="font-black text-slate-700 text-lg">Configurações</h2>
                        
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Sincronização GitHub</p>
                            <input type="password" placeholder="GitHub Personal Token" value={syncConfig.token} onChange={e => setSyncConfig({...syncConfig, token: e.target.value})} className="w-full bg-slate-100 p-3 rounded-xl text-xs outline-none" />
                            <input type="text" placeholder="Gist ID" value={syncConfig.gistId} onChange={e => setSyncConfig({...syncConfig, gistId: e.target.value})} className="w-full bg-slate-100 p-3 rounded-xl text-xs outline-none" />
                            <button onClick={() => {
                                localStorage.setItem('gh_token', syncConfig.token);
                                localStorage.setItem('gh_gist_id', syncConfig.gistId);
                                setShowSettings(false);
                                window.location.reload();
                            }} className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl shadow-lg text-xs uppercase tracking-widest">Salvar e Sincronizar</button>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-red-400 uppercase mb-2">Zona de Perigo</p>
                            <button onClick={handleClearAll} className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl border border-red-100 flex items-center justify-center gap-2 text-xs uppercase tracking-widest hover:bg-red-100 transition-colors">
                                <Trash2 size={16} /> Apagar Todos os Registros
                            </button>
                        </div>

                        <button onClick={() => setShowSettings(false)} className="w-full text-slate-400 text-xs font-bold py-2">FECHAR</button>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h1 className={`text-2xl font-bold flex items-center gap-2 ${activeTab === 'official' ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {activeTab === 'official' ? <Zap className="fill-emerald-600 text-emerald-600" /> : <Calculator className="fill-blue-600 text-blue-600" />} 
                        MyScooter Log {activeTab === 'simulation' && <span className="text-sm font-normal text-slate-400 ml-2">- Simulação</span>}
                    </h1>
                    <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 bg-white rounded-full shadow-sm border hover:bg-slate-50 transition-colors"><Settings /></button>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('official')} 
                        className={`flex-1 py-3 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all ${activeTab === 'official' ? 'bg-emerald-600 text-white shadow-lg scale-100' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 scale-95'}`}
                    >
                        <Zap size={20} className={activeTab === 'official' ? 'fill-white text-white' : ''} /> Oficial
                    </button>
                    <button 
                        onClick={() => setActiveTab('simulation')} 
                        className={`flex-1 py-3 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all ${activeTab === 'simulation' ? 'bg-blue-600 text-white shadow-lg scale-100' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 scale-95'}`}
                    >
                        <Calculator size={20} className={activeTab === 'simulation' ? 'fill-white text-white' : ''} /> Simulação
                    </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <div className="text-xs text-slate-400 font-bold uppercase">Custo</div>
                        <div className={`text-xl font-bold ${activeTab === 'official' ? 'text-emerald-600' : 'text-blue-600'}`}>R$ {totalCost.toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <div className="text-xs text-slate-400 font-bold uppercase">KM</div>
                        <div className={`text-xl font-bold ${activeTab === 'official' ? 'text-blue-600' : 'text-indigo-600'}`}>{totalKm.toFixed(1)} km</div>
                    </div>
                    
                    <div className={`${batteryBgClass} p-4 rounded-xl shadow-sm border text-center transition-colors duration-300`}>
                        <div className={`text-xs ${batteryLabelClass} font-bold uppercase`}>Bateria</div>
                        <div className={`text-xl font-bold ${batteryTextClass}`}>{totalPercentStr}%</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <div className="text-xs text-slate-400 font-bold uppercase">Carga</div>
                        <div className="text-xl font-bold text-amber-600">{totalChargeStr}</div>
                    </div>
                </div>
                
                <div className={`bg-white p-6 rounded-2xl shadow-md border-l-4 ${activeTab === 'official' ? 'border-emerald-500' : 'border-blue-500'}`}>
                    <form onSubmit={handleAddTrip} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                            <input 
                                type="date" 
                                required 
                                value={activeTab === 'official' ? date : simDate} 
                                onChange={(e) => activeTab === 'official' ? setDate(e.target.value) : setSimDate(e.target.value)} 
                                className="w-full bg-slate-50 border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" 
                            />
                        </div>
                        
                        <div className="md:col-span-2 relative" ref={routeInputRef}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trajeto</label>
                            <input 
                                type="text" 
                                value={activeTab === 'official' ? route : simRoute} 
                                onChange={(e) => { 
                                    activeTab === 'official' ? setRoute(e.target.value) : setSimRoute(e.target.value); 
                                    setShowRouteList(true); 
                                }}
                                onFocus={() => setShowRouteList(true)}
                                placeholder="Digite ou selecione..."
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" 
                            />
                            {showRouteList && (
                                <ul className="absolute z-50 w-full bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1 custom-scroll">
                                    {PREDEFINED_ROUTES.filter(r => r.name.toLowerCase().includes(activeRouteInput.toLowerCase())).map((r, idx) => (
                                        <li 
                                            key={idx} 
                                            onMouseDown={() => {
                                                if (activeTab === 'official') {
                                                    setRoute(r.name);
                                                    setDistance(r.dist.toString());
                                                } else {
                                                    setSimRoute(r.name);
                                                    setSimDistance(r.dist.toString());
                                                }
                                                setShowRouteList(false);
                                            }}
                                            className={`p-3 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center ${activeTab === 'official' ? 'hover:bg-emerald-50' : 'hover:bg-blue-50'}`}
                                        >
                                            <span className="text-sm font-bold text-slate-700">{r.name}</span>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${activeTab === 'official' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>{r.dist.toString().replace('.', ',')} km</span>
                                        </li>
                                    ))}
                                    {PREDEFINED_ROUTES.filter(r => r.name.toLowerCase().includes(activeRouteInput.toLowerCase())).length === 0 && (
                                        <li className="p-3 text-xs text-slate-400 text-center">Nenhum trajeto encontrado</li>
                                    )}
                                </ul>
                            )}
                        </div>

                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distância (KM)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    required 
                                    value={activeTab === 'official' ? distance : simDistance} 
                                    onChange={(e) => activeTab === 'official' ? setDistance(e.target.value) : setSimDistance(e.target.value)} 
                                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => { setMapContext(activeTab); setShowMap(true); }} 
                                    className={`p-2.5 rounded-lg transition-colors ${activeTab === 'official' ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                                >
                                    <Map size={20} />
                                </button>
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            className={`md:col-span-4 text-white font-bold py-3 rounded-lg transition-colors ${activeTab === 'official' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {activeTab === 'official' ? 'Registrar Viagem' : 'Adicionar à Simulação'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                            <Calendar size={20} /> {activeTab === 'official' ? 'Histórico de Viagens' : 'Trajetos Simulados'}
                        </h2>
                        
                        {activeTab === 'simulation' && (
                            <div className="flex gap-2">
                                <button onClick={handleCopyOfficialToSimulation} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                                    <Copy size={14}/> Copiar Oficial
                                </button>
                                {simulatedTrips.length > 0 && (
                                    <button onClick={handleClearSimulation} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                        <Trash2 size={14}/> Limpar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {currentTrips.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            {activeTab === 'official' ? 'Nenhuma viagem registrada.' : 'Nenhum trajeto simulado.'}
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {currentTrips.map((trip) => {
                                const metrics = calculateMetrics(trip.distance);
                                const [year, month, day] = trip.date.split('-');
                                const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                const dayOfWeekStr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dateObj.getDay()];
                                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                const isHoliday = checkIsHoliday(trip.date);
                                const isRed = isWeekend || isHoliday;
                                const isActive = trip.active !== false;

                                return (
                                    <div key={trip.id} className={`relative bg-white p-3 rounded-lg shadow-sm border border-slate-100 transition-opacity duration-300 ${!isActive && activeTab === 'simulation' ? 'opacity-50' : 'opacity-100'}`}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {activeTab === 'simulation' && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isActive} 
                                                        onChange={() => handleToggleTrip(trip.id)}
                                                        className="custom-checkbox flex-shrink-0"
                                                    />
                                                )}
                                                <div className="font-bold text-slate-800 text-sm truncate leading-tight">{trip.route}</div>
                                            </div>
                                            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">R$ {metrics.value}</div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className={`font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${activeTab === 'official' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {day}/{month}
                                                    <span className={isRed ? 'text-red-500 font-black' : 'opacity-70'}>
                                                        - {dayOfWeekStr}
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-1" title="Distância"><MapPin size={12} /> {trip.distance}</span>
                                                <span className="flex items-center gap-1" title="Tempo Estimado"><Clock size={12} /> {metrics.time}</span>
                                                <span className="flex items-center gap-1" title="Bateria"><Battery size={12} /> {metrics.percent}%</span>
                                            </div>

                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => openDuplicateModal(trip)}
                                                    className="text-slate-300 hover:text-blue-500 transition-colors"
                                                    title="Duplicar"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteTrip(trip.id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
