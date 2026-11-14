import { initDbPool, executeQuery } from './db.js';

async function testConnection() {
  console.log('--- ĐANG KIỂM TRA KẾT NỐI ORACLE DATABASE 23ai ---');
  try {
    await initDbPool();

    // 1. Kiểm tra phiên bản DB
    const versionRes = await executeQuery('SELECT BANNER_FULL FROM V$VERSION WHERE ROWNUM = 1');
    console.log('Thông tin phiên bản:', versionRes.rows[0]?.BANNER_FULL);

    // 2. Kiểm tra thời gian hệ thống
    const timeRes = await executeQuery('SELECT SYSTIMESTAMP AS SERVER_TIME FROM DUAL');
    console.log('Thời gian máy chủ DB:', timeRes.rows[0]?.SERVER_TIME);

    // 3. Danh sách các bảng trong schema hiện tại
    const tablesRes = await executeQuery('SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME');
    console.log(`\nTìm thấy ${tablesRes.rows.length} bảng trong schema:`);

    // 4. Kiểm tra số lượng bản ghi trong từng bảng
    for (const row of tablesRes.rows) {
      const tableName = row.TABLE_NAME;
      try {
        const countRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM "${tableName}"`);
        console.log(` - ${tableName.padEnd(25)}: ${countRes.rows[0]?.CNT} dòng`);
      } catch (err) {
        console.log(` - ${tableName.padEnd(25)}: [Lỗi đếm: ${err.message}]`);
      }
    }

    console.log('\n Kết nối Database thành công và hoạt động bình thường!');
    process.exit(0);
  } catch (err) {
    console.error('\n Thất bại khi kết nối Database:', err.message);
    if (err.offset) console.error('Offset:', err.offset);
    process.exit(1);
  }
}

testConnection();
