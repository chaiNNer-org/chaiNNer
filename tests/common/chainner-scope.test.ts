import { FunctionCallExpression, NamedExpression, evaluate } from '@chainner/navi';
import { getChainnerScope } from '../../src/common/types/chainner-scope';
import { assertNever } from '../../src/common/util';

test(`Chainner scope is correct`, () => {
    const scope = getChainnerScope();

    for (const [name, def] of scope.entries()) {
        switch (def.type) {
            case 'parameter':
                break;
            case 'variable':
            case 'struct':
                evaluate(new NamedExpression(name), scope);
                break;
            case 'intrinsic-function':
            case 'function':
                evaluate(
                    new FunctionCallExpression(
                        name,
                        def.definition.parameters.map((p) => p.type),
                    ),
                    scope,
                );
                break;
            default:
                return assertNever(def);
        }
    }
});
