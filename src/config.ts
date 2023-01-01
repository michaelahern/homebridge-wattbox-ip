export interface WattBoxConfig {
    devices: WattBoxDeviceConfig[],
}

export interface WattBoxDeviceConfig {
    name: string,
    host: string,
    username: string,
    password: string,
    serviceTag: string
}
