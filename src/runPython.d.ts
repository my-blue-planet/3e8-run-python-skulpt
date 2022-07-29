interface IRunSubscriber {
    sendReadySignal: (readySignal: string, payload: any) => void;
}
export interface IRunConfig {
    context?: "play" | "evaluate";
    code: string;
    outputElement?: HTMLDivElement;
    show?: (payload: any) => void;
    validator?: (code: string) => boolean;
    subscribers?: IRunSubscriber;
    addLib?: Record<string, any>;
}
export declare function runPython(config: IRunConfig): Worker;
export {};