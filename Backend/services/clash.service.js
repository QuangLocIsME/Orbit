const SEVERITY_THRESHOLDS = {
    high: 1.5,
    medium: 0.25,
};

const isFiniteNumber = (value) => Number.isFinite(value);

const isValidVector3 = (value) =>
    Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);

const isValidBoundingBox = (bbox) => {
    if (!bbox || !isValidVector3(bbox.min) || !isValidVector3(bbox.max)) {
        return false;
    }

    return bbox.min.every((coordinate, index) => coordinate <= bbox.max[index]);
};

const validateObject = (object, index) => {
    if (!object || typeof object !== 'object') {
        throw new Error(`Invalid clash object at index ${index}`);
    }

    if (typeof object.id !== 'string' || !object.id.trim()) {
        throw new Error(`Clash object at index ${index} is missing a valid id`);
    }

    if (typeof object.type !== 'string' || !object.type.trim()) {
        throw new Error(`Clash object ${object.id} is missing a valid type`);
    }

    if (!isValidBoundingBox(object.bbox)) {
        throw new Error(`Clash object ${object.id} has an invalid bbox`);
    }
};

const intersectsAABB = (objectA, objectB) =>
    objectA.bbox.min[0] <= objectB.bbox.max[0] &&
    objectA.bbox.max[0] >= objectB.bbox.min[0] &&
    objectA.bbox.min[1] <= objectB.bbox.max[1] &&
    objectA.bbox.max[1] >= objectB.bbox.min[1] &&
    objectA.bbox.min[2] <= objectB.bbox.max[2] &&
    objectA.bbox.max[2] >= objectB.bbox.min[2];

const computeOverlap = (objectA, objectB) => {
    if (!intersectsAABB(objectA, objectB)) {
        return null;
    }

    const min = [
        Math.max(objectA.bbox.min[0], objectB.bbox.min[0]),
        Math.max(objectA.bbox.min[1], objectB.bbox.min[1]),
        Math.max(objectA.bbox.min[2], objectB.bbox.min[2]),
    ];
    const max = [
        Math.min(objectA.bbox.max[0], objectB.bbox.max[0]),
        Math.min(objectA.bbox.max[1], objectB.bbox.max[1]),
        Math.min(objectA.bbox.max[2], objectB.bbox.max[2]),
    ];
    const size = max.map((coordinate, index) => Math.max(coordinate - min[index], 0));
    const position = min.map((coordinate, index) => coordinate + size[index] / 2);
    const intersectionVolume = Number((size[0] * size[1] * size[2]).toFixed(6));

    return {
        min,
        max,
        size,
        position,
        intersectionVolume,
    };
};

const getSeverity = (intersectionVolume) => {
    if (intersectionVolume >= SEVERITY_THRESHOLDS.high) {
        return 'high';
    }
    if (intersectionVolume >= SEVERITY_THRESHOLDS.medium) {
        return 'medium';
    }
    return 'low';
};

const buildClashGroupKey = (objectA, objectB) => [objectA.type, objectB.type].sort().join('__');

const buildClashId = (objectA, objectB) => `${objectA.id}__${objectB.id}`;

const detectClashes = (objects = []) => {
    if (!Array.isArray(objects)) {
        throw new Error('Objects payload must be an array');
    }

    objects.forEach(validateObject);

    const clashes = [];

    for (let indexA = 0; indexA < objects.length; indexA += 1) {
        for (let indexB = indexA + 1; indexB < objects.length; indexB += 1) {
            const objectA = objects[indexA];
            const objectB = objects[indexB];
            const overlap = computeOverlap(objectA, objectB);

            if (!overlap) {
                continue;
            }

            clashes.push({
                id: buildClashId(objectA, objectB),
                objectA: objectA.id,
                objectB: objectB.id,
                position: overlap.position,
                severity: getSeverity(overlap.intersectionVolume),
                intersectionVolume: overlap.intersectionVolume,
                distance: 0,
                groupKey: buildClashGroupKey(objectA, objectB),
            });
        }
    }

    return clashes;
};

module.exports = {
    detectClashes,
    intersectsAABB,
    computeOverlap,
    buildClashGroupKey,
    getSeverity,
    validateObject,
};
