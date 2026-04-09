/**
 * BCF Export Service
 * Tạo BCF 2.1 JSON format từ danh sách clashes.
 * Tương thích với: Navisworks, BIM Collab, Revit, BIMsync.
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

const buildViewpoint = (clash) => ({
    guid: uuidv4(),
    perspective_camera: clash.position
        ? {
              camera_view_point: { x: clash.position[0], y: clash.position[1] + 5, z: clash.position[2] + 5 },
              camera_direction: { x: 0, y: -0.707, z: -0.707 },
              camera_up_vector: { x: 0, y: 0.707, z: -0.707 },
              field_of_view: 60,
          }
        : null,
    clipping_planes: [],
    lines: [],
    bitmaps: [],
    components: {
        selection: [
            { ifc_guid: clash.objectA, originating_system: 'ORBIT', authoring_tool_id: clash.objectA },
            { ifc_guid: clash.objectB, originating_system: 'ORBIT', authoring_tool_id: clash.objectB },
        ],
        coloring: [],
        visibility: { default_visibility: true, exceptions: [] },
    },
});

const buildTopic = (clash, viewpointGuid) => ({
    guid: clash.id,
    topic_type: clash.clashType === 'soft' ? 'Clash - Proximity' : 'Clash - Hard',
    topic_status: mapStatusToBCF(clash),
    title: clash.title || `${clash.objectAType || clash.objectA} clashes with ${clash.objectBType || clash.objectB}`,
    priority: mapSeverityToPriority(clash.severity),
    creation_date: clash.createdAt || clash.updatedAt || new Date().toISOString(),
    creation_author: 'ORBIT',
    modified_date: clash.updatedAt || new Date().toISOString(),
    modified_author: clash.assignedTo || 'ORBIT',
    assigned_to: clash.assignedTo || null,
    due_date: clash.dueDate || null,
    description:
        `${clash.clashType === 'soft' ? 'Soft' : 'Hard'} clash detected.\n` +
        `Object A: ${clash.objectA}\n` +
        `Object B: ${clash.objectB}\n` +
        (clash.note ? `Note: ${clash.note}` : ''),
    labels: [clash.severity, clash.clashType || 'hard'],
    reference_links: [],
    bim_snippet: null,
    document_references: [],
    related_topics: [],
    comments: (clash.history || [])
        .filter((h) => h.type === 'note-added' || h.type === 'resolved' || h.type === 'waived')
        .map((h) => ({
            guid: h.id || uuidv4(),
            date: h.timestamp,
            author: h.user || 'ORBIT',
            comment: h.message,
            viewpoint_guid: null,
            reply_to_comment_guid: null,
        })),
    viewpoints: [{ guid: viewpointGuid, snapshot: null }],
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Tạo BCF 2.1 JSON document từ mảng clashes.
 * @param {Array} clashes - Danh sách clash objects (đã merge resolution)
 * @param {string} projectName
 * @returns {Object} BCF document
 */
const buildBCFDocument = (clashes, projectName = 'ORBIT Project') => {
    const topics = clashes.map((clash) => {
        const vp = buildViewpoint(clash);
        const topic = buildTopic(clash, vp.guid);
        return { topic, viewpoints: [vp] };
    });

    return {
        version: { version_id: '2.1', detailed_version: 'https://github.com/buildingSMART/BCF-XML/tree/master/Documentation' },
        project: { name: projectName, project_id: uuidv4() },
        extensions: {
            topic_types: ['Clash - Hard', 'Clash - Proximity'],
            topic_statuses: ['Open', 'In Progress', 'Resolved', 'Closed'],
            priorities: ['Critical', 'Major', 'Normal', 'Minor'],
            labels: ['high', 'medium', 'low', 'critical', 'hard', 'soft'],
        },
        topics: topics.map(({ topic, viewpoints }) => ({
            ...topic,
            viewpoints_data: viewpoints,
        })),
        generated_at: new Date().toISOString(),
        generated_by: 'ORBIT Clash Detection',
    };
};

module.exports = {
    buildBCFDocument,
};
