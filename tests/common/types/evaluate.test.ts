import { evaluate } from '../../../src/common/types/evaluate';
import { TypeDefinitions } from '../../../src/common/types/typedef';
import { expressions } from './expressions';

test('Expression evaluation', () => {
    const defs = new TypeDefinitions();
    const actual = expressions
        .map((e) => `${e.toString()} => ${evaluate(e, defs).toString()}`)
        .join('\n');
    expect(actual).toMatchSnapshot();
});
