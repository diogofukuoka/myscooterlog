import { AUTONOMIA, TEMPO_CARGA_POR_1_PORCENTO, PREDEFINED_ROUTES, SAVED_LOCATIONS } from './constants.js';
import { calculateMetrics, checkIsHoliday } from './utils.js';

const state = {
    activeTab: 'official',
    trips: JSON.parse(localStorage.getItem('scooter_trips') || '[]'),
    simulatedTrips: JSON.parse(localStorage.getItem('scooter_sim_trips') || '[]'),
    date: new Date().toISOString().split('T')[0],
    distance: '',
    route: '',
    simDate: new Date().toISOString().split('T')[0],
    simDistance: '',
    simRoute: '',
    syncConfig: {
        token: localStorage.getItem('gh_token') || '',
        gistId: localStorage.getItem('gh_gist_id') || ''
    }
};

const D = {
    tabOfficial: document.getElementById('tab-official'),
    tabSim: document.getElementById('tab-simulation'),
    mainTitle: document.getElementById('main-title'),
    formContainer: document.getElementById('form-container'),
    listTitle: document.getElementById('list-title'),
    simActions: document.getElementById('sim-actions'),
    tripsContainer: document.getElementById('trips-container'),
    
    totalCost: document.getElementById('total-cost'),
    totalKm: document.getElementById('total-km'),
    totalBattery: document.getElementById('total-battery'),
    totalCharge: document.getElementById('total-charge'),
    batteryCard: document.getElementById('battery-card'),
    batteryLabel: document.getElementById('battery-label'),
    
    inputDate: document.getElementById('input-date'),
    inputRoute: document.getElementById('input-route'),
    inputDistance: document.getElementById('input-distance'),
    routeSuggestions: document.getElementById('route-suggestions'),
    tripForm: document.getElementById('trip-form'),
    btnSubmit: document.getElementById('btn-submit'),
    
    // Settings
    btnSettings: document.getElementById('btn-settings'),
    settingsModal: document.getElementById('settings-modal'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnForceSync: document.getElementById('btn-force-sync'),
    inputGhToken: document.getElementById('input-gh-token'),
    inputGhGist: document.getElementById('input-gh-gist'),
    
    // Map
    btnOpenMap: document.getElementById('btn-open-map'),
    mapModal: document.getElementById('map-modal'),
    btnCloseMap: document.getElementById('btn-close-map')
};

function render() {
    // Tabs + Headers
    if (state.activeTab === 'official') {
        D.tabOfficial.className = "flex-1 py-3 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all bg-emerald-600 text-white shadow-lg scale-100";
        D.tabOfficial.innerHTML = `<i data-lucide="zap" class="text-white fill-white"></i> Oficial`;
        D.tabSim.className = "flex-1 py-3 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 scale-95";
        D.tabSim.innerHTML = `<i data-lucide="monitor"></i> Simulação`;
        D.mainTitle.innerHTML = `<i data-lucide="zap" class="text-emerald-600 fill-emerald-600 shrink-0"></i> <span class="truncate">MyScooter Log</span>`;
        D.formContainer.className = "bg-white p-6 rounded-2xl shadow-md border-l-4 border-emerald-500";
        D.listTitle.innerHTML = `<i data-lucide="calendar"></i> Histórico de Viagens`;
        D.simActions.classList.add('hidden');
        D.btnSubmit.className = "md:col-span-4 text-white font-bold py-3 rounded-lg transition-colors bg-emerald-600 hover:bg-emerald-700";
        D.btnSubmit.textContent = "Registrar Viagem";
        
        D.inputDate.value = state.date;
        D.inputRoute.value = state.route;
        D.inputDistance.value = state.distance;
    } else {
        D.tabSim.className = "flex-1 py-3 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all bg-blue-600 text-white shadow-lg scale-100";
        D.tabSim.innerHTML = `<i data-lucide="monitor" class="text-white fill-white"></i> Simulação`;
        D.tabOfficial.className = "flex-1 py-3 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 scale-95";
        D.tabOfficial.innerHTML = `<i data-lucide="zap"></i> Oficial`;
        D.mainTitle.innerHTML = `<i data-lucide="monitor" class="text-blue-600 fill-blue-600 shrink-0"></i> <span class="truncate">MyScooter Log<span class="text-sm font-normal text-slate-400 ml-2">- Simulação</span></span>`;
        D.formContainer.className = "bg-white p-6 rounded-2xl shadow-md border-l-4 border-blue-500";
        D.listTitle.innerHTML = `<i data-lucide="calendar"></i> Trajetos Simulados`;
        D.simActions.classList.remove('hidden');
        D.btnSubmit.className = "md:col-span-4 text-white font-bold py-3 rounded-lg transition-colors bg-blue-600 hover:bg-blue-700";
        D.btnSubmit.textContent = "Adicionar à Simulação";
        
        D.inputDate.value = state.simDate;
        D.inputRoute.value = state.simRoute;
        D.inputDistance.value = state.simDistance;
    }
    
    // Totals
    const trips = Array.isArray(state.activeTab === 'official' ? state.trips : state.simulatedTrips) 
        ? (state.activeTab === 'official' ? state.trips : state.simulatedTrips) 
        : [];
    const tripsToCalc = state.activeTab === 'official' ? trips : trips.filter(t => t.active !== false);
    
    const tKm = tripsToCalc.reduce((acc, c) => acc + (c.distance || 0), 0);
    const tCost = tripsToCalc.reduce((acc, c) => acc + parseFloat(calculateMetrics(c.distance || 0).value.replace(',','.')), 0);
    const tPercRaw = (tKm / AUTONOMIA) * 100;
    const tChargeM = Math.ceil(tPercRaw * TEMPO_CARGA_POR_1_PORCENTO);
    
    D.totalCost.textContent = `R$ ${tCost.toFixed(2).replace('.',',')}`;
    D.totalCost.className = `text-xl font-bold ${state.activeTab === 'official' ? 'text-emerald-600' : 'text-blue-600'}`;
    D.totalKm.textContent = `${tKm.toFixed(1)} km`;
    D.totalKm.className = `text-xl font-bold ${state.activeTab === 'official' ? 'text-blue-600' : 'text-indigo-600'}`;
    D.totalBattery.textContent = `${tPercRaw.toFixed(2).replace('.',',')}%`;
    D.totalCharge.textContent = `${String(Math.floor(tChargeM/60)).padStart(2,'0')}:${String(tChargeM%60).padStart(2,'0')}`;
    
    let bBg = "bg-white", bTxt = "text-slate-700", bLbl = "text-slate-400";
    if(tPercRaw < 21) { bBg = "bg-red-100"; bTxt = "text-red-800"; bLbl = "text-red-600"; }
    else if(tPercRaw >= 50) { bBg = "bg-red-700"; bTxt = "text-white"; bLbl = "text-red-200"; }
    
    D.batteryCard.className = `${bBg} p-4 rounded-xl shadow-sm border text-center transition-colors duration-300`;
    D.batteryLabel.className = `text-xs ${bLbl} font-bold uppercase`;
    D.totalBattery.className = `text-xl font-bold ${bTxt}`;

    // List
    if(tripsToCalc.length === 0 && trips.length > 0 && state.activeTab === 'simulation') {
        D.tripsContainer.innerHTML = `<div class="text-center py-10 text-slate-400">Nenhum trajeto ativo na simulação.</div>`;
    } else if(trips.length === 0) {
        D.tripsContainer.innerHTML = `<div class="text-center py-10 text-slate-400">${state.activeTab==='official'?'Nenhuma viagem registrada.':'Nenhum trajeto simulado.'}</div>`;
    } else {
        D.tripsContainer.innerHTML = trips.map(t => {
            const m = calculateMetrics(t.distance || 0);
            const dateStr = t.date || new Date().toISOString().split('T')[0];
            const [y,mo,d] = dateStr.split('-');
            const dObj = new Date(parseInt(y), parseInt(mo)-1, parseInt(d));
            const isRed = (dObj.getDay()===0 || dObj.getDay()===6) || checkIsHoliday(dateStr);
            const isActive = t.active !== false;
            
            return `
            <div class="relative bg-white p-3 rounded-lg shadow-sm border border-slate-100 transition-opacity duration-300 ${!isActive && state.activeTab==='simulation' ? 'opacity-50':'opacity-100'}">
                <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="flex items-center gap-2 overflow-hidden">
                        ${state.activeTab==='simulation' ? `<input type="checkbox" class="custom-checkbox flex-shrink-0" ${isActive?'checked':''} data-id="${t.id}" />` : ''}
                        <div class="font-bold text-slate-800 text-sm truncate leading-tight">${t.route || 'Sem Trajeto'}</div>
                    </div>
                    <div class="text-xs font-bold text-slate-500 whitespace-nowrap">R$ ${m.value}</div>
                </div>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 text-xs text-slate-500">
                        <span class="font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${state.activeTab==='official'?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}">
                            ${d}/${mo} <span class="${isRed?'text-red-500 font-black':'opacity-70'}">- ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dObj.getDay()]}</span>
                        </span>
                        <span class="flex items-center gap-1"><i data-lucide="map-pin" width="12"></i> ${t.distance || 0}</span>
                        <span class="flex items-center gap-1"><i data-lucide="clock" width="12"></i> ${m.time}</span>
                        <span class="flex items-center gap-1"><i data-lucide="battery" width="12"></i> ${m.percent}%</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn-del text-slate-300 hover:text-red-500 transition-colors" data-id="${t.id}"><i data-lucide="trash-2" width="16"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
        
        document.querySelectorAll('.btn-del').forEach(b => {
             b.onclick = () => {
                 const id = parseInt(b.dataset.id);
                 if(state.activeTab === 'official') {
                     state.trips = state.trips.filter(x => x.id !== id);
                     saveData();
                 } else {
                     state.simulatedTrips = state.simulatedTrips.filter(x => x.id !== id);
                     saveData();
                 }
                 render();
             };
        });
        document.querySelectorAll('.custom-checkbox').forEach(c => {
             c.onchange = () => {
                 const id = parseInt(c.dataset.id);
                 const t = state.simulatedTrips.find(x => x.id === id);
                 if(t) t.active = c.checked;
                 saveData();
                 render();
             };
        });
    }
    if (window.lucide) { lucide.createIcons(); }
}

function saveData() {
    localStorage.setItem('scooter_trips', JSON.stringify(state.trips));
    localStorage.setItem('scooter_sim_trips', JSON.stringify(state.simulatedTrips));
    syncGit();
}

async function syncGit() {
    const { token, gistId } = state.syncConfig;
    if(!token || !gistId) return;
    try {
        await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `token ${token}` },
            body: JSON.stringify({
                files: { 
                    "scooter_trips.json": { content: JSON.stringify(state.trips) },
                    "scooter_sim_trips.json": { content: JSON.stringify(state.simulatedTrips) }
                }
            })
        });
    } catch(e){}
}

async function loadGit() {
    const { token, gistId } = state.syncConfig;
    if(!token || !gistId) return;
    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const data = await res.json();
        if(data.files && data.files["scooter_trips.json"]) {
            state.trips = JSON.parse(data.files["scooter_trips.json"].content);
            localStorage.setItem('scooter_trips', JSON.stringify(state.trips));
        }
        if(data.files && data.files["scooter_sim_trips.json"]) {
            state.simulatedTrips = JSON.parse(data.files["scooter_sim_trips.json"].content);
            localStorage.setItem('scooter_sim_trips', JSON.stringify(state.simulatedTrips));
        }
        render();
    } catch(e) {}
}

// Event Listeners
D.tabOfficial.onclick = () => { state.activeTab = 'official'; render(); };
D.tabSim.onclick = () => { state.activeTab = 'simulation'; render(); };

// Settings Events
document.addEventListener('click', (e) => {
    const btnSet = e.target.closest('#btn-settings');
    if (btnSet) {
        D.inputGhToken.value = state.syncConfig.token;
        D.inputGhGist.value = state.syncConfig.gistId;
        D.settingsModal.classList.remove('hidden');
    }
    
    if (e.target.closest('#btn-close-settings')) {
        D.settingsModal.classList.add('hidden');
    }
    
    if (e.target.closest('#btn-save-settings')) {
        state.syncConfig.token = D.inputGhToken.value;
        state.syncConfig.gistId = D.inputGhGist.value;
        localStorage.setItem('gh_token', state.syncConfig.token);
        localStorage.setItem('gh_gist_id', state.syncConfig.gistId);
        D.settingsModal.classList.add('hidden');
        syncGit();
    }
    
    if (e.target.closest('#btn-force-sync')) {
        D.settingsModal.classList.add('hidden');
        loadGit();
    }
    if (e.target.closest('#btn-open-map')) {
        D.mapModal.classList.remove('hidden');
        
        if (!map) {
            map = L.map('map-view').setView([-25.4284, -49.2733], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        }
        
        setTimeout(() => { map.invalidateSize(); }, 100);
    }
    
    if (e.target.closest('#btn-close-map')) {
        D.mapModal.classList.add('hidden');
    }
});

let map = null;

D.inputRoute.oninput = (e) => {
    const val = e.target.value;
    if(state.activeTab === 'official') state.route = val;
    else state.simRoute = val;
    
    if(!val) { D.routeSuggestions.classList.add('hidden'); return; }
    
    const m = PREDEFINED_ROUTES.filter(r => r.name.toLowerCase().includes(val.toLowerCase()));
    if(m.length === 0) {
        D.routeSuggestions.innerHTML = `<li class="p-3 text-xs text-slate-400 text-center">Nenhum trajeto encontrado</li>`;
    } else {
        D.routeSuggestions.innerHTML = m.map(r => `
            <li class="sugg-item p-3 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center ${state.activeTab==='official'?'hover:bg-emerald-50':'hover:bg-blue-50'}">
                <span class="text-sm font-bold text-slate-700">${r.name}</span>
                <span class="text-xs font-bold px-2 py-1 rounded ${state.activeTab==='official'?'text-emerald-600 bg-emerald-50':'text-blue-600 bg-blue-50'}">${r.dist} km</span>
            </li>
        `).join('');
        document.querySelectorAll('.sugg-item').forEach((li, idx) => {
            li.onmousedown = () => {
                const sel = m[idx];
                if(state.activeTab === 'official') {
                    state.route = sel.name;
                    state.distance = sel.dist;
                } else {
                    state.simRoute = sel.name;
                    state.simDistance = sel.dist;
                }
                D.routeSuggestions.classList.add('hidden');
                render();
            };
        });
    }
    D.routeSuggestions.classList.remove('hidden');
};

D.inputRoute.onfocus = () => D.inputRoute.dispatchEvent(new Event('input'));
D.inputRoute.onblur = () => setTimeout(()=>D.routeSuggestions.classList.add('hidden'), 200);

D.inputDate.onchange = e => state.activeTab === 'official' ? state.date = e.target.value : state.simDate = e.target.value;
D.inputDistance.onchange = e => state.activeTab === 'official' ? state.distance = e.target.value : state.simDistance = e.target.value;

D.tripForm.onsubmit = e => {
    e.preventDefault();
    if(state.activeTab === 'official') {
        state.trips.unshift({ id: Date.now(), date: state.date, distance: parseFloat(state.distance), route: state.route });
        localStorage.setItem('scooter_last_dest', state.route.split('/').pop().trim());
        state.route = ''; state.distance = '';
    } else {
        state.simulatedTrips.unshift({ id: Date.now(), date: state.simDate, distance: parseFloat(state.simDistance), route: state.simRoute, active: true });
        localStorage.setItem('scooter_last_dest', state.simRoute.split('/').pop().trim());
        state.simRoute = ''; state.simDistance = '';
    }
    saveData();
    render();
};

document.getElementById('btn-copy-official').onclick = () => {
    if(confirm("Deseja copiar todos os trajetos oficiais para a simulação?")) {
        state.simulatedTrips = state.trips.map((t,i) => ({...t, id: Date.now()+i, active: true}));
        saveData(); render();
    }
};

document.getElementById('btn-clear-sim').onclick = () => {
    if(confirm("Deseja limpar todos os dados da simulação?")) {
        state.simulatedTrips = []; saveData(); render();
    }
};

loadGit();
render();
