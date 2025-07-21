// src/utils/runValidator.js

// Función para validar RUN chileno (ejemplo robusto)
// Fuente: https://gist.github.com/rotvulpix/6712396
exports.validateRun = (run) => {
    if (!/^[0-9]+-[0-9kK]$/.test(run)) {
        return false;
    }

    const cleanRun = run.replace(/\./g, '').replace('-', '');
    let cuerpo = cleanRun.slice(0, -1);
    let dv = cleanRun.slice(-1).toUpperCase();

    if (cuerpo.length < 7) { // RUNs válidos tienen al menos 7 dígitos en el cuerpo
        return false;
    }

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo[i]) * multiplo;
        multiplo = (multiplo < 7) ? multiplo + 1 : 2;
    }

    const dvEsperado = 11 - (suma % 11);
    const dvFinal = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'K' : String(dvEsperado);

    return dv === dvFinal;
};