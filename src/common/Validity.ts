export type Validity =
    | { readonly isValid: true }
    | { readonly isValid: false; readonly reason: string };

export const VALID: Validity = { isValid: true };

export const invalid = (reason: string): Validity => ({ isValid: false, reason });

export const bothValid = (a: Validity, b: Validity): Validity => {
    if (!a.isValid) return a;
    if (!b.isValid) return b;
    return VALID;
};
