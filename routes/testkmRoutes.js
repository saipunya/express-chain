const express = require('express');
const router = express.Router();
router.get('/', (req, res) => { // กำหนดรูปแบบของ URL ที่ต้องการ redirect ไปยัง URL ภายนอก
    const externalUrl = 'http://xn--12cmcj6bi9fihe1c4anf2gdc1d7e2r.com/testkm/index.php';
    res.redirect(externalUrl); // redirect ไปยัง URL ภายนอก
  });

module.exports = router;