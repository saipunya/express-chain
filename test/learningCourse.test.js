const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_SKIP_STARTUP_CHECK = '1';
const { youtubeId } = require('../services/learningCourseService');
const db = require('../config/db');

test.after(() => db.end());

const id = 'M7lc1UVf-VE';

test('learning lessons normalize the common YouTube video link formats', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&list=unused`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=shared`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://youtube.com/embed/${id}`
  ]) {
    assert.equal(youtubeId(url), id, url);
  }
});

test('learning lessons reject lookalike hosts, playlists without a video and invalid IDs', () => {
  for (const url of [
    `https://youtube.com.example.com/watch?v=${id}`,
    `https://www.youtube.com@example.com/watch?v=${id}`,
    `https://www.youtube.com:1234/watch?v=${id}`,
    'https://www.youtube.com/playlist?list=PL123',
    'https://youtu.be/short',
    `https://youtu.be/${id}/extra`,
    'javascript:alert(1)'
  ]) {
    assert.equal(youtubeId(url), null, url);
  }
});
