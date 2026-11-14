import { memo } from 'react';

interface TransElementProps {
    element: JSX.Element;
}

/**
 * For a self-closing tag in a translation (`<icon/>`), react-i18next's `Trans`
 * replaces the component's children with the tag's empty content. Passing
 * `<TransElement element={...} />` as the component keeps the element as is.
 */
// eslint-disable-next-line react/prop-types
export const TransElement = memo(({ element }: TransElementProps) => element);
