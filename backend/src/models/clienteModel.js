const pool = require('../config/db');

// Función de utilidad para generar el número de cuenta
const generateAccountNumber = (run) => {
    // Eliminar guiones y dígito verificador, tomar solo la parte numérica
    const numericRun = run.replace(/[^0-9]/g, '');
    // Puedes añadir lógica adicional para asegurar unicidad o formato deseado
    // Por ejemplo, padding con ceros al inicio o un prefijo
    return `ACC-${numericRun.substring(0, 8)}`; // Ejemplo: ACC-12345678
};

// Función para calcular línea de crédito y tarjeta de crédito
const calculateBenefits = (montoInicial) => {
    if (montoInicial <= 100000) {
        return { lineaCredito: 50000, tarjetaCredito: 80000 };
    } else if (montoInicial <= 500000) {
        return { lineaCredito: 250000, tarjetaCredito: 300000 };
    } else { // Más de $500.000
        return { lineaCredito: 500000, tarjetaCredito: 700000 };
    }
};

exports.createCliente = async (nombre, apellido, run, montoInicial) => {
    const numero_cuenta = generateAccountNumber(run);
    const { lineaCredito, tarjetaCredito } = calculateBenefits(montoInicial);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.execute(
            'INSERT INTO clientes (nombre, apellido, run, numero_cuenta, saldo, linea_credito, tarjeta_credito, deuda_linea_credito, deuda_tarjeta_credito) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)',
            [nombre, apellido, run, numero_cuenta, montoInicial, lineaCredito, tarjetaCredito]
        );

        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.getAllClientes = async () => {
    const [rows] = await pool.execute('SELECT * FROM clientes');
    // Asegurar que los campos numéricos sean siempre números, no null
    return rows.map(cliente => ({
        ...cliente,
    saldo: parseFloat(cliente.saldo || 0),
    linea_credito: parseFloat(cliente.linea_credito || 0),
    tarjeta_credito: parseFloat(cliente.tarjeta_credito || 0),
    deuda_linea_credito: parseFloat(cliente.deuda_linea_credito || 0),
    deuda_tarjeta_credito: parseFloat(cliente.deuda_tarjeta_credito || 0)
    }));
};

exports.getClienteById = async (id) => {
    console.log(`clienteModel: Querying DB for client ID: ${id}`); // Log el ID que se consulta
    const [rows] = await pool.execute('SELECT * FROM clientes WHERE id = ?', [id]);
    if (rows[0]) {
        const cliente = rows[0];
        console.log(`clienteModel: DB raw result for client ID ${id}:`, cliente); // Log el resultado crudo de la DB
        return {
            ...cliente,
            id: parseInt(cliente.id),
            saldo: parseFloat(cliente.saldo),
            linea_credito: parseFloat(cliente.linea_credito),
            tarjeta_credito: parseFloat(cliente.tarjeta_credito),
            deuda_linea_credito: parseFloat(cliente.deuda_linea_credito),
            deuda_tarjeta_credito: parseFloat(cliente.deuda_tarjeta_credito)
        };
    }
    console.log(`clienteModel: Client ID ${id} not found in DB.`);
    return null;
};

exports.getClienteByCuenta = async (numeroCuenta) => {
    const [rows] = await pool.execute('SELECT * FROM clientes WHERE numero_cuenta = ?', [numeroCuenta]);
    if (rows[0]) {
        const cliente = rows[0];
        return {
            ...cliente,
            id: parseInt(cliente.id), 
            saldo: parseFloat(cliente.saldo), 
            linea_credito: parseFloat(cliente.linea_credito), 
            tarjeta_credito: parseFloat(cliente.tarjeta_credito), 
            deuda_linea_credito: parseFloat(cliente.deuda_linea_credito), 
            deuda_tarjeta_credito: parseFloat(cliente.deuda_tarjeta_credito) 
        };
    }
    return null;
};


exports.updateCliente = async (id, nombre, apellido) => { // Solo permitimos modificar nombre y apellido por ahora
    const [result] = await pool.execute(
        'UPDATE clientes SET nombre = ?, apellido = ? WHERE id = ?',
        [nombre, apellido, id]
    );
    return result.affectedRows;
};

exports.deleteCliente = async (id) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Primero, verificar que no tenga deudas
        const [cliente] = await conn.execute('SELECT deuda_linea_credito, deuda_tarjeta_credito FROM clientes WHERE id = ?', [id]);
        if (!cliente || cliente.length === 0) {
            throw new Error('Cliente no encontrado.');
        }
        const { deuda_linea_credito, deuda_tarjeta_credito } = cliente[0];

        if (deuda_linea_credito > 0 || deuda_tarjeta_credito > 0) {
            throw new Error('No se puede eliminar el cliente porque tiene deudas activas.');
        }

        const [result] = await conn.execute('DELETE FROM clientes WHERE id = ?', [id]);

        await conn.commit();
        return result.affectedRows;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// Función para actualizar el saldo y deudas del cliente (interna, usada por transacciones)
exports.updateClienteBalance = async (clientId, newSaldo, newDeudaLineaCredito, newDeudaTarjetaCredito) => {
    const [result] = await pool.execute(
        'UPDATE clientes SET saldo = ?, deuda_linea_credito = ?, deuda_tarjeta_credito = ? WHERE id = ?',
        [newSaldo, newDeudaLineaCredito, newDeudaTarjetaCredito, clientId]
    );
    return result.affectedRows;
};

exports.updateClienteLineaCreditoActiva = async (clientId, isActive) => {
    const [result] = await pool.execute(
        'UPDATE clientes SET linea_credito_activa = ? WHERE id = ?',
        [isActive, clientId]
    );
    return result.affectedRows;
};
