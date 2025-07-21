const mysql = require('mysql2/promise');
require('dotenv').config(); // Cargar variables de entorno

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(connection => {
    console.log('Conectado a la base de datos MySQL');
    connection.release(); // Liberar la conexión inmediatamente
    })
    .catch(err => {
        console.error('Error al conectar a la base de datos:', err.message);
        process.exit(1); // Salir de la aplicación si no se puede conectar a la DB
    });

module.exports = pool;