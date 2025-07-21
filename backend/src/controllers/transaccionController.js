// src/controllers/transaccionController.js
const transaccionModel = require('../models/transaccionModel');
const clienteModel = require('../models/clienteModel');
const contactoModel = require('../models/contactoModel');
const pool = require('../config/db');
const moment = require('moment'); // Asegúrate de que moment esté importado si lo usas en otras partes

const getInterestRate = (cuotas) => {
    switch (cuotas) {
        case 12: return 0.015;
        case 24: return 0.03;
        case 36: return 0.04;
        case 48: return 0.05;
        default: return 0;
    }
};

exports.realizarTransferencia = async (req, res) => {
    const { clienteId, contactoId, monto } = req.body;

    console.log('--- INICIO TRANSFERENCIA ---');
    console.log('Monto a transferir (recibido del frontend):', monto); // LOG 1

    if (!clienteId || !contactoId || !monto || parseInt(monto) <= 0) {
        return res.status(400).json({ message: 'Datos incompletos o monto inválido.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const montoNum = parseInt(monto);
        console.log('Monto numérico parseado (montoNum):', montoNum); // LOG 2

        const clienteOrigen = await clienteModel.getClienteById(clienteId);
        if (!clienteOrigen) {
        throw new Error('Cliente origen no encontrado.');
        }

        console.log('Cliente Origen ANTES de los cálculos:'); // LOG 3
        console.log('  ID:', clienteOrigen.id);
        console.log('  Saldo:', clienteOrigen.saldo);
        console.log('  Línea de Crédito Total:', clienteOrigen.linea_credito);
        console.log('  Deuda Línea de Crédito:', clienteOrigen.deuda_linea_credito);
        console.log('  Línea de Crédito Activa:', clienteOrigen.linea_credito_activa);

        // 2. Obtener contacto destino para su número de cuenta
        const contactoDestino = await contactoModel.getContactoByIdAndCliente(contactoId, clienteId);
        if (!contactoDestino) {
        throw new Error('Contacto destino no encontrado o no pertenece a este cliente.');
        }

        // 3. Obtener cliente destino real (por el número de cuenta del contacto)
        const clienteDestino = await clienteModel.getClienteByCuenta(contactoDestino.numero_cuenta);
        if (!clienteDestino) {
            throw new Error('La cuenta del contacto destino no existe como cliente válido.');
        }
                console.log('Cliente Destino ANTES de la suma (obtenido de DB):', {
            id: clienteDestino.id,
            saldo: clienteDestino.saldo, // Verificar tipo y valor aquí
            linea_credito: clienteDestino.linea_credito,
            deuda_linea_credito: clienteDestino.deuda_linea_credito
        });
        // Calcular total disponible del cliente origen
        const totalDisponibleLinea = clienteOrigen.linea_credito - clienteOrigen.deuda_linea_credito;
        const totalDisponibleOrigen = clienteOrigen.saldo + totalDisponibleLinea;

        console.log('Cálculos intermedios:'); // LOG 4
        console.log('  Monto tomado del Saldo (inicialmente):', clienteOrigen.saldo);
        console.log('  Línea de Crédito DISPONIBLE (calculado):', totalDisponibleLinea);
        console.log('  Total Disponible (Saldo + Línea Disp.):', totalDisponibleOrigen);


        if (totalDisponibleOrigen < montoNum) {
            throw new Error('Saldo y/o línea de crédito insuficientes para la transferencia.');
        }

        let nuevoSaldoOrigen = clienteOrigen.saldo;
        let nuevaDeudaLineaCreditoOrigen = clienteOrigen.deuda_linea_credito;

        if (nuevoSaldoOrigen >= montoNum) {
        // Se descuenta solo del saldo
            nuevoSaldoOrigen -= montoNum;
            console.log('Lógica: Descontando SOLO del Saldo.'); // LOG 5
            console.log('  Nuevo Saldo Origen:', nuevoSaldoOrigen);
            console.log('  Nueva Deuda Línea de Crédito Origen (sin cambios):', nuevaDeudaLineaCreditoOrigen);
        } else {
            // Se descuenta del saldo y luego de la línea de crédito
            const montoTomadoDelSaldo = nuevoSaldoOrigen; // Se consume todo el saldo
            const montoTomadoDeLaLinea = montoNum - montoTomadoDelSaldo; // Lo que falta de la línea

            nuevoSaldoOrigen = 0; // Saldo se vuelve 0
            nuevaDeudaLineaCreditoOrigen += montoTomadoDeLaLinea; // Aumenta la deuda de línea de crédito

            console.log('Lógica: Descontando de Saldo Y Línea de Crédito.'); // LOG 6
            console.log('  Monto tomado del Saldo:', montoTomadoDelSaldo);
            console.log('  Monto tomado de la Línea de Crédito:', montoTomadoDeLaLinea);
            console.log('  Nuevo Saldo Origen:', nuevoSaldoOrigen);
            console.log('  Nueva Deuda Línea de Crédito Origen:', nuevaDeudaLineaCreditoOrigen);
        }

        // 4. Actualizar saldo y deuda de cliente origen
        await clienteModel.updateClienteBalance(
            clienteOrigen.id,
            nuevoSaldoOrigen,
            nuevaDeudaLineaCreditoOrigen,
            clienteOrigen.deuda_tarjeta_credito // Este campo no cambia en transferencias
        );
        console.log('Cliente Origen DESPUÉS de actualización en DB (valores pasados al modelo):'); // LOG 7
        console.log('  ID Cliente:', clienteOrigen.id);
        console.log('  Nuevo Saldo (a guardar):', nuevoSaldoOrigen);
        console.log('  Nueva Deuda Línea Crédito (a guardar):', nuevaDeudaLineaCreditoOrigen);
        console.log('  Deuda Tarjeta Crédito (sin cambios):', clienteOrigen.deuda_tarjeta_credito);


        // 5. Actualizar saldo de cliente destino
        console.log('Valores para cálculo de saldo destino:');
        console.log('  clienteDestino.saldo (antes de suma):', clienteDestino.saldo, 'Tipo:', typeof clienteDestino.saldo);
        console.log('  montoNum (monto a sumar):', montoNum, 'Tipo:', typeof montoNum);

        const nuevoSaldoDestino = clienteDestino.saldo + montoNum; // <-- La suma crítica
        console.log('  Resultado nuevoSaldoDestino:', nuevoSaldoDestino, 'Tipo:', typeof nuevoSaldoDestino);

        await clienteModel.updateClienteBalance(
            clienteDestino.id,
            nuevoSaldoDestino,
            clienteDestino.deuda_linea_credito, // No cambia la deuda de línea del destino
            clienteDestino.deuda_tarjeta_credito // No cambia la deuda de tarjeta del destino
        );
        console.log('Cliente Destino DESPUÉS de actualización en DB:'); // LOG 8
        console.log('  ID Cliente Destino:', clienteDestino.id);
        console.log('  Nuevo Saldo Destino (a guardar):', nuevoSaldoDestino);


        // 6. Registrar transacción
        const detalle = `Transferencia a ${contactoDestino.nombre} (Cuenta: ${contactoDestino.numero_cuenta})`;
        await transaccionModel.recordTransaccion(
            clienteOrigen.id,
            'TRANSFERENCIA',
            montoNum,
            detalle,
            clienteDestino.id,
            contactoDestino.numero_cuenta
        );
        console.log('Transacción registrada en historial.'); // LOG 9


        await conn.commit(); // Confirmar todos los cambios en la transacción de la DB
        res.status(200).json({ message: 'Transferencia realizada exitosamente.' });
        console.log('--- FIN TRANSFERENCIA EXITOSA ---');
    } catch (error) {
        await conn.rollback(); // Deshacer cambios si algo falla
        console.error('--- ERROR EN TRANSFERENCIA ---'); // LOG 10
        console.error('Mensaje de error:', error.message);
        console.error('Stack trace completo:', error.stack); // Para detalles de dónde ocurrió el error en el código
        res.status(400).json({ message: error.message || 'Error interno del servidor al realizar transferencia.' });
    } finally {
        conn.release(); // Liberar la conexión a la base de datos
    }
};

exports.realizarDeposito = async (req, res) => {
    const { clienteId, monto } = req.body;

    if (!clienteId || !monto || parseInt(monto) <= 0) {
        return res.status(400).json({ message: 'Datos incompletos o monto inválido.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const montoNum = parseInt(monto);
        const cliente = await clienteModel.getClienteById(clienteId);

        if (!cliente) {
            throw new Error('Cliente no encontrado.');
        }

        let nuevoSaldo = cliente.saldo;
        let nuevaDeudaLineaCredito = cliente.deuda_linea_credito;

        if (nuevaDeudaLineaCredito > 0) {
            // Si hay deuda en línea de crédito, el depósito se destina primero a saldarla
            const montoParaSaldarDeuda = Math.min(montoNum, nuevaDeudaLineaCredito);
            nuevaDeudaLineaCredito -= montoParaSaldarDeuda;
            const excedente = montoNum - montoParaSaldarDeuda;
            if (excedente > 0) {
                nuevoSaldo += excedente;
            }
        } else {
            // Si no hay deuda, el depósito se agrega directamente al saldo
            nuevoSaldo += montoNum;
        }

        // Actualizar saldo y deuda
        await clienteModel.updateClienteBalance(cliente.id, nuevoSaldo, nuevaDeudaLineaCredito, cliente.deuda_tarjeta_credito);

        // Registrar transacción
        const detalle = `Depósito en cuenta.`;
        await transaccionModel.recordTransaccion(cliente.id, 'DEPOSITO', montoNum, detalle);

        await conn.commit();
        res.status(200).json({ message: 'Depósito realizado exitosamente.' });
    } catch (error) {
        await conn.rollback();
        console.error('Error al realizar depósito:', error);
        res.status(400).json({ message: error.message || 'Error interno del servidor al realizar depósito.' });
    } finally {
        conn.release();
    }
};

exports.realizarAvanceTarjeta = async (req, res) => {
    const { clienteId, monto, cuotas } = req.body;

    if (!clienteId || !monto || parseInt(monto) <= 0 || !cuotas) {
        return res.status(400).json({ message: 'Datos incompletos o monto/cuotas inválidos.' });
    }

    const cuotasInt = parseInt(cuotas);
    const montoNum = parseInt(monto); // Aquí ya es parseInt, lo que está bien
    const interesPorcentaje = getInterestRate(cuotasInt);

    if (interesPorcentaje === 0) {
        return res.status(400).json({ message: 'Número de cuotas no válido.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const cliente = await clienteModel.getClienteById(clienteId);
        if (!cliente) {
            throw new Error('Cliente no encontrado.');
        }

        const tarjetaCreditoTotal = parseFloat(cliente.tarjeta_credito || 0);
        const deudaTarjetaCreditoActual = parseFloat(cliente.deuda_tarjeta_credito || 0);
        const tarjetaCreditoDisponibleActual = tarjetaCreditoTotal - deudaTarjetaCreditoActual;

        console.log('Tarjeta Crédito TOTAL (desde DB):', tarjetaCreditoTotal);
        console.log('Deuda Tarjeta Crédito ACTUAL (desde DB):', deudaTarjetaCreditoActual);
        console.log('Tarjeta Crédito DISPONIBLE (calculado en backend):', tarjetaCreditoDisponibleActual);
        console.log('Monto solicitado (montoNum):', montoNum);

        // --- ¡MODIFICACIÓN CLAVE DE DEBUGGING AQUÍ! ---
        const isExceedingLimit = montoNum > tarjetaCreditoDisponibleActual;
        console.log(`DEBUG: COMPARACION: ${montoNum} > ${tarjetaCreditoDisponibleActual} => ${isExceedingLimit}`); // Este log nos dirá si es TRUE o FALSE

        if (isExceedingLimit) { // La condición usa la variable booleana para mayor claridad
            console.log('¡Validación fallida! Monto solicitado es mayor que lo disponible.'); // Este log DEBERÍA aparecer
            throw new Error('Monto de avance excede el límite disponible de la tarjeta de crédito.'); // Este error DEBERÍA lanzarse
        }

        // Actualizar deuda de tarjeta de crédito (se usa el límite)
        const nuevaDeudaTarjetaCredito = cliente.deuda_tarjeta_credito + montoNum;
        const nuevoSaldo = cliente.saldo + montoNum; // El monto solicitado se abona al saldo en cuenta

        await clienteModel.updateClienteBalance(cliente.id, nuevoSaldo, cliente.deuda_linea_credito, nuevaDeudaTarjetaCredito);

        // Registrar el avance en la tabla de avances_tarjeta
        const avanceId = await transaccionModel.createAvanceTarjeta(
            cliente.id,
            montoNum,
            cuotasInt,
            interesPorcentaje * 100 // Almacenar como porcentaje (ej: 1.5 en vez de 0.015)
        );

        // Registrar transacción en historial
        const detalle = `Avance con tarjeta de crédito por ${montoNum.toLocaleString('es-CL')} en ${cuotasInt} cuotas.`;
        await transaccionModel.recordTransaccion(cliente.id, 'AVANCE_TARJETA', montoNum, detalle, null, null, avanceId);

        await conn.commit();
        res.status(200).json({ message: 'Avance de tarjeta realizado exitosamente.', avanceId: avanceId });
        console.log('--- AVANCE CON TARJETA EXITOSO (Backend) ---'); // Log si tiene éxito
    } catch (error) {
    await conn.rollback();
        console.error('--- ERROR AL REALIZAR AVANCE CON TARJETA (Backend) ---');
        console.error('Mensaje de error:', error.message); // Este es CLAVE
        console.error('Stack trace:', error.stack);
        res.status(400).json({ message: error.message || 'Error interno del servidor al realizar avance de tarjeta.' });
    } finally {
        console.log('Finalizando intento de avance de tarjeta.');
        conn.release();
    }
};

exports.pagarCuotaAvance = async (req, res) => {
    const { clienteId, avanceId } = req.body;

    if (!clienteId || !avanceId) {
        return res.status(400).json({ message: 'Cliente y avance son requeridos.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const cliente = await clienteModel.getClienteById(clienteId);
        const avance = await transaccionModel.getAvanceById(avanceId);

        if (!cliente) {
            throw new Error('Cliente no encontrado.');
        }
        if (!avance || avance.cliente_id !== parseInt(clienteId) || avance.estado !== 'ACTIVO') {
            throw new Error('Avance no encontrado, no pertenece al cliente o no está activo.');
        }

        // Calcular la cuota (capital + interés sobre capital pendiente)
        const interesMensual = parseFloat(avance.interes_mensual_porcentaje) / 100; // Asegurar parseFloat
        const capitalPorCuota = parseFloat(avance.monto_original) / parseFloat(avance.cuotas_totales); // Asegurar parseFloat
        const interesActual = parseFloat(avance.monto_capital_pendiente) * interesMensual; // Asegurar parseFloat

        let montoCuotaTotal = capitalPorCuota + interesActual;
        montoCuotaTotal = Math.round(montoCuotaTotal); // Reasignación

        let montoPendienteDePago = montoCuotaTotal;
        let nuevoSaldo = parseFloat(cliente.saldo);
        let nuevaDeudaLineaCredito = parseFloat(cliente.deuda_linea_credito);

        if (nuevoSaldo >= montoPendienteDePago) {
            nuevoSaldo -= montoPendienteDePago;
            montoPendienteDePago = 0;
        } else {
            montoPendienteDePago -= nuevoSaldo; // Lo que falta después de usar todo el saldo
            nuevoSaldo = 0;

            if (cliente.linea_credito_activa) {
                const lineaDisponible = parseFloat(cliente.linea_credito) - nuevaDeudaLineaCredito; // Asegurar parseFloat
                if (lineaDisponible >= montoPendienteDePago) {
                    // --- ESTA ES LA LÍNEA 299:25 (o muy cerca) ---
                    nuevaDeudaLineaCredito += montoPendienteDePago; // <--- ¡Esta es la reasignación!
                    montoPendienteDePago = 0;
                } else {
                    throw new Error('Saldo y línea de crédito insuficientes para pagar la cuota.');
                }
            } else {
                throw new Error('Saldo insuficiente para pagar la cuota y línea de crédito inactiva.');
            }
        }

        // 2. Actualizar saldo y deudas del cliente
        await clienteModel.updateClienteBalance(cliente.id, nuevoSaldo, nuevaDeudaLineaCredito, parseFloat(cliente.deuda_tarjeta_credito)); // Asegurar parseFloat

        // 3. Actualizar el avance: aumentar cuotas pagadas, reducir capital pendiente
        const newCuotasPagadas = avance.cuotas_pagadas + 1;
        const newMontoCapitalPendiente = Math.max(0, parseFloat(avance.monto_capital_pendiente) - capitalPorCuota); // Asegurar parseFloat

        await transaccionModel.updateAvanceCuotas(avance.id, newCuotasPagadas, newMontoCapitalPendiente);

        // 4. Actualizar estado del avance si está pagado
        if (newCuotasPagadas >= avance.cuotas_totales) {
            const clienteActualizado = await clienteModel.getClienteById(clienteId);
            const deudaFinalTarjeta = Math.max(0, parseFloat(clienteActualizado.deuda_tarjeta_credito) - parseFloat(avance.monto_original)); // Asegurar parseFloat
            await clienteModel.updateClienteBalance(cliente.id, parseFloat(clienteActualizado.saldo), parseFloat(clienteActualizado.deuda_linea_credito), deudaFinalTarjeta); // Asegurar parseFloat
            await pool.execute('UPDATE avances_tarjeta SET estado = "PAGADO" WHERE id = ?', [avance.id]);
        }

        // 5. Registrar transacción
        const detalle = `Pago de cuota ${newCuotasPagadas}/${avance.cuotas_totales} para avance por $${parseFloat(avance.monto_original).toLocaleString('es-CL')}. Capital: $${capitalPorCuota.toLocaleString('es-CL')}, Interés: $${interesActual.toLocaleString('es-CL')}.`;
        await transaccionModel.recordTransaccion(cliente.id, 'PAGO_CUOTA', montoCuotaTotal, detalle, null, null, avance.id);

        await conn.commit();
        res.status(200).json({ message: 'Cuota pagada exitosamente.' });
    } catch (error) {
        await conn.rollback();
        console.error('--- ERROR AL PAGAR CUOTA (Backend) ---');
        console.error('Mensaje de error:', error.message);
        console.error('Stack trace completo:', error.stack);
        res.status(400).json({ message: error.message || 'Error interno del servidor al pagar cuota.' });
    } finally {
        conn.release(); // Importante: Liberar la conexión a la base de datos
    }
};

exports.getTransacciones = async (req, res) => {
    const filters = req.query; // Los filtros vienen como query parameters
    try {
        const transacciones = await transaccionModel.getAllTransacciones(filters);
        res.status(200).json(transacciones);
    } catch (error) {
        console.error('Error al obtener historial de transacciones:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.getAvancesPendientesByCliente = async (req, res) => {
    const { clienteId } = req.params;
    try {
        const avances = await transaccionModel.getAvancesPendientesByCliente(clienteId);
        res.status(200).json(avances);
    } catch (error) {
        console.error('Error al obtener avances pendientes:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.getAvanceById = async (req, res) => {
    const { id } = req.params; // Captura el ID de los parámetros de la ruta
    console.log('Backend - getAvanceById: Recibido ID del avance:', id, 'Tipo:', typeof id);
    try {
        const avance = await transaccionModel.getAvanceById(id); // Llama a la función del modelo
        if (!avance) {
            console.log('Backend - getAvanceById: Avance no encontrado para ID:', id);
            return res.status(404).json({ message: 'Avance no encontrado.' });
        }
        console.log('Backend - getAvanceById: Avance encontrado:', avance);
        res.status(200).json(avance); // Devuelve el avance encontrado
    } catch (error) {
        console.error('Backend - Error en getAvanceById:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener avance.' });
    }
};
// **LÓGICA PARA PENALIZACIÓN DE LÍNEA DE CRÉDITO**
// Esto es una tarea programada, no una ruta de API que el frontend llame directamente.
// Podrías ejecutarla con un cron job o un setInterval en el server.js (para pruebas).
exports.checkAndPenalizeInactiveCreditLines = async () => {
    console.log('Ejecutando chequeo de penalización de línea de crédito...');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Obtener todos los avances de tarjeta ACTIVO
        const [avances] = await conn.execute(
            'SELECT id, cliente_id, cuotas_totales, cuotas_pagadas, proxima_fecha_pago FROM avances_tarjeta WHERE estado = "ACTIVO"'
        );

        const penalizacionesAplicadas = [];

        for (const avance of avances) {
            const today = moment();
            const nextPaymentDate = moment(avance.proxima_fecha_pago);

            // Si la próxima fecha de pago ya pasó y lleva 3 ciclos sin pagar
            // Aquí necesitas una lógica más compleja:
            // - Registrar la última fecha de pago (o si no ha pagado desde el inicio)
            // - Contar ciclos de mora (ej. si proxima_fecha_pago + 3 meses < today)
            // Por simplicidad, aquí usaremos un contador ficticio de "ciclos de mora" o una fecha límite.
            // NECESITARÍAS UN CAMPO ADICIONAL EN `avances_tarjeta` COMO `dias_mora` o `cuotas_atrasadas`

            // --- Lógica Simplificada para demostración: Si han pasado más de 3 meses de la próxima fecha de pago ---
            if (today.diff(nextPaymentDate, 'months') >= 3 && avance.cuotas_pagadas < avance.cuotas_totales) {
                // Si el avance tiene 3 meses o más de retraso en la próxima fecha de pago
                const cliente = await clienteModel.getClienteById(avance.cliente_id);
                if (cliente && cliente.linea_credito_activa) {
                    console.log(`Penalizando al cliente ${cliente.id} por avance ${avance.id}`);
                    await clienteModel.updateClienteLineaCreditoActiva(cliente.id, false); // Desactivar línea de crédito
                    await pool.execute('UPDATE avances_tarjeta SET estado = "ELIMINADO_LC" WHERE id = ?', [avance.id]); // Marcar el avance como penalizado

                    // Registrar transacción de penalización
                    await transaccionModel.recordTransaccion(
                        cliente.id,
                        'PENALIZACION_LC',
                        0, // Monto 0 para este tipo de transacción
                        `Línea de crédito desactivada por mora de 3 ciclos en avance #${avance.id}.`
                    );
                    penalizacionesAplicadas.push({ clienteId: cliente.id, avanceId: avance.id });
                }
            }
        }

        await conn.commit();
        if (penalizacionesAplicadas.length > 0) {
            console.log('Penalizaciones de línea de crédito aplicadas:', penalizacionesAplicadas);
        } else {
            console.log('No se encontraron líneas de crédito para penalizar.');
        }
    } catch (error) {
        await conn.rollback();
        console.error('Error durante el chequeo de penalización de línea de crédito:', error);
    } finally {
        conn.release();
    }
};