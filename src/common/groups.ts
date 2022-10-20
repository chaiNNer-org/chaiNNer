export type GroupInputId = number & { readonly __groupInputId: never };

export interface GroupDescriptor<Options> {
    type: string;
}

const descriptors = new Map<string, GroupDescriptor<unknown>>();
export const registerGroupDescriptor = <T>(desc: GroupDescriptor<T>): void => {
    descriptors.set(desc.type, desc);
};
