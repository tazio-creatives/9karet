import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeliveryEstimate } from '../../src/services/deliveryEstimateService.js';

// A UTC instant that's already past midnight IST (UTC+5:30) — 2026-09-09
// 20:00 UTC is 2026-09-10 01:30 in Asia/Kolkata. Used throughout to prove
// the calendar-day anchor is India's date, not the server's/UTC's.
const SEPT_9_2026_LATE_UTC = new Date('2026-09-09T20:00:00.000Z');

describe('calculateDeliveryEstimate', () => {
  test('9 September 2026 -> earliest 17 Sep, latest 19 Sep (default 8-10 days)', () => {
    const result = calculateDeliveryEstimate({ currentDate: new Date('2026-09-09T04:00:00.000Z') });
    assert.equal(result.minimumDays, 8);
    assert.equal(result.maximumDays, 10);
    assert.equal(result.earliestDate, '2026-09-17');
    assert.equal(result.latestDate, '2026-09-19');
    assert.equal(result.timezone, 'Asia/Kolkata');
  });

  test('month boundary: late September rolls latestDate into October', () => {
    const result = calculateDeliveryEstimate({ currentDate: new Date('2026-09-24T04:00:00.000Z') });
    assert.equal(result.earliestDate, '2026-10-02');
    assert.equal(result.latestDate, '2026-10-04');
  });

  test('year boundary: late December rolls into January of the next year', () => {
    const result = calculateDeliveryEstimate({ currentDate: new Date('2026-12-27T04:00:00.000Z') });
    assert.equal(result.earliestDate, '2027-01-04');
    assert.equal(result.latestDate, '2027-01-06');
  });

  test('leap year: correctly walks through February 29, 2028', () => {
    const result = calculateDeliveryEstimate({ currentDate: new Date('2028-02-24T04:00:00.000Z') });
    assert.equal(result.earliestDate, '2028-03-03');
    assert.equal(result.latestDate, '2028-03-05');
  });

  test('timezone: uses the Asia/Kolkata calendar date near UTC midnight, not the UTC date', () => {
    const result = calculateDeliveryEstimate({ currentDate: SEPT_9_2026_LATE_UTC });
    // India has already rolled over to Sept 10 at this UTC instant.
    assert.equal(result.earliestDate, '2026-09-18');
    assert.equal(result.latestDate, '2026-09-20');
  });

  test('invalid currentDate falls back to the real current date instead of throwing', () => {
    const result = calculateDeliveryEstimate({ currentDate: new Date('not-a-date') });
    assert.match(result.earliestDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(result.latestDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('invalid minimumDays/maximumDays/timezone fall back to safe defaults', () => {
    const result = calculateDeliveryEstimate({
      currentDate: new Date('2026-09-09T04:00:00.000Z'),
      minimumDays: -3,
      maximumDays: 'ten',
      timezone: 'Not/AZone',
    });
    assert.equal(result.minimumDays, 8);
    assert.equal(result.maximumDays, 10);
    assert.equal(result.timezone, 'Asia/Kolkata');
    assert.equal(result.earliestDate, '2026-09-17');
    assert.equal(result.latestDate, '2026-09-19');
  });

  test('maximumDays lower than minimumDays falls back rather than producing an inverted range', () => {
    const result = calculateDeliveryEstimate({
      currentDate: new Date('2026-09-09T04:00:00.000Z'),
      minimumDays: 8,
      maximumDays: 5,
    });
    assert.equal(result.minimumDays, 8);
    assert.equal(result.maximumDays, 10);
  });

  test('custom minimumDays/maximumDays are honored when valid', () => {
    const result = calculateDeliveryEstimate({
      currentDate: new Date('2026-09-09T04:00:00.000Z'),
      minimumDays: 2,
      maximumDays: 4,
    });
    assert.equal(result.earliestDate, '2026-09-11');
    assert.equal(result.latestDate, '2026-09-13');
  });

  test('same current date always yields the same result (product-list and product-detail consistency)', () => {
    const now = new Date('2026-09-09T10:00:00.000Z');
    const a = calculateDeliveryEstimate({ currentDate: now });
    const b = calculateDeliveryEstimate({ currentDate: now });
    assert.deepEqual(a, b);
  });
});
