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
    outletsReadOnly?: boolean,
    outletsResetOnly?: boolean,
    excludedOutlets?: string[]
}
