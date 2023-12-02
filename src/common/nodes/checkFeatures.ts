import { Feature, FeatureId, FeatureState } from '../common-types';
import { joinEnglish } from '../util';
import { VALID, Validity, invalid } from '../Validity';

export const checkFeatures = (
    features: readonly FeatureId[],
    featureMap: ReadonlyMap<FeatureId, Feature>,
    featureStates: ReadonlyMap<FeatureId, FeatureState>,
): Validity => {
    const nonEnabledFeatures = features.filter((f) => !featureStates.get(f)?.enabled);
    if (nonEnabledFeatures.length === 0) return VALID;

    const getName = (f: FeatureId) => featureMap.get(f)?.name ?? f;

    let prefix;
    if (nonEnabledFeatures.length === 1) {
        prefix = `The feature ${getName(nonEnabledFeatures[0])} is`;
    } else {
        prefix = `The features ${joinEnglish(nonEnabledFeatures.map(getName))} are`;
    }

    return invalid(
        `${prefix} required to run this node. See the dependency manager for more details.`,
    );
};
