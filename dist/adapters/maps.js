"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseGeocodeCity = reverseGeocodeCity;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../env");
async function reverseGeocodeCity(lat, lng) {
    if (env_1.env.maps.amapKey) {
        const url = 'https://restapi.amap.com/v3/geocode/regeo';
        const { data } = await axios_1.default.get(url, {
            params: {
                key: env_1.env.maps.amapKey,
                location: String(lng) + ',' + String(lat),
                radius: 1000,
                extensions: 'base'
            }
        });
        const comp = data?.regeocode?.addressComponent || {};
        return {
            city: comp.city || comp.district,
            province: comp.province
        };
    }
    return {};
}
