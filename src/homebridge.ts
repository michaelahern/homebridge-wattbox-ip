import { API, Characteristic, Formats, Perms, WithUUID } from 'homebridge';

export class WattBoxHomebridgeExtensions {
    private static readonly AMPS_NAME = 'Amps';
    private static readonly AMPS_UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';

    private static readonly VOLTS_NAME = 'Volts';
    private static readonly VOLTS_UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';

    private static readonly WATTS_NAME = 'Watts';
    private static readonly WATTS_UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';

    private readonly api: API;

    public Characteristic: Record<string, WithUUID<new() => Characteristic>> = {};

    constructor(api: API) {
        this.api = api;

        this.Characteristic[WattBoxHomebridgeExtensions.AMPS_NAME] = class extends this.api.hap.Characteristic {
            static readonly UUID: string = WattBoxHomebridgeExtensions.AMPS_UUID;

            constructor() {
                super(WattBoxHomebridgeExtensions.AMPS_NAME, WattBoxHomebridgeExtensions.AMPS_UUID, {
                    format: Formats.FLOAT,
                    perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                    unit: 'A',
                    minValue: 0,
                    maxValue: 640,
                    minStep: 0.01
                });
                this.value = this.getDefaultValue();
            }
        };

        this.Characteristic[WattBoxHomebridgeExtensions.VOLTS_NAME] = class extends this.api.hap.Characteristic {
            static readonly UUID: string = WattBoxHomebridgeExtensions.VOLTS_UUID;

            constructor() {
                super(WattBoxHomebridgeExtensions.VOLTS_NAME, WattBoxHomebridgeExtensions.VOLTS_UUID, {
                    format: Formats.FLOAT,
                    perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                    unit: 'V',
                    minValue: 0,
                    maxValue: 640,
                    minStep: 0.1
                });
                this.value = this.getDefaultValue();
            }
        };

        this.Characteristic[WattBoxHomebridgeExtensions.WATTS_NAME] = class extends this.api.hap.Characteristic {
            static readonly UUID: string = WattBoxHomebridgeExtensions.WATTS_UUID;

            constructor() {
                super(WattBoxHomebridgeExtensions.WATTS_NAME, WattBoxHomebridgeExtensions.WATTS_UUID, {
                    format: Formats.FLOAT,
                    perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                    unit: 'W',
                    minValue: 0,
                    maxValue: 6400,
                    minStep: 0.1
                });
                this.value = this.getDefaultValue();
            }
        };
    }
}
