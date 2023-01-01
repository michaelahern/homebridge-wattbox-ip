export interface WattboxConfig {
    devices: WattboxDeviceConfig[],
}

export interface WattboxDeviceConfig {
    name: string,
    host: string,
    username: string,
    password: string,
    serviceTag: string
}
