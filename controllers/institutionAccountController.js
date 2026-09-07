const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const institutionAccountModel = require('../models/institutionAccountModel');
const {
  generateInstitutionPassword,
  encryptPassword,
  decryptPassword
} = require('../utils/institutionPassword');

function setMessage(req, type, text) {
  req.session.institutionAccountMessage = { type, text };
}

let generationInProgress = false;

function mapAccountForExport(row) {
  let password = '';
  if (row.password_encrypted) {
    try {
      password = decryptPassword(row.password_encrypted);
    } catch (error) {
      console.error(`Cannot decrypt institution credential for export ${row.c_code}:`, error.message);
    }
  }

  return {
    cCode: row.c_code || '',
    institutionName: row.c_name || '',
    institutionType: row.coop_group || '',
    promotionGroup: row.c_group || '',
    username: row.m_user || '',
    password,
    accountStatus: !row.m_id
      ? 'ยังไม่มีบัญชี'
      : password
        ? (row.m_status === 'active' ? 'พร้อมใช้งาน' : `สถานะ ${row.m_status || '-'}`)
        : 'บัญชีเดิม - ไม่ทราบรหัสผ่าน'
  };
}

function buildInstitutionAccountsWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CoopChain';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('บัญชีสถาบัน', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 }
  });
  worksheet.columns = [
    { header: 'ลำดับ', key: 'sequence', width: 10 },
    { header: 'รหัสสถาบัน (c-code)', key: 'cCode', width: 22 },
    { header: 'ชื่อสถาบัน', key: 'institutionName', width: 55 },
    { header: 'ประเภท', key: 'institutionType', width: 20 },
    { header: 'กลุ่มส่งเสริม', key: 'promotionGroup', width: 18 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Password', key: 'password', width: 20 },
    { header: 'สถานะบัญชี', key: 'accountStatus', width: 30 }
  ];

  const header = worksheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF198754' } };

  rows.map(mapAccountForExport).forEach((account, index) => {
    const row = worksheet.addRow({ sequence: index + 1, ...account });
    row.alignment = { vertical: 'middle' };
    row.getCell('sequence').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('cCode').numFmt = '@';
    row.getCell('username').numFmt = '@';
    row.getCell('password').numFmt = '@';
    if (!account.password) {
      row.getCell('password').value = 'กรุณาสุ่มรหัสใหม่';
      row.getCell('password').font = { color: { argb: 'FFB02A37' }, italic: true };
      row.getCell('accountStatus').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    }
  });

  worksheet.autoFilter = { from: 'A1', to: 'H1' };
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDE2E6' } },
        left: { style: 'thin', color: { argb: 'FFDDE2E6' } },
        bottom: { style: 'thin', color: { argb: 'FFDDE2E6' } },
        right: { style: 'thin', color: { argb: 'FFDDE2E6' } }
      };
      if (rowNumber > 1 && [3, 8].includes(cell.col)) {
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });
  });

  return workbook;
}

exports.buildInstitutionAccountsWorkbook = buildInstitutionAccountsWorkbook;

exports.index = async (req, res) => {
  try {
    const query = String(req.query.q || '').trim().toLocaleLowerCase('th-TH');
    const kind = String(req.query.kind || '').trim();
    const account = String(req.query.account || '').trim();
    const allRows = await institutionAccountModel.getInstitutionAccounts();
    let rows = allRows;

    rows = rows.map((row) => {
      let plainPassword = null;
      let credentialError = false;
      if (row.password_encrypted) {
        try {
          plainPassword = decryptPassword(row.password_encrypted);
        } catch (error) {
          credentialError = true;
          console.error(`Cannot decrypt institution credential for ${row.c_code}:`, error.message);
        }
      }
      return { ...row, plainPassword, credentialError };
    }).filter((row) => {
      if (query && !`${row.c_code} ${row.c_name} ${row.c_group}`.toLocaleLowerCase('th-TH').includes(query)) return false;
      if (kind && row.coop_group !== kind) return false;
      if (account === 'ready' && !(row.m_id && row.plainPassword)) return false;
      if (account === 'missing' && row.m_id) return false;
      if (account === 'unknown' && !(row.m_id && !row.plainPassword)) return false;
      return true;
    });

    const summary = {
      institutions: allRows.length,
      accounts: allRows.filter((row) => row.m_id).length,
      viewablePasswords: allRows.filter((row) => row.password_encrypted).length,
      missing: allRows.filter((row) => !row.m_id).length
    };
    const message = req.session.institutionAccountMessage || null;
    delete req.session.institutionAccountMessage;

    res.render('members/institutions', {
      title: 'บัญชีสหกรณ์และกลุ่มเกษตรกร',
      rows,
      summary,
      filters: { q: req.query.q || '', kind, account },
      message
    });
  } catch (error) {
    console.error('List institution accounts error:', error);
    res.status(500).render('error_page', { message: 'ไม่สามารถโหลดข้อมูลบัญชีสถาบันได้' });
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const rows = await institutionAccountModel.getInstitutionAccounts();
    const workbook = buildInstitutionAccountsWorkbook(rows);
    const dateStamp = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const filename = `institution-accounts-${dateStamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export institution accounts error:', error);
    res.status(500).render('error_page', { message: 'ไม่สามารถส่งออกข้อมูลบัญชีสถาบันได้' });
  }
};

exports.generateMissing = async (req, res) => {
  if (generationInProgress) {
    setMessage(req, 'warning', 'ระบบกำลังสร้างบัญชีอยู่ กรุณารอให้รายการปัจจุบันเสร็จสิ้น');
    return res.redirect('/member/institutions');
  }

  generationInProgress = true;
  try {
    const institutions = await institutionAccountModel.getActiveInstitutions();
    const result = { created: 0, skipped: 0, errors: [] };

    for (const institution of institutions) {
      const cCode = String(institution.c_code || '').trim();
      if (!cCode || cCode.length > 20) {
        result.skipped += 1;
        result.errors.push(`${cCode || '(ไม่มีรหัส)'}: รหัสยาวเกินกว่าที่ระบบบัญชีรองรับ`);
        continue;
      }

      try {
        const password = generateInstitutionPassword();
        const creation = await institutionAccountModel.createInstitutionAccount({
          institution: { ...institution, c_code: cCode },
          passwordHash: await bcrypt.hash(password, 10),
          encryptedPassword: encryptPassword(password),
          createdBy: req.session.user.id
        });
        if (creation.created) result.created += 1;
        else result.skipped += 1;
      } catch (error) {
        console.error(`Create institution account ${cCode} error:`, error);
        result.skipped += 1;
        result.errors.push(`${cCode}: สร้างไม่สำเร็จ`);
      }
    }

    const detail = result.errors.length ? ` (${result.errors.slice(0, 3).join(', ')})` : '';
    setMessage(req, 'success', `สร้างบัญชีใหม่ ${result.created} บัญชี ข้ามบัญชีที่มีอยู่/สร้างไม่ได้ ${result.skipped} บัญชี${detail}`);
    res.redirect('/member/institutions');
  } catch (error) {
    console.error('Generate institution accounts error:', error);
    setMessage(req, 'danger', 'สร้างบัญชีไม่สำเร็จ ระบบไม่ได้บันทึกข้อมูลบางส่วน');
    res.redirect('/member/institutions');
  } finally {
    generationInProgress = false;
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const institution = await institutionAccountModel.getInstitutionMemberById(req.params.id);
    if (!institution) {
      setMessage(req, 'danger', 'ไม่พบบัญชีสถาบันที่ต้องการเปลี่ยนรหัสผ่าน');
      return res.redirect('/member/institutions');
    }

    const password = generateInstitutionPassword();
    await institutionAccountModel.updatePassword({
      memberId: institution.m_id,
      cCode: institution.c_code,
      passwordHash: await bcrypt.hash(password, 10),
      encryptedPassword: encryptPassword(password),
      createdBy: req.session.user.id
    });
    setMessage(req, 'success', `สร้างรหัสผ่านใหม่ให้ ${institution.c_name} (${institution.c_code}) แล้ว`);
    return res.redirect('/member/institutions');
  } catch (error) {
    console.error('Reset institution password error:', error);
    setMessage(req, 'danger', 'ไม่สามารถสร้างรหัสผ่านใหม่ได้');
    return res.redirect('/member/institutions');
  }
};
