import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { X, Map as MapIcon, ArrowUpDown, Search, MapPin } from 'lucide-react';
import { LocationInput } from './LocationInput';
import { SAVED_LOCATIONS } from '../data/constants';
import { MapContextType } from '../types';

interface MapModalProps {
    mapContext: MapContextType;
    onClose: () => void;
    onConfirm: (distance: number, nameOrigin: string, nameDest: string, addrDest: string) => void;
    initialOrigin: string;
}

const getNameByAddress = (addr: string) => {
    const found = SAVED_LOCATIONS.find(loc => loc.address === addr);
    return found ? found.name : null;
};

const reverseGeocode = async (lat: number, lng: number) => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        const addr = data.address;
        
        const street = addr.road || addr.pedestrian || addr.suburb || addr.hamlet || addr.village;
        const number = addr.house_number ? `, ${addr.house_number}` : '';
        const district = addr.suburb || addr.neighbourhood || addr.city_district;
        
        if (street) {
            return `${street}${number}${district ? ` - ${district}` : ''}`;
        }
        return data.display_name.split(',')[0];
    } catch (error) {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
};

const searchAddress = async (query: string) => {
    try {
        const coordMatch = query.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
        if (coordMatch) {
            return { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[3]) };
        }

        const searchQuery = query.toLowerCase().includes('curitiba') ? query : `${query}, Curitiba, Brasil`;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        return null;
    } catch (error) { return null; }
};

// Fix Leaflet Default Icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export function MapModal({ mapContext, onClose, onConfirm, initialOrigin }: MapModalProps) {
    const [addrOrigin, setAddrOrigin] = useState(initialOrigin);
    const [addrDest, setAddrDest] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [pickingMode, setPickingMode] = useState<'origin' | 'dest' | null>(null);
    const [mapDistance, setMapDistance] = useState(0);

    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const routingControlRef = useRef<any>(null);
    const pickingModeRef = useRef(pickingMode);

    useEffect(() => { pickingModeRef.current = pickingMode; }, [pickingMode]);

    useEffect(() => {
        let mapInstance: L.Map | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let initTimeout: ReturnType<typeof setTimeout> | null = null;

        const initializeLeaflet = () => {
            const container = mapContainerRef.current;
            if (!container) return;

            if (container.clientWidth === 0 || container.clientHeight === 0) {
                initTimeout = setTimeout(initializeLeaflet, 50);
                return;
            }

            if ((container as any)._leaflet_id) {
                (container as any)._leaflet_id = null;
            }

            mapInstance = L.map(container).setView([-25.4284, -49.2733], 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(mapInstance);
            
            mapInstance.on('click', async (e: L.LeafletMouseEvent) => {
                const mode = pickingModeRef.current;
                if (mode && mapInstance) {
                    const lat = e.latlng.lat;
                    const lng = e.latlng.lng;
                    
                    L.marker(e.latlng).addTo(mapInstance).bindPopup(mode === 'origin' ? "Origem" : "Destino").openPopup();
                    
                    if (mode === 'origin') setAddrOrigin("Buscando endereço...");
                    else if (mode === 'dest') setAddrDest("Buscando endereço...");

                    const address = await reverseGeocode(lat, lng);

                    if (mode === 'origin') setAddrOrigin(address);
                    else if (mode === 'dest') setAddrDest(address);
                    
                    setPickingMode(null);
                }
            });

            mapRef.current = mapInstance;
            mapInstance.invalidateSize();

            if (window.ResizeObserver) {
                resizeObserver = new ResizeObserver(() => {
                    if (mapRef.current) {
                        mapRef.current.invalidateSize();
                    }
                });
                resizeObserver.observe(container);
            }
        };

        initializeLeaflet();

        return () => {
            if (initTimeout) clearTimeout(initTimeout);
            if (resizeObserver) resizeObserver.disconnect();
            if (mapInstance) mapInstance.remove();
            mapRef.current = null;
            routingControlRef.current = null;
        };
    }, []);

    const updateRoute = (waypoints: L.LatLng[]) => {
        const map = mapRef.current;
        if (!map) return;
        if (routingControlRef.current) map.removeControl(routingControlRef.current);
        map.eachLayer((layer) => { if (layer instanceof L.Marker) map.removeLayer(layer); });
        
        const control = (L as any).Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            show: false,
            createMarker: (i, wp) => L.marker(wp.latLng)
        }).on('routesfound', (e: any) => {
            setMapDistance(parseFloat((e.routes[0].summary.totalDistance / 1000).toFixed(1)));
            setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 100);
        }).addTo(map);
        routingControlRef.current = control;
    };

    const handleRouteSearch = async () => {
        if (!addrOrigin || !addrDest) return;
        setIsSearching(true);
        const startCoords = await searchAddress(addrOrigin);
        const endCoords = await searchAddress(addrDest);
        if (startCoords && endCoords && mapRef.current) {
            updateRoute([L.latLng(startCoords.lat, startCoords.lon), L.latLng(endCoords.lat, endCoords.lon)]);
        }
        setIsSearching(false);
    };

    const handleSwapAddresses = () => {
        const temp = addrOrigin;
        setAddrOrigin(addrDest);
        setAddrDest(temp);
    };

    const handleConfirm = () => {
        const nameOrigin = getNameByAddress(addrOrigin) || addrOrigin;
        const nameDest = getNameByAddress(addrDest) || addrDest;
        const formatName = (name: string) => name.length > 25 ? name.substring(0, 25) + '...' : name;
        onConfirm(mapDistance, formatName(nameOrigin), formatName(nameDest), addrDest);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                <div className="p-4 bg-slate-100 border-b flex justify-between items-center flex-shrink-0">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <MapIcon size={18} /> Calcular Rota 
                        {mapContext === 'simulation' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2">Simulação</span>}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-4 bg-white border-b overflow-y-visible z-20 flex-shrink-0">
                    <div className="flex flex-col sm:flex-row gap-2 items-center mb-4">
                        <LocationInput 
                            label="Origem" 
                            value={addrOrigin} 
                            onChange={setAddrOrigin} 
                            placeholder="Onde você está?"
                            onPickMap={() => setPickingMode(pickingMode === 'origin' ? null : 'origin')}
                            isPicking={pickingMode === 'origin'}
                            activeTab={mapContext}
                        />
                        
                        <button 
                            onClick={handleSwapAddresses}
                            className={`p-2 rounded-full bg-slate-100 text-slate-500 transition-colors shadow-sm border border-slate-200 mt-2 sm:mt-4 ${mapContext === 'official' ? 'hover:bg-emerald-100 hover:text-emerald-600' : 'hover:bg-blue-100 hover:text-blue-600'}`}
                            title="Inverter endereços"
                        >
                            <ArrowUpDown size={20} className="sm:rotate-90 transition-transform" />
                        </button>

                        <LocationInput 
                            label="Destino" 
                            value={addrDest} 
                            onChange={setAddrDest} 
                            placeholder="Para onde vai?"
                            onPickMap={() => setPickingMode(pickingMode === 'dest' ? null : 'dest')}
                            isPicking={pickingMode === 'dest'}
                            activeTab={mapContext}
                        />
                    </div>
                    <button 
                        onClick={handleRouteSearch} 
                        disabled={isSearching} 
                        className={`w-full text-white py-3 rounded-lg text-sm font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-[0.98] ${mapContext === 'official' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isSearching ? <div className="loader"></div> : <Search size={16} />} Buscar Rota
                    </button>
                </div>

                <div className={`relative flex-grow w-full bg-slate-200 overflow-hidden min-h-[300px] ${pickingMode ? 'cursor-crosshair' : ''}`}>
                    {pickingMode && (
                        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce flex items-center gap-2 whitespace-nowrap pointer-events-none ${mapContext === 'official' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                            <MapPin size={16} />
                            Toque no mapa para definir {pickingMode === 'origin' ? 'Origem' : 'Destino'}
                        </div>
                    )}
                    
                    <div ref={mapContainerRef} className="absolute inset-0 z-[1]"></div>
                    
                    {mapDistance > 0 && (
                        <div className="absolute bottom-6 left-6 right-6 bg-white/95 p-4 rounded-lg shadow-lg border border-slate-200 flex justify-between items-center z-[1000]">
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-bold">Distância</div>
                                <div className={`text-2xl font-bold ${mapContext === 'official' ? 'text-emerald-600' : 'text-blue-600'}`}>{mapDistance} km</div>
                            </div>
                            <button 
                                onClick={handleConfirm} 
                                className={`text-white px-6 py-2 rounded-lg font-bold ${mapContext === 'official' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Confirmar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
