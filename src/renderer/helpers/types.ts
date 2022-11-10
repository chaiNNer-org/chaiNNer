export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
export type GetSetState<T> = readonly [T, SetState<T>];
