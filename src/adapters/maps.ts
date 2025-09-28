import axios from 'axios';
import { env } from '../env';

export async function reverseGeocodeCity(lat: number, lng: number): Promise<{city?:string, province?:string}> {
    if (env.maps.amapKey) {
        const url = 'https://restapi.amap.com/v3/geocode/regeo';
        const { data } = await axios.get(url, {
            params: {
                key: env.maps.amapKey,
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