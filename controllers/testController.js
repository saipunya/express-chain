const testUser = require('../models/userModel'); // นำเข้าโมเดล testUser
exports.test = async (req, res) => {
    try {
        const users = await testUser.test();
        res.json(users);           // ส่งข้อมูลกลับไปให้ client
        // console.log(users);        // log ดูใน console server
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('เกิดข้อผิดพลาดขณะดึงข้อมูลผู้ใช้');
    }
};