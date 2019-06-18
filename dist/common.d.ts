export interface IQueueNameConfig {
    name: string;
    dlq: string;
    dlx: string;
}
export declare class DefaultQueueNameConfig implements IQueueNameConfig {
    name: string;
    dlq: string;
    dlx: string;
    constructor(name: string);
}
export declare function asQueueNameConfig(config: IQueueNameConfig | string): IQueueNameConfig;
