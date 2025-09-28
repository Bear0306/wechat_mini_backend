// 仅保留城市级名称，避免过精定位
export function cityOnlyName(input?:{ city?:string, province?:string }){
    if (!input)
        return undefined;
    
    if (input.city)
        return Array.isArray(input.city) ? input.city[0] : input.city;
    
    if (input.province)
        return input.province;
    
    return undefined;
}