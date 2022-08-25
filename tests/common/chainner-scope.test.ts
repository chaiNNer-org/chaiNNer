import { getChainnerScope } from '../../src/common/types/chainner-scope';
import { evaluate } from '../../src/common/types/evaluate';
import { FunctionCallExpression, NamedExpression } from '../../src/common/types/expression';
import { assertNever } from '../../src/common/util';

// eslint-disable-next-line consistent-return
test(`Chainner scope is correct`, () => {
    const scope = getChainnerScope();
    // eslint-disable-next-line @typescript-eslint/dot-notation
    for (const [name, def] of scope['definitions']) {
        switch (def.type) {
            case 'parameter':
                break;
            case 'variable':
            case 'struct':
                evaluate(new NamedExpression(name), scope);
                break;
            case 'builtin-function':
                evaluate(new FunctionCallExpression(name, def.definition.parameters), scope);
                break;
            case 'function':
                evaluate(
                    new FunctionCallExpression(
                        name,
                        def.definition.parameters.map((p) => p.type)
                    ),
                    scope
                );
                break;
            default:
                return assertNever(def);
        }
    }
});
