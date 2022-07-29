interface WorkerEventData {
    type: string;
    code?: string;
    addLib?: any;
    key?: string;
    name?: string;
    readysignal?: string;
    payload?: any;
}
interface WorkerEvent {
    data: WorkerEventData;
}
declare function init(): void;
