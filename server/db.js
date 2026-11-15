import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

// Sử dụng Object format thay vì Array format để dễ map trường
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// Tự động fetch CLOB dưới dạng String thay vì stream
oracledb.fetchAsString = [oracledb.CLOB];

let pool;

export async function initDbPool() {
  try {
    const { DB_USER, DB_PASSWORD } = process.env;
    if (!DB_USER || !DB_PASSWORD) {
      throw new Error('DB_USER and DB_PASSWORD must be configured.');
    }

    pool = await oracledb.createPool({
      user: DB_USER,
      password: DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1',
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
    });
    console.log('✅ Oracle Database 23ai Connection Pool đã sẵn sàng!');
    return pool;
  } catch (err) {
    console.error('❌ Lỗi khởi tạo Oracle Pool:', err);
    throw err;
  }
}

export async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
      ...options,
    });
    return result;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Lỗi khi trả connection về pool:', err);
      }
    }
  }
}

export { oracledb };

