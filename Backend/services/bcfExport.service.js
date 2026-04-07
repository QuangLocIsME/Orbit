/**
 * BCF Export Service
 * Builds a standards-oriented BCF 2.1 .bcfzip package:
 * - bcf.version
 * - project.bcfp
 * - <topic-guid>/markup.bcf
 * - <topic-guid>/<viewpoint-guid>.bcfv
 */

const { v4: uuidv4 } = (() => {
    try {
        return require('uuid');
    } catch {
        // Fallback uuid generator nếu package chưa cài
        const fallback = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        };
        return { v4: fallback };
    }
})();
const JSZip = require('jszip');

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const mapSeverityToPriority = (severity) => {
    switch (severity) {
        case 'critical': return 'Critical';
        case 'high': return 'Major';
        case 'medium': return 'Normal';
        default: return 'Minor';
    }
};

const mapStatusToBCF = (clash) => {
    if (clash.resolved || clash.status === 'resolved') return 'Resolved';
    if (clash.waived || clash.status === 'waived') return 'Closed';
    if (clash.status === 'in-progress') return 'In Progress';
    return 'Open';
};

const xmlEscape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const looksLikeIfcGuid = (value) => /^[0-9A-Za-z_$]{22}$/.test(String(value || ''));

const buildTopicPayload = (clash) => {
    const topicGuid = uuidv4();
    const viewpointGuid = uuidv4();
    const nowIso = new Date().toISOString();

    return {
        topicGuid,
        viewpointGuid,
        clashId: clash.id,
        topicType: clash.clashType === 'soft' ? 'Clash - Proximity' : 'Clash - Hard',
        topicStatus: mapStatusToBCF(clash),
        title: clash.title || `${clash.objectAType || clash.objectA} clashes with ${clash.objectBType || clash.objectB}`,
        priority: mapSeverityToPriority(clash.severity),
        creationDate: clash.createdAt || clash.updatedAt || nowIso,
        creationAuthor: 'ORBIT',
        modifiedDate: clash.updatedAt || nowIso,
        modifiedAuthor: clash.assignedTo || 'ORBIT',
        assignedTo: clash.assignedTo || '',
        description:
            `${clash.clashType === 'soft' ? 'Soft' : 'Hard'} clash detected.\n` +
            `Object A: ${clash.objectA}\n` +
            `Object B: ${clash.objectB}\n` +
            `Distance: ${clash.distance ?? 0}\n` +
            (clash.note ? `Note: ${clash.note}` : ''),
        labels: [clash.severity, clash.clashType || 'hard'].filter(Boolean),
        position: Array.isArray(clash.position) && clash.position.length === 3
            ? [Number(clash.position[0]) || 0, Number(clash.position[1]) || 0, Number(clash.position[2]) || 0]
            : [0, 0, 0],
        objectA: String(clash.objectA || ''),
        objectB: String(clash.objectB || ''),
    };
};

const buildMarkupXml = (topic) => {
    const labelsXml = topic.labels.map((label) => `<Label>${xmlEscape(label)}</Label>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="markup.xsd">
  <Topic Guid="${xmlEscape(topic.topicGuid)}" TopicType="${xmlEscape(topic.topicType)}" TopicStatus="${xmlEscape(topic.topicStatus)}">
    <Title>${xmlEscape(topic.title)}</Title>
    <Priority>${xmlEscape(topic.priority)}</Priority>
    <CreationDate>${xmlEscape(topic.creationDate)}</CreationDate>
    <CreationAuthor>${xmlEscape(topic.creationAuthor)}</CreationAuthor>
    <ModifiedDate>${xmlEscape(topic.modifiedDate)}</ModifiedDate>
    <ModifiedAuthor>${xmlEscape(topic.modifiedAuthor)}</ModifiedAuthor>
    ${topic.assignedTo ? `<AssignedTo>${xmlEscape(topic.assignedTo)}</AssignedTo>` : ''}
    <Description>${xmlEscape(topic.description)}</Description>
    <Labels>${labelsXml}</Labels>
    <ReferenceLinks>
      <ReferenceLink>${xmlEscape(`orbit://clash/${topic.clashId}`)}</ReferenceLink>
    </ReferenceLinks>
  </Topic>
  <Viewpoints>
    <Viewpoint Guid="${xmlEscape(topic.viewpointGuid)}">${xmlEscape(`${topic.viewpointGuid}.bcfv`)}</Viewpoint>
  </Viewpoints>
</Markup>
`;
};

const componentXml = (id) => {
    const authoringToolId = xmlEscape(id);
    if (looksLikeIfcGuid(id)) {
        return `<Component IfcGuid="${authoringToolId}" OriginatingSystem="ORBIT" AuthoringToolId="${authoringToolId}" />`;
    }
    return `<Component OriginatingSystem="ORBIT" AuthoringToolId="${authoringToolId}" />`;
};

const buildViewpointXml = (topic) => {
    const [x, y, z] = topic.position;
    return `<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${xmlEscape(topic.viewpointGuid)}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="visinfo.xsd">
  <Components>
    <Selection>
      ${componentXml(topic.objectA)}
      ${componentXml(topic.objectB)}
    </Selection>
    <Visibility DefaultVisibility="true" />
  </Components>
  <PerspectiveCamera>
    <CameraViewPoint>
      <X>${x}</X>
      <Y>${y + 5}</Y>
      <Z>${z + 5}</Z>
    </CameraViewPoint>
    <CameraDirection>
      <X>0</X>
      <Y>-0.707</Y>
      <Z>-0.707</Z>
    </CameraDirection>
    <CameraUpVector>
      <X>0</X>
      <Y>0.707</Y>
      <Z>-0.707</Z>
    </CameraUpVector>
    <FieldOfView>60</FieldOfView>
  </PerspectiveCamera>
</VisualizationInfo>
`;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build BCF 2.1 ZIP package bytes.
 * @param {Array} clashes
 * @param {string} projectName
 * @returns {Promise<Buffer>}
 */
const buildBCFZip = async (clashes, projectName = 'ORBIT Project') => {
    const zip = new JSZip();
    const projectId = uuidv4();
    const topics = clashes.map((clash) => buildTopicPayload(clash));

    zip.file('bcf.version', `<?xml version="1.0" encoding="UTF-8"?>
<Version VersionId="2.1" DetailedVersion="2.1" />
`);

    zip.file('project.bcfp', `<?xml version="1.0" encoding="UTF-8"?>
<ProjectExtension xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="project.xsd">
  <Project ProjectId="${xmlEscape(projectId)}" Name="${xmlEscape(projectName)}" />
</ProjectExtension>
`);

    topics.forEach((topic) => {
        const folder = zip.folder(topic.topicGuid);
        if (!folder) return;
        folder.file('markup.bcf', buildMarkupXml(topic));
        folder.file(`${topic.viewpointGuid}.bcfv`, buildViewpointXml(topic));
    });

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
};

module.exports = {
    buildBCFZip,
};
