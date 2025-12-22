import { API, Characteristic, Formats, Perms, WithUUID } from 'homebridge';

export class HomebridgeExtensions {
    static readonly #AMPS_NAME = 'Amps';
    static readonly #AMPS_UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';

    static readonly #VOLTS_NAME = 'Volts';
    static readonly #VOLTS_UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';

    static readonly #WATTS_NAME = 'Watts';
    static readonly #WATTS_UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';

    private readonly api: API;

    public Characteristic: {
        Amps: WithUUID<new() => Characteristic>;
        Volts: WithUUID<new() => Characteristic>;
        Watts: WithUUID<new() => Characteristic>;
    };

    constructor(api: API) {
        this.api = api;

        this.Characteristic = {
            Amps: class extends this.api.hap.Characteristic {
                static readonly UUID: string = HomebridgeExtensions.#AMPS_UUID;

                constructor() {
                    super(HomebridgeExtensions.#AMPS_NAME, HomebridgeExtensions.#AMPS_UUID, {
                        format: Formats.FLOAT,
                        perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                        unit: 'A',
                        minValue: 0,
                        maxValue: 640,
                        minStep: 0.01
                    });
                    this.value = this.getDefaultValue();
                }
            },
            Volts: class extends this.api.hap.Characteristic {
                static readonly UUID: string = HomebridgeExtensions.#VOLTS_UUID;

                constructor() {
                    super(HomebridgeExtensions.#VOLTS_NAME, HomebridgeExtensions.#VOLTS_UUID, {
                        format: Formats.FLOAT,
                        perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                        unit: 'V',
                        minValue: 0,
                        maxValue: 640,
                        minStep: 0.1
                    });
                    this.value = this.getDefaultValue();
                }
            },
            Watts: class extends this.api.hap.Characteristic {
                static readonly UUID: string = HomebridgeExtensions.#WATTS_UUID;

                constructor() {
                    super(HomebridgeExtensions.#WATTS_NAME, HomebridgeExtensions.#WATTS_UUID, {
                        format: Formats.FLOAT,
                        perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                        unit: 'W',
                        minValue: 0,
                        maxValue: 6400,
                        minStep: 0.1
                    });
                    this.value = this.getDefaultValue();
                }
            }
        };
    }
}
