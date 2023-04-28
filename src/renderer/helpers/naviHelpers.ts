import { FunctionCallExpression, Type, evaluate } from '@chainner/navi';
import { getChainnerScope } from '../../common/types/chainner-scope';

export const typeToString = (type: Type): Type => {
    return evaluate(new FunctionCallExpression('toString', [type]), getChainnerScope());
};
