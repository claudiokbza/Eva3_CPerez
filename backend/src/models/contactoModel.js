const pool = require('../config/db');

exports.getContactosByClienteId = async (clienteId) => {
    const [rows] = await pool.execute('SELECT * FROM contactos WHERE cliente_id = ?', [clienteId]);
    return rows;
};

exports.addContacto = async (clienteId, nombre, numeroCuenta) => {
    // Validar si la cuenta del contacto existe como un cliente
    const [clienteCuentaExistente] = await pool.execute(
        'SELECT id FROM clientes WHERE numero_cuenta = ?',
        [numeroCuenta]
    );
    if (clienteCuentaExistente.length === 0) {
        throw new Error('El número de cuenta del contacto no corresponde a un cliente existente.');
    }

    // Validar si el contacto ya existe para este cliente
    const [existingContact] = await pool.execute(
        'SELECT id FROM contactos WHERE cliente_id = ? AND numero_cuenta = ?',
        [clienteId, numeroCuenta]
    );
    if (existingContact.length > 0) {
        throw new Error('Este número de cuenta ya está registrado como contacto para este cliente.');
    }

    const [result] = await pool.execute(
        'INSERT INTO contactos (cliente_id, nombre, numero_cuenta) VALUES (?, ?, ?)',
        [clienteId, nombre, numeroCuenta]
    );
    return result.insertId;
};

exports.deleteContacto = async (contactoId, clienteId) => { // Añadimos clienteId para mayor seguridad
    const [result] = await pool.execute(
        'DELETE FROM contactos WHERE id = ? AND cliente_id = ?',
        [contactoId, clienteId]
    );
    return result.affectedRows;
};

exports.getContactoByIdAndCliente = async (contactoId, clienteId) => {
    const [rows] = await pool.execute(
        'SELECT * FROM contactos WHERE id = ? AND cliente_id = ?',
        [contactoId, clienteId]
    );
    return rows[0];
};