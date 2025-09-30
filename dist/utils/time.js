"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinValidCollectWindow = isWithinValidCollectWindow;
exports.isNightQuiet = isNightQuiet;
exports.getRangeForScope = getRangeForScope;
exports.startOfToday = startOfToday;
exports.sameYMD = sameYMD;
exports.formatCnRange = formatCnRange;
const luxon_1 = require("luxon");
// 判断当前时间是否在 上午 6 点到晚上 8 点之间，如果在，则允许统计运动数据。
function isWithinValidCollectWindow(now = luxon_1.DateTime.local().setZone(process.env.TZ || 'Asia/Shanghai')) {
    const h = now.hour;
    return h >= 6 && h < 20;
}
// 判断当前时间是否在 晚上 10 点到次日早上 6 点之间，如果在，则视为夜间休眠时间，不统计运动数据。
function isNightQuiet(now = luxon_1.DateTime.local().setZone(process.env.TZ || 'Asia/Shanghai')) {
    const h = now.hour;
    return h >= 22 || h < 6;
}
function getRangeForScope(scope, startAt = luxon_1.DateTime.now().setZone('Asia/Shanghai'), endAt = luxon_1.DateTime.now().setZone('Asia/Shanghai')) {
    if (scope === 'day') {
        return { start: startAt.toJSDate(), end: endAt.toJSDate() };
    }
    if (scope === 'week') {
        // 以周一为一周开始（常见国内口径）
        const start = endAt.startOf('week'); // 周一 00:00:00
        const end = endAt.endOf('week'); // 周日 23:59:59
        return { start: start.toJSDate(), end: end.toJSDate() };
    }
    // month
    const start = startAt.startOf('month');
    const end = endAt.endOf('month');
    return { start: start.toJSDate(), end: end.toJSDate() };
}
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function sameYMD(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}
function formatCnRange(s, e) {
    const sTxt = `${s.getMonth() + 1}月${s.getDate()}日`;
    const eTxt = `${e.getMonth() + 1}月${e.getDate()}日`;
    return sameYMD(s, e) ? sTxt : `${sTxt}-${eTxt}`;
}
