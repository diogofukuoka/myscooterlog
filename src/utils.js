import { AUTONOMIA, VELOCIDADE, PRECO_KWH, KWH_CARGA_TOTAL, TEMPO_CARGA_POR_1_PORCENTO } from './constants.js';

export const getMobileHolidays = (year) => {
    const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
    
    const easter = new Date(year, month - 1, day);
    
    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    const format = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    return [
        format(addDays(easter, -47)), 
        format(addDays(easter, -2)),  
        format(easter),               
        format(addDays(easter, 60))   
    ];
};

export const checkIsHoliday = (dateString) => {
    const [year, month, day] = dateString.split('-');
    const formattedDate = `${day}/${month}`;
    const fixedHolidays = ['01/01', '21/04', '01/05', '07/09', '12/10', '02/11', '15/11', '25/12'];

    if (fixedHolidays.includes(formattedDate)) return true;
    return getMobileHolidays(parseInt(year, 10)).includes(formattedDate);
};

export const calculateMetrics = (distance) => {
    const dist = parseFloat(distance.toString().replace(',','.'));
    if (isNaN(dist)) return { time: '00:00', percent: '0,00', charge: '00:00', value: '0,00' };
    const hoursDecimal = dist / VELOCIDADE;
    const totalMinutes = Math.ceil(hoursDecimal * 60);
    const timeHours = Math.floor(totalMinutes / 60);
    const timeMinutes = totalMinutes % 60;
    const timeStr = `${String(timeHours).padStart(2, '0')}:${String(timeMinutes).padStart(2, '0')}`;
    const percentRaw = (dist / AUTONOMIA) * 100;
    const percentStr = percentRaw.toFixed(2).replace('.', ',');
    const chargeMinutesTotal = Math.ceil(percentRaw * TEMPO_CARGA_POR_1_PORCENTO);
    const chargeHours = Math.floor(chargeMinutesTotal / 60);
    const chargeMins = chargeMinutesTotal % 60;
    const chargeStr = `${String(chargeHours).padStart(2, '0')}:${String(chargeMins).padStart(2, '0')}`;
    const custoPorKm = (PRECO_KWH * KWH_CARGA_TOTAL) / AUTONOMIA;
    const valueRaw = dist * custoPorKm;
    const valueStr = valueRaw.toFixed(2).replace('.', ',');
    return { time: timeStr, percent: percentStr, charge: chargeStr, value: valueStr };
};
