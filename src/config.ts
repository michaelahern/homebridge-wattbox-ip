export interface WattBoxConfig {
    devices: WattBoxDeviceConfig[],
    debug?: boolean,
    pollInterval?: number
}

export interface WattBoxDeviceConfig {
    name: string,
    host: string,
    username: string,
    password: string,
    serviceTag: string,
    excludedOutlets?: string[],
    readOnlyOutlets?: string[],
    resetOnlyOutlets?: string[]
}
