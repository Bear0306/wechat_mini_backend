"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cityOnlyName = cityOnlyName;
// 仅保留城市级名称，避免过精定位
function cityOnlyName(input) {
    if (!input)
        return undefined;
    if (input.city)
        return Array.isArray(input.city) ? input.city[0] : input.city;
    if (input.province)
        return input.province;
    return undefined;
}
