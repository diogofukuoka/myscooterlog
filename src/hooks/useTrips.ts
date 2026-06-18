import { useState, useEffect, useCallback } from 'react';
import { Trip, SyncConfig } from '../types';

export const useTrips = () => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [simulatedTrips, setSimulatedTrips] = useState<Trip[]>([]);
    const [syncConfig, setSyncConfig] = useState<SyncConfig>({
        token: localStorage.getItem('gh_token') || '',
        gistId: localStorage.getItem('gh_gist_id') || ''
    });

    const syncWithGithub = useCallback(async (officialData: Trip[], simData: Trip[]) => {
        if (!syncConfig.token || !syncConfig.gistId) return;
        try {
            await fetch(`https://api.github.com/gists/${syncConfig.gistId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `token ${syncConfig.token}` },
                body: JSON.stringify({
                    files: { 
                        "scooter_trips.json": { content: JSON.stringify(officialData) },
                        "scooter_sim_trips.json": { content: JSON.stringify(simData) }
                    }
                })
            });
        } catch (e) {
            console.error("Erro ao sincronizar:", e);
        }
    }, [syncConfig]);

    const saveTrips = useCallback((newTrips: Trip[]) => {
        setTrips(newTrips);
        localStorage.setItem('scooter_trips', JSON.stringify(newTrips));
        syncWithGithub(newTrips, simulatedTrips);
    }, [simulatedTrips, syncWithGithub]);

    const saveSimulatedTrips = useCallback((newSimTrips: Trip[]) => {
        setSimulatedTrips(newSimTrips);
        localStorage.setItem('scooter_sim_trips', JSON.stringify(newSimTrips));
        syncWithGithub(trips, newSimTrips);
    }, [trips, syncWithGithub]);

    const loadFromGithub = useCallback(async () => {
        if (!syncConfig.token || !syncConfig.gistId) return;
        try {
            const res = await fetch(`https://api.github.com/gists/${syncConfig.gistId}`, {
                headers: { 'Authorization': `token ${syncConfig.token}` }
            });
            const data = await res.json();
            
            if (data.files && data.files["scooter_trips.json"]) {
                const content = JSON.parse(data.files["scooter_trips.json"].content);
                if (content) {
                    setTrips(content);
                    localStorage.setItem('scooter_trips', JSON.stringify(content));
                }
            }

            if (data.files && data.files["scooter_sim_trips.json"]) {
                const simContent = JSON.parse(data.files["scooter_sim_trips.json"].content);
                if (simContent) {
                    setSimulatedTrips(simContent);
                    localStorage.setItem('scooter_sim_trips', JSON.stringify(simContent));
                }
            }
        } catch (e) {
            console.error("Erro ao carregar da nuvem:", e);
        }
    }, [syncConfig.token, syncConfig.gistId]);

    useEffect(() => {
        const local = JSON.parse(localStorage.getItem('scooter_trips') || '[]');
        setTrips(local);
        
        const localSim = JSON.parse(localStorage.getItem('scooter_sim_trips') || '[]');
        setSimulatedTrips(localSim);

        loadFromGithub();
    }, [loadFromGithub]);

    return {
        trips,
        simulatedTrips,
        syncConfig,
        setSyncConfig,
        saveTrips,
        saveSimulatedTrips,
        syncWithGithub
    };
};
