const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_DOCX_PATH = 'c:\\Users\\Admins\\Downloads\\รายชื่อนักเรียน มัธยม.2569.docx';
const UPLOADED_DOCX_PATH = path.join(process.cwd(), 'uploads', 'random-names', 'student-names.docx');

const fallbackSources = {
  staff: {
    label: 'พนักงาน',
    names: [
      'อารีย์',
      'กิตติ',
      'สุภาพร',
      'ณัฐวุฒิ',
      'ปรียา',
      'ศิริชัย',
      'มนัสนันท์',
      'ธนพล',
      'วราภรณ์',
      'ชลธิชา',
      'พงศกร',
      'นภัสสร'
    ]
  },
  empty: {
    label: 'ชุดว่าง',
    names: []
  }
};

let sourceCache = null;
let sourceCacheMtime = 0;

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getTextRuns(xml) {
  const runs = [];
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    runs.push(decodeXml(match[1]));
  }

  return runs;
}

function getParagraphText(xml) {
  return getTextRuns(xml).join('').replace(/\s+/g, ' ').trim();
}

function getCellText(xml) {
  const paragraphs = [];
  const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const paragraphText = getParagraphText(match[0]);
    if (paragraphText) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs.join(' ').replace(/\s+/g, ' ').trim();
}

function readZipEntry(buffer, entryName) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;

  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('Invalid DOCX zip: EOCD not found');
  }

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  let offset = centralDirectoryOffset;
  while (offset < centralDirectoryEnd) {
    if (buffer.readUInt32LE(offset) !== centralSignature) {
      throw new Error('Invalid DOCX zip: central directory not found');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8');

    if (fileName === entryName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== localSignature) {
        throw new Error('Invalid DOCX zip: local header not found');
      }

      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) {
        return compressed;
      }
      if (compressionMethod === 8) {
        return zlib.inflateRawSync(compressed);
      }

      throw new Error(`Unsupported DOCX compression method: ${compressionMethod}`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`DOCX entry not found: ${entryName}`);
}

function parseStudentSourcesFromDocumentXml(documentXml) {
  const sources = {};
  const blockRegex = /<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g;
  let currentGrade = null;
  let waitingForGradeNumber = false;
  let blockMatch;

  while ((blockMatch = blockRegex.exec(documentXml)) !== null) {
    const blockType = blockMatch[1];
    const blockXml = blockMatch[0];

    if (blockType === 'p') {
      const text = getParagraphText(blockXml);
      if (!text) continue;

      const inlineGrade = text.match(/มัธยมศึกษาปีที่\s*(\d+)/);
      if (inlineGrade) {
        currentGrade = inlineGrade[1];
        waitingForGradeNumber = false;
        if (!sources[`m${currentGrade}`]) {
          sources[`m${currentGrade}`] = {
            label: `มัธยมศึกษาปีที่ ${currentGrade}`,
            names: []
          };
        }
        continue;
      }

      if (text.includes('มัธยมศึกษาปีที่')) {
        waitingForGradeNumber = true;
        continue;
      }

      if (waitingForGradeNumber && /^\d+$/.test(text)) {
        currentGrade = text;
        waitingForGradeNumber = false;
        if (!sources[`m${currentGrade}`]) {
          sources[`m${currentGrade}`] = {
            label: `มัธยมศึกษาปีที่ ${currentGrade}`,
            names: []
          };
        }
      }
      continue;
    }

    if (!currentGrade) continue;

    const sourceKey = `m${currentGrade}`;
    if (!sources[sourceKey]) {
      sources[sourceKey] = {
        label: `มัธยมศึกษาปีที่ ${currentGrade}`,
        names: []
      };
    }

    const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(blockXml)) !== null) {
      const cells = [];
      const cellRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[0])) !== null) {
        cells.push(getCellText(cellMatch[0]));
      }

      if (cells.length < 3) continue;
      if (!/^\d+$/.test(cells[0]) || !/^\d+$/.test(cells[1])) continue;

      const name = cells.slice(2).join(' ').replace(/\s+/g, ' ').trim();
      if (name) {
        sources[sourceKey].names.push(name);
      }
    }
  }

  return sources;
}

function loadStudentSourcesFromDocx() {
  const docxPath = process.env.RANDOM_NAMES_DOCX_PATH ||
    (fs.existsSync(UPLOADED_DOCX_PATH) ? UPLOADED_DOCX_PATH : DEFAULT_DOCX_PATH);
  const absoluteDocxPath = path.resolve(docxPath);

  if (!fs.existsSync(absoluteDocxPath)) {
    return null;
  }

  const stat = fs.statSync(absoluteDocxPath);
  if (sourceCache && sourceCacheMtime === stat.mtimeMs) {
    return sourceCache;
  }

  const docxBuffer = fs.readFileSync(absoluteDocxPath);
  const documentXml = readZipEntry(docxBuffer, 'word/document.xml').toString('utf8');
  const parsedSources = parseStudentSourcesFromDocumentXml(documentXml);
  const populatedSources = Object.fromEntries(
    Object.entries(parsedSources).filter(([, source]) => source.names.length)
  );

  sourceCache = Object.keys(populatedSources).length ? populatedSources : null;
  sourceCacheMtime = stat.mtimeMs;
  return sourceCache;
}

function getPopulatedSourcesFromDocxBuffer(docxBuffer) {
  const documentXml = readZipEntry(docxBuffer, 'word/document.xml').toString('utf8');
  const parsedSources = parseStudentSourcesFromDocumentXml(documentXml);

  return Object.fromEntries(
    Object.entries(parsedSources).filter(([, source]) => source.names.length)
  );
}

function withAllSource(sources) {
  const sourceEntries = Object.entries(sources || {});
  const allNames = sourceEntries.flatMap(([, source]) => source.names || []);

  if (!allNames.length) {
    return sources;
  }

  return {
    all: {
      label: 'รวมทั้งหมด',
      names: allNames
    },
    ...sources
  };
}

function getSourcesObject() {
  try {
    return withAllSource(loadStudentSourcesFromDocx() || fallbackSources);
  } catch (error) {
    console.warn('randomNames DOCX import warning:', error && error.message);
    return withAllSource(fallbackSources);
  }
}

function getSources() {
  return Object.entries(getSourcesObject()).map(([value, source]) => ({
    value,
    label: `${source.label} (${source.names.length} คน)`
  }));
}

exports.index = (req, res) => {
  const sources = getSources();

  res.render('random-names/index', {
    title: 'ระบบสุ่มรายชื่อ',
    sources,
    defaultSource: sources[0] ? sources[0].value : 'staff',
    importStatus: req.query.imported === '1' ? 'นำเข้าไฟล์ Word สำเร็จ' : ''
  });
};

exports.names = (req, res) => {
  const sources = getSourcesObject();
  const sourceKeys = Object.keys(sources);
  const requestedSource = String(req.query.source || sourceKeys[0] || 'staff');
  const sourceKey = sources[requestedSource] ? requestedSource : sourceKeys[0];
  const source = sources[sourceKey] || { label: 'ไม่มีรายชื่อ', names: [] };

  res.json({
    ok: true,
    source: sourceKey,
    label: source.label,
    names: source.names
  });
};

exports.importPage = (req, res) => {
  const currentFileExists = fs.existsSync(UPLOADED_DOCX_PATH);

  res.render('random-names/import', {
    title: 'นำเข้ารายชื่อนักเรียน',
    error: '',
    currentFileExists
  });
};

exports.importDocx = (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).render('random-names/import', {
      title: 'นำเข้ารายชื่อนักเรียน',
      error: 'กรุณาเลือกไฟล์ Word (.docx)',
      currentFileExists: fs.existsSync(UPLOADED_DOCX_PATH)
    });
  }

  try {
    const populatedSources = getPopulatedSourcesFromDocxBuffer(req.file.buffer);

    if (!Object.keys(populatedSources).length) {
      return res.status(400).render('random-names/import', {
        title: 'นำเข้ารายชื่อนักเรียน',
        error: 'ไม่พบรายชื่อนักเรียนในไฟล์นี้ กรุณาตรวจสอบรูปแบบตารางรายชื่อ',
        currentFileExists: fs.existsSync(UPLOADED_DOCX_PATH)
      });
    }

    fs.mkdirSync(path.dirname(UPLOADED_DOCX_PATH), { recursive: true });
    fs.writeFileSync(UPLOADED_DOCX_PATH, req.file.buffer);
    sourceCache = populatedSources;
    sourceCacheMtime = fs.statSync(UPLOADED_DOCX_PATH).mtimeMs;

    res.redirect('/random-names?imported=1');
  } catch (error) {
    console.warn('randomNames DOCX upload warning:', error && error.message);
    res.status(400).render('random-names/import', {
      title: 'นำเข้ารายชื่อนักเรียน',
      error: 'อ่านไฟล์ Word ไม่สำเร็จ กรุณาใช้ไฟล์ .docx ที่ถูกต้อง',
      currentFileExists: fs.existsSync(UPLOADED_DOCX_PATH)
    });
  }
};
