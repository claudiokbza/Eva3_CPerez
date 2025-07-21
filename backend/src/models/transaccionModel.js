const pool = require('../config/db');
const clienteModel = require('./clienteModel'); // Para actualizar saldos de clientes
const moment = require('moment'); // Para manejar fechas de avances

exports.recordTransaccion = async (cliente_id, tipo, monto, detalle, cliente_destino_id = null, cuenta_destino = null, avance_tarjeta_id = null) => {
    console.log('RECORD TRANSACCION - Monto recibido:', monto, 'Tipo:', typeof monto); // LOG A
    const montoAsNumber = parseInt(monto);
    console.log('RECORD TRANSACCION - Monto parseado a entero (montoAsNumber):', montoAsNumber, 'Tipo:', typeof montoAsNumber); // LOG B
    if (isNaN(montoAsNumber)) {
        throw new Error('El monto de la transacción no es un número válido. (Error de conversión interna en recordTransaccion)');
    }
    const query = 'INSERT INTO transacciones (cliente_id, tipo, monto, detalle, cliente_destino_id, cuenta_destino, avance_tarjeta_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const params = [cliente_id, tipo, montoAsNumber, detalle, cliente_destino_id, cuenta_destino, avance_tarjeta_id];

    console.log('RECORD TRANSACCION - SQL Query:', query); // LOG C
    console.log('RECORD TRANSACCION - SQL Parameters:', params); // LOG D

    try {
        const [result] = await pool.execute(query, params);
        return result.insertId;
    } catch (error) {
        console.error('Error al ejecutar query de recordTransaccion:', error.message); // LOG E - Mensaje de error de la query
        console.error('Query Parameters al fallar:', params); // LOG F - Parámetros si la query falla
        console.error('Objeto de error completo en modelo:', error); // LOG G - Objeto de error completo
        throw error; // Vuelve a lanzar el error para que sea capturado por el controlador
    }
};

exports.getAllTransacciones = async (filters) => {
    let query = `
        SELECT
            t.id,
            t.cliente_id,
            c.nombre AS cliente_nombre,
            c.apellido AS cliente_apellido,
            t.tipo,
            t.monto,
            t.detalle,
            t.fecha,
            cd.nombre AS destino_nombre,
            cd.apellido AS destino_apellido,
            t.cuenta_destino
        FROM transacciones t
        JOIN clientes c ON t.cliente_id = c.id
        LEFT JOIN clientes cd ON t.cliente_destino_id = cd.id
        WHERE 1=1
    `;
    const params = [];

    if (filters.clienteId) {
        query += ' AND t.cliente_id = ?';
        params.push(filters.clienteId);
    }
    if (filters.tipo) {
        query += ' AND t.tipo = ?';
        params.push(filters.tipo.toUpperCase());
    }
    if (filters.fechaDesde) {
        query += ' AND t.fecha >= ?';
        params.push(filters.fechaDesde);
    }
    if (filters.fechaHasta) {
        query += ' AND t.fecha <= ?';
        params.push(filters.fechaHasta);
    }

    query += ' ORDER BY t.fecha DESC'; // Ordenar por fecha descendente

    const [rows] = await pool.execute(query, params);
    return rows;
};

// Funciones para Avances de Tarjeta
exports.createAvanceTarjeta = async (clienteId, montoOriginal, cuotasTotales, interesMensualPorcentaje) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const montoOriginalAsInteger = parseInt(montoOriginal);
        const [result] = await conn.execute(
        'INSERT INTO avances_tarjeta (cliente_id, monto_original, cuotas_totales, cuotas_pagadas, interes_mensual_porcentaje, monto_capital_pendiente, proxima_fecha_pago, estado) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
        [clienteId, montoOriginalAsInteger, cuotasTotales, interesMensualPorcentaje, montoOriginalAsInteger, moment().add(1, 'month').format('YYYY-MM-DD'), 'ACTIVO']
        );
        const avanceId = result.insertId;

        await conn.commit();
        return avanceId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.getAvanceById = async (avanceId) => {
    console.log('Modelo - getAvanceById: Recibido avanceId:', avanceId, 'Tipo:', typeof avanceId); // LOG A
    const query = 'SELECT * FROM avances_tarjeta WHERE id = ?';
    const params = [avanceId];
    console.log('Modelo - getAvanceById: SQL Query:', query); // LOG B
    console.log('Modelo - getAvanceById: SQL Parameters:', params); // LOG C
    try {
        const [rows] = await pool.execute(query, params);
        console.log('Modelo - getAvanceById: Resultado de la consulta SQL:', rows); // LOG D
        return rows[0]; // Devuelve la primera fila o undefined
    } catch (error) {
        console.error('Modelo - Error al ejecutar getAvanceById query:', error); // LOG E
        throw error; // Vuelve a lanzar el error
    }
    return rows[0];
    
};

exports.updateAvanceCuotas = async (avanceId, newCuotasPagadas, newMontoCapitalPendiente) => {
    const [result] = await pool.execute(
        'UPDATE avances_tarjeta SET cuotas_pagadas = ?, monto_capital_pendiente = ? WHERE id = ?',
        [newCuotasPagadas, newMontoCapitalPendiente, avanceId]
    );
    return result.affectedRows;
};

// **NUEVA FUNCIÓN REQUERIDA POR EL FRONTEND (PagoCuotaForm)**
exports.getAvancesPendientesByCliente = async (clienteId) => {
    const [rows] = await pool.execute(
        'SELECT * FROM avances_tarjeta WHERE cliente_id = ? AND estado = "ACTIVO" ORDER BY created_at ASC',
        [clienteId]
    );

    // Calcular cuota actual, monto abonado y adeudado para el frontend
    // Esta lógica puede ser compleja y es una simulación básica, el backend debe calcularla bien
    return rows.map(avance => {
        const interesMensual = avance.interes_mensual_porcentaje / 100;
        // Esto es una simplificación. Un cálculo real de cuota (sistema francés) es más complejo.
        // Aquí asumimos una cuota de capital fija + interés sobre el capital pendiente.
        const capitalPorCuota = avance.monto_original / avance.cuotas_totales;
        const interesPorCuota = avance.monto_capital_pendiente * interesMensual;
        const cuotaActual = capitalPorCuota + interesPorCuota; // Cuota total estimada

        const montoAbonadoCapital = avance.monto_original - avance.monto_capital_pendiente;
        const montoAdeudadoCapital = avance.monto_capital_pendiente;

        return {
        ...avance,
        cuotaActual: Math.round(cuotaActual),
        montoAbonadoCapital: Math.round(montoAbonadoCapital),
        montoAdeudadoCapital: Math.round(montoAdeudadoCapital)
        };
    });
};