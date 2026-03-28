const db = require('../config/db');

const MAX_LIMIT = 5;
const APPROX_CANDIDATE_LIMIT = 300;

const SYNONYM_MAP = {
  'กู้เงิน': ['สินเชื่อ', 'เงินกู้', 'กู้ยืม'],
  สินเชื่อ: ['กู้เงิน', 'เงินกู้', 'กู้ยืม'],
  เงินกู้: ['กู้เงิน', 'สินเชื่อ', 'กู้ยืม'],
  ปันผล: ['เงินปันผล', 'เฉลี่ยคืน'],
  ลาออก: ['พ้นสมาชิก', 'สิ้นสมาชิกภาพ', 'ออกจากสมาชิก'],
  สมาชิก: ['ผู้ถือหุ้น', 'สมาชิกภาพ']
};

const APPROX_STOP_TERMS = new Set([
  'สหกรณ์',
  'กฎหมาย',
  'มาตรา',
  'วรรค',
  'กลุ่ม',
  'เกษตรกร',
  'พระราชบัญญัติ',
  'ทั้งหมด'
]);

const CORE_SEARCH_STOP_TERMS = new Set([
  'และ',
  'หรือ',
  'ของ',
  'ใน',
  'ที่',
  'ให้',
  'ได้',
  'ตาม',
  'กับ',
  'อย่างไร',
  'อะไร'
]);

function normalizeLimit(limit) {
  const n = Number(limit) || 5;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function buildKeywordPattern(message) {
  const trimmed = String(message || '').trim();
  return `%${trimmed}%`;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeForCompare(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

function parseLawNumberForSort(lawNumber) {
  const text = String(lawNumber || '');
  const match = text.match(/([0-9]+)(?:\s*\/\s*([0-9]+))?/);

  if (!match) {
    return {
      main: Number.MAX_SAFE_INTEGER,
      sub: Number.MAX_SAFE_INTEGER,
      hasSub: false,
      raw: normalizeForCompare(text)
    };
  }

  const main = Number(match[1]);
  const hasSub = match[2] !== undefined;
  const sub = hasSub ? Number(match[2]) : 0;

  return {
    main: Number.isFinite(main) ? main : Number.MAX_SAFE_INTEGER,
    sub: Number.isFinite(sub) ? sub : Number.MAX_SAFE_INTEGER,
    hasSub,
    raw: normalizeForCompare(text)
  };
}

function compareLawNumberAsc(a, b) {
  const parsedA = parseLawNumberForSort(a && a.law_number);
  const parsedB = parseLawNumberForSort(b && b.law_number);

  if (parsedA.main !== parsedB.main) return parsedA.main - parsedB.main;
  if (parsedA.hasSub !== parsedB.hasSub) return parsedA.hasSub ? 1 : -1;
  if (parsedA.sub !== parsedB.sub) return parsedA.sub - parsedB.sub;

  const partCompare = normalizeForCompare(a && a.law_part).localeCompare(normalizeForCompare(b && b.law_part), 'th');
  if (partCompare !== 0) return partCompare;

  return parsedA.raw.localeCompare(parsedB.raw, 'th');
}

function sortRowsByLawNumberAsc(rows) {
  return [...rows].sort(compareLawNumberAsc);
}

function normalizeTarget(target) {
  const safeTarget = String(target || '').trim().toLowerCase();
  if (safeTarget === 'group') return 'group';
  if (safeTarget === 'all') return 'all';
  return 'coop';
}

function filterRowsByTarget(rows, target) {
  const safeTarget = normalizeTarget(target);
  if (safeTarget === 'all') return rows;
  if (safeTarget === 'group') {
    return rows.filter((row) => row.source_table === 'tbl_glaws');
  }
  return rows.filter((row) => row.source_table === 'tbl_laws');
}

function tokenizeQuery(message) {
  return String(message || '')
    .split(/[\s,;|/\\()\[\]{}]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function buildTrigrams(term) {
  const normalized = normalizeForCompare(term).replace(/\s+/g, '');
  if (normalized.length < 5) return [];

  const grams = [];
  for (let i = 0; i <= normalized.length - 3; i += 1) {
    grams.push(normalized.slice(i, i + 3));
  }
  return grams;
}

function expandSynonyms(term) {
  const direct = SYNONYM_MAP[term] || [];
  const normalized = normalizeForCompare(term);
  if (direct.length) return direct;

  const foundKey = Object.keys(SYNONYM_MAP).find((k) => normalizeForCompare(k) === normalized);
  return foundKey ? SYNONYM_MAP[foundKey] : [];
}

function buildApproximateTerms(message) {
  const source = String(message || '').trim();
  if (!source) return [];

  const terms = new Set([source, ...tokenizeQuery(source)]);

  Array.from(terms).forEach((term) => {
    expandSynonyms(term).forEach((synonym) => terms.add(synonym));
  });

  Array.from(terms).forEach((term) => {
    buildTrigrams(term).forEach((gram) => terms.add(gram));
  });

  return Array.from(terms)
    .map((term) => normalizeForCompare(term))
    .filter((term) => term.length >= 3)
    .filter((term) => !APPROX_STOP_TERMS.has(term))
    .sort((a, b) => b.length - a.length)
    .slice(0, 16);
}

function buildCoreSearchTerms(message) {
  return tokenizeQuery(message)
    .map((term) => normalizeForCompare(term))
    .filter((term) => term.length >= 2)
    .filter((term) => !CORE_SEARCH_STOP_TERMS.has(term));
}

function extractLegalReference(message) {
  const text = String(message || '').trim();
  const match = text.match(/มาตรา\s*([0-9]+(?:\/[0-9]+)?)/i);
  const partMatch = text.match(/(วรรค(?:แรก|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ))/i);
  const articleNo = match ? match[1] : '';
  const articleLabel = articleNo ? `มาตรา ${articleNo}` : '';
  const lawPart = partMatch ? partMatch[1] : '';

  return {
    articleNo,
    articleLabel,
    lawPart,
    articleNoPattern: articleNo ? `%${articleNo}%` : '',
    articleLabelPattern: articleLabel ? `%${articleLabel}%` : ''
  };
}

function isStrictArticleMatch(lawNumber, legalRef) {
  if (!legalRef.articleNo && !legalRef.articleLabel) return false;

  const normalizedArticleNo = normalizeText(legalRef.articleNo);
  const lawText = String(lawNumber || '');
  const lawMatch = lawText.match(/มาตรา\s*([0-9]+(?:\/[0-9]+)?)/i);
  const lawArticleNo = normalizeText(lawMatch ? lawMatch[1] : '');

  if (!lawArticleNo || !normalizedArticleNo) return false;

  if (lawArticleNo === normalizedArticleNo) return true;

  return lawArticleNo.startsWith(`${normalizedArticleNo}/`);
}

function prioritizeStrictArticleRows(rows, legalRef, limit) {
  if (!rows.length) return rows;
  if (!legalRef.articleNo && !legalRef.articleLabel) return rows;

  const strictRows = rows.filter((row) => isStrictArticleMatch(row.law_number, legalRef));
  if (!strictRows.length) return rows;
  const orderedStrictRows = sortRowsByLawNumberAsc(strictRows);

  if (legalRef.lawPart) {
    const normalizedPart = normalizeText(legalRef.lawPart);
    const strictPartRows = orderedStrictRows.filter((row) => normalizeText(row.law_part).includes(normalizedPart));
    if (strictPartRows.length) {
      return strictPartRows.slice(0, normalizeLimit(limit));
    }
  }

  return orderedStrictRows.slice(0, normalizeLimit(limit));
}

function scoreCandidateRow(row, terms, legalRef) {
  const merged = normalizeForCompare([
    row.law_number,
    row.law_part,
    row.law_detail,
    row.law_search,
    row.law_comment
  ].join(' '));

  let score = 0;

  terms.forEach((term) => {
    if (!term || !merged.includes(term)) return;
    if (term.length >= 6) score += 4;
    else if (term.length >= 4) score += 2;
    else score += 0.5;
  });

  if (isStrictArticleMatch(row.law_number, legalRef)) {
    score += 50;
  }

  if (legalRef.lawPart && normalizeText(row.law_part).includes(normalizeText(legalRef.lawPart))) {
    score += 8;
  }

  return score;
}

function filterRowsByCoreFieldMatch(rows, message, legalRef) {
  if (!rows.length) return [];

  const terms = buildCoreSearchTerms(message);
  if (!terms.length) return rows;

  return rows.filter((row) => {
    if (isStrictArticleMatch(row.law_number, legalRef)) return true;

    const searchable = normalizeForCompare([row.law_detail, row.law_search].join(' '));
    if (!searchable) return false;

    const matchedTerms = terms.filter((term) => searchable.includes(term));
    const minimumMatches = terms.length >= 3 ? 2 : 1;

    return matchedTerms.length >= minimumMatches;
  });
}

function scoreCoreFieldSimilarity(row, terms, legalRef) {
  const searchable = normalizeForCompare([row.law_detail, row.law_search].join(' '));
  if (!searchable) return 0;

  let score = 0;
  terms.forEach((term) => {
    if (!term || !searchable.includes(term)) return;
    if (term.length >= 6) score += 4;
    else if (term.length >= 4) score += 2;
    else score += 0.5;
  });

  if (isStrictArticleMatch(row.law_number, legalRef)) {
    score += 30;
  }

  return score;
}

async function searchApproximate(message, limit, legalRef, target = 'coop') {
  const terms = buildApproximateTerms(message);
  if (!terms.length) return [];
  const hasExplicitLegalRef = Boolean(legalRef.articleNo || legalRef.articleLabel || legalRef.lawPart);
  const minScore = hasExplicitLegalRef ? 1 : 4;

  const lawConditions = terms.map(() => '(law_number LIKE ? OR law_part LIKE ? OR law_detail LIKE ? OR law_search LIKE ?)');
  const glawConditions = terms.map(() => '(glaw_number LIKE ? OR glaw_part LIKE ? OR glaw_detail LIKE ?)');

  const lawParams = terms.flatMap((term) => {
    const like = `%${term}%`;
    return [like, like, like, like];
  });

  const glawParams = terms.flatMap((term) => {
    const like = `%${term}%`;
    return [like, like, like];
  });

  const sql = `
    SELECT *
    FROM (
      SELECT
        'tbl_laws' AS source_table,
        law_number AS law_number,
        law_part AS law_part,
        law_detail AS law_detail,
        law_comment AS law_comment,
        law_search AS law_search,
        0 AS relevance_score
      FROM tbl_laws
      WHERE ${lawConditions.join(' OR ')}

      UNION ALL

      SELECT
        'tbl_glaws' AS source_table,
        glaw_number AS law_number,
        glaw_part AS law_part,
        glaw_detail AS law_detail,
        glaw_comment AS law_comment,
        '' AS law_search,
        0 AS relevance_score
      FROM tbl_glaws
      WHERE ${glawConditions.join(' OR ')}
    ) fuzzy_candidates
    LIMIT ?
  `;

  const [rows] = await db.query(sql, [...lawParams, ...glawParams, APPROX_CANDIDATE_LIMIT]);
  const scopedRows = filterRowsByTarget(rows, target);
  if (!scopedRows.length) return [];

  const ranked = scopedRows
    .map((row) => ({ row, score: scoreCandidateRow(row, terms, legalRef) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);

  if (!ranked.length) return [];

  if (legalRef.articleNo || legalRef.articleLabel) {
    const strict = prioritizeStrictArticleRows(ranked, legalRef, limit);
    if (strict.length) return strict;
  }

  return ranked.slice(0, normalizeLimit(limit));
}

async function searchWithFullText(message, limit, target = 'coop') {
  const keywordPattern = buildKeywordPattern(message);
  const legalRef = extractLegalReference(message);
  const [rows] = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          'tbl_laws' AS source_table,
          law_number AS law_number,
          law_part AS law_part,
          law_detail AS law_detail,
          law_comment AS law_comment,
          law_search AS law_search,
          (
            MATCH(law_detail, law_search) AGAINST (? IN NATURAL LANGUAGE MODE)
            + (CASE WHEN ? <> '' AND REPLACE(law_number, ' ', '') LIKE REPLACE(?, ' ', '') THEN 120 ELSE 0 END)
            + (CASE WHEN ? <> '' AND law_number LIKE ? THEN 90 ELSE 0 END)
            + (CASE WHEN law_number LIKE ? THEN 2 ELSE 0 END)
            + (CASE WHEN law_part LIKE ? THEN 0.5 ELSE 0 END)
            + (CASE WHEN law_detail LIKE ? THEN 0.5 ELSE 0 END)
            + (CASE WHEN law_search LIKE ? THEN 0.5 ELSE 0 END)
          ) AS relevance_score
        FROM tbl_laws
        WHERE
          MATCH(law_detail, law_search) AGAINST (? IN NATURAL LANGUAGE MODE)
          OR (? <> '' AND REPLACE(law_number, ' ', '') LIKE REPLACE(?, ' ', ''))
          OR (? <> '' AND law_number LIKE ?)
          OR law_number LIKE ?
          OR law_part LIKE ?
          OR law_detail LIKE ?
          OR law_search LIKE ?

        UNION ALL

        SELECT
          'tbl_glaws' AS source_table,
          glaw_number AS law_number,
          glaw_part AS law_part,
          glaw_detail AS law_detail,
          glaw_comment AS law_comment,
          '' AS law_search,
          (
            MATCH(glaw_detail) AGAINST (? IN NATURAL LANGUAGE MODE)
            + (CASE WHEN ? <> '' AND REPLACE(glaw_number, ' ', '') LIKE REPLACE(?, ' ', '') THEN 120 ELSE 0 END)
            + (CASE WHEN ? <> '' AND glaw_number LIKE ? THEN 90 ELSE 0 END)
            + (CASE WHEN glaw_number LIKE ? THEN 2 ELSE 0 END)
            + (CASE WHEN glaw_part LIKE ? THEN 0.5 ELSE 0 END)
            + (CASE WHEN glaw_detail LIKE ? THEN 0.5 ELSE 0 END)
          ) AS relevance_score
        FROM tbl_glaws
        WHERE
          MATCH(glaw_detail) AGAINST (? IN NATURAL LANGUAGE MODE)
          OR (? <> '' AND REPLACE(glaw_number, ' ', '') LIKE REPLACE(?, ' ', ''))
          OR (? <> '' AND glaw_number LIKE ?)
          OR glaw_number LIKE ?
          OR glaw_part LIKE ?
          OR glaw_detail LIKE ?
      ) AS ranked_laws
      ORDER BY relevance_score DESC, law_number ASC
      LIMIT ?
    `,
    [
      message,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      message,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      message,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      message,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      normalizeLimit(limit)
    ]
  );

  const scopedRows = filterRowsByTarget(rows, target);
  const prioritizedRows = prioritizeStrictArticleRows(scopedRows, legalRef, limit);
  return filterRowsByCoreFieldMatch(prioritizedRows, message, legalRef).slice(0, normalizeLimit(limit));
}

async function searchWithLikeOnly(message, limit, target = 'coop') {
  const keywordPattern = buildKeywordPattern(message);
  const legalRef = extractLegalReference(message);
  const [rows] = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          'tbl_laws' AS source_table,
          law_number AS law_number,
          law_part AS law_part,
          law_detail AS law_detail,
          law_comment AS law_comment,
          law_search AS law_search,
          (
            (CASE WHEN ? <> '' AND REPLACE(law_number, ' ', '') LIKE REPLACE(?, ' ', '') THEN 120 ELSE 0 END)
            + (CASE WHEN ? <> '' AND law_number LIKE ? THEN 90 ELSE 0 END)
            + (CASE WHEN law_number LIKE ? THEN 2 ELSE 0 END)
            + (CASE WHEN law_part LIKE ? THEN 1 ELSE 0 END)
            + (CASE WHEN law_detail LIKE ? THEN 1 ELSE 0 END)
            + (CASE WHEN law_search LIKE ? THEN 1 ELSE 0 END)
          ) AS relevance_score
        FROM tbl_laws
        WHERE
          (? <> '' AND REPLACE(law_number, ' ', '') LIKE REPLACE(?, ' ', ''))
          OR (? <> '' AND law_number LIKE ?)
          OR
          law_number LIKE ?
          OR law_part LIKE ?
          OR law_detail LIKE ?
          OR law_search LIKE ?

        UNION ALL

        SELECT
          'tbl_glaws' AS source_table,
          glaw_number AS law_number,
          glaw_part AS law_part,
          glaw_detail AS law_detail,
          glaw_comment AS law_comment,
          '' AS law_search,
          (
            (CASE WHEN ? <> '' AND REPLACE(glaw_number, ' ', '') LIKE REPLACE(?, ' ', '') THEN 120 ELSE 0 END)
            + (CASE WHEN ? <> '' AND glaw_number LIKE ? THEN 90 ELSE 0 END)
            + (CASE WHEN glaw_number LIKE ? THEN 2 ELSE 0 END)
            + (CASE WHEN glaw_part LIKE ? THEN 1 ELSE 0 END)
            + (CASE WHEN glaw_detail LIKE ? THEN 1 ELSE 0 END)
          ) AS relevance_score
        FROM tbl_glaws
        WHERE
          (? <> '' AND REPLACE(glaw_number, ' ', '') LIKE REPLACE(?, ' ', ''))
          OR (? <> '' AND glaw_number LIKE ?)
          OR
          glaw_number LIKE ?
          OR glaw_part LIKE ?
          OR glaw_detail LIKE ?
      ) AS ranked_laws
      ORDER BY relevance_score DESC, law_number ASC
      LIMIT ?
    `,
    [
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      legalRef.articleLabel,
      legalRef.articleLabel,
      legalRef.articleNo,
      legalRef.articleNoPattern,
      keywordPattern,
      keywordPattern,
      keywordPattern,
      normalizeLimit(limit)
    ]
  );

  const scopedRows = filterRowsByTarget(rows, target);
  const prioritizedRows = prioritizeStrictArticleRows(scopedRows, legalRef, limit);
  return filterRowsByCoreFieldMatch(prioritizedRows, message, legalRef).slice(0, normalizeLimit(limit));
}

exports.searchPenaltyLaws = async (limit = 20, target = 'coop') => {
  const safeTarget = normalizeTarget(target);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 80));

  const [rows] = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          'tbl_laws' AS source_table,
          law_number AS law_number,
          law_part AS law_part,
          law_detail AS law_detail,
          law_comment AS law_comment,
          law_search AS law_search,
          0 AS relevance_score
        FROM tbl_laws
        WHERE
          law_detail LIKE '%ต้องระวางโทษ%'
          OR law_detail LIKE '%ต้องระวาง%'
          OR law_comment LIKE '%ต้องระวางโทษ%'
          OR law_comment LIKE '%ต้องระวาง%'
          OR law_search LIKE '%บทลงโทษ%'
          OR law_search LIKE '%อัตราโทษ%'

        UNION ALL

        SELECT
          'tbl_glaws' AS source_table,
          glaw_number AS law_number,
          glaw_part AS law_part,
          glaw_detail AS law_detail,
          glaw_comment AS law_comment,
          '' AS law_search,
          0 AS relevance_score
        FROM tbl_glaws
        WHERE
          glaw_detail LIKE '%ต้องระวางโทษ%'
          OR glaw_detail LIKE '%ต้องระวาง%'
          OR glaw_comment LIKE '%ต้องระวางโทษ%'
          OR glaw_comment LIKE '%ต้องระวาง%'
      ) penalty_rows
      ORDER BY law_number ASC
      LIMIT ?
    `,
    [Number(safeLimit * 2)]
  );

  const scopedRows = filterRowsByTarget(rows, safeTarget);
  const orderedRows = sortRowsByLawNumberAsc(scopedRows);
  return orderedRows.slice(0, safeLimit);
};

exports.searchRelevantLaws = async (message, limit = 5, target = 'coop') => {
  const safeMessage = String(message || '').trim();
  if (!safeMessage) return [];
  const legalRef = extractLegalReference(safeMessage);
  const safeTarget = normalizeTarget(target);

  try {
    const rows = await searchWithFullText(safeMessage, limit, safeTarget);
    if (rows.length) return rows;
    return [];
  } catch (error) {
    const text = String(error && error.message ? error.message : '');
    const missingFullText =
      text.includes("Can't find FULLTEXT index") ||
      text.includes('does not support FULLTEXT indexes');

    if (!missingFullText) throw error;

    const rows = await searchWithLikeOnly(safeMessage, limit, safeTarget);
    if (rows.length) return rows;
    return [];
  }
};

exports.suggestNearbyLaws = async (message, limit = 3, target = 'coop') => {
  const safeMessage = String(message || '').trim();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 10));
  const safeTarget = normalizeTarget(target);
  if (!safeMessage) return [];

  const legalRef = extractLegalReference(safeMessage);
  const terms = buildApproximateTerms(safeMessage);
  if (!terms.length) return [];

  const lawConditions = terms.map(() => '(law_detail LIKE ? OR law_search LIKE ?)');
  const glawConditions = terms.map(() => '(glaw_detail LIKE ?)');

  const lawParams = terms.flatMap((term) => {
    const like = `%${term}%`;
    return [like, like];
  });

  const glawParams = terms.flatMap((term) => {
    const like = `%${term}%`;
    return [like];
  });

  const [rows] = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          'tbl_laws' AS source_table,
          law_number AS law_number,
          law_part AS law_part,
          law_detail AS law_detail,
          law_comment AS law_comment,
          law_search AS law_search,
          0 AS relevance_score
        FROM tbl_laws
        WHERE ${lawConditions.join(' OR ')}

        UNION ALL

        SELECT
          'tbl_glaws' AS source_table,
          glaw_number AS law_number,
          glaw_part AS law_part,
          glaw_detail AS law_detail,
          glaw_comment AS law_comment,
          '' AS law_search,
          0 AS relevance_score
        FROM tbl_glaws
        WHERE ${glawConditions.join(' OR ')}
      ) nearby_candidates
      LIMIT ?
    `,
    [...lawParams, ...glawParams, APPROX_CANDIDATE_LIMIT]
  );

  const scopedRows = filterRowsByTarget(rows, safeTarget);
  if (!scopedRows.length) return [];

  const ranked = scopedRows
    .map((row) => ({ row, score: scoreCoreFieldSimilarity(row, terms, legalRef) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);
  if (!ranked.length) return [];

  const unique = [];
  const seen = new Set();
  ranked.forEach((row) => {
    const key = `${row.source_table}|${normalizeText(row.law_number)}|${normalizeText(row.law_part)}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(row);
  });

  const orderedUnique = sortRowsByLawNumberAsc(unique);
  return orderedUnique.slice(0, safeLimit);
};
