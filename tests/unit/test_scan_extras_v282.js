// v282 scan-extras: double-scan lookup, roll suggestions, difficulty + key-doubt, ranking, key per set.
const assert = require('assert'), path = require('path');
const { pure: P } = require(path.join(__dirname, '..', '..', 'scan-extras.js'));
const ex = { questions: 4, answerKey: ['A', 'B', 'C', 'D'], answerKeys: { B: ['D', 'C', 'B', 'A'] } };
// keyFor: set B uses its own key, unknown set falls back to answerKey
assert.deepStrictEqual(P.keyFor(ex, 'B'), ['D', 'C', 'B', 'A']);
assert.deepStrictEqual(P.keyFor(ex, null), ['A', 'B', 'C', 'D']);
assert.deepStrictEqual(P.keyFor(ex, 'C'), ['A', 'B', 'C', 'D']);
// findPrevious: best marks, ignores unreadable rolls
const res = [{ roll: '65', marks: 10 }, { roll: '65', marks: 22 }, { roll: '6?', marks: 5 }];
assert.strictEqual(P.findPrevious(res, '65').marks, 22);
assert.strictEqual(P.findPrevious(res, '6?'), null);
assert.strictEqual(P.findPrevious(res, '70'), null);
// bestPerRoll keeps one per roll and every unreadable one
assert.strictEqual(P.bestPerRoll(res).length, 2);
// ranked: ties share a rank
const rk = P.ranked([{ roll: '1', marks: 9 }, { roll: '2', marks: 9 }, { roll: '3', marks: 4 }]);
assert.deepStrictEqual(rk.map(r => r._rank), [1, 1, 3]);
// suggestRolls
const roster = [{ roll: '61', name: 'A' }, { roll: '65', name: 'B' }, { roll: '75', name: 'C' }, { roll: '650', name: 'D' }];
assert.deepStrictEqual(P.suggestRolls('6?', roster, []).map(s => s.roll), ['61', '65']);
assert.deepStrictEqual(P.suggestRolls('6?', roster, ['61']).map(s => s.roll), ['65', '61']);          // scanned ones go last
assert.deepStrictEqual(P.suggestRolls('85', roster, []).map(s => s.roll), ['65', '75']);              // 1 digit off
assert.deepStrictEqual(P.suggestRolls('65', roster, []), []);                                          // valid roll -> no suggestion
assert.deepStrictEqual(P.suggestRolls('6?', [], []), []);
// difficulty
const rows = [];
for (let i = 0; i < 10; i++) rows.push({ roll: String(i + 1), setLetter: null, answers: ['A', i < 8 ? 'C' : 'B', null, 'D'] });
const d = P.difficulty(ex, rows);
assert.strictEqual(d.students, 10);
const q2 = d.rows.find(r => r.q === 2), q3 = d.rows.find(r => r.q === 3), q1 = d.rows.find(r => r.q === 1);
assert.strictEqual(q2.wrongPct, 80); assert.strictEqual(q2.topWrong, 'C'); assert.strictEqual(q2.keyDoubt, true);
assert.strictEqual(q3.blankPct, 100); assert.strictEqual(q3.wrongPct, 0);
assert.strictEqual(q1.rightPct, 100); assert.strictEqual(q1.keyDoubt, false);
assert.strictEqual(d.rows[0].q, 2); // sabse zyada galat pehle
// duplicate rolls are counted once
assert.strictEqual(P.difficulty(ex, [{ roll: '1', marks: 1, answers: ['A'] }, { roll: '1', marks: 3, answers: ['B'] }]).students, 1);
// stats
assert.deepStrictEqual(P.stats([{ marks: 2 }, { marks: 4 }]), { n: 2, avg: 3, max: 4, min: 2 });
console.log('scan-extras ok');
