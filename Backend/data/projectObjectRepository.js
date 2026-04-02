/**
 * ProjectObjectRepository
 * Source of truth cho BIM objects của mỗi project.
 * Hiện dùng in-memory mock + JSON file per-project (data/projects/{slug}/objects.json).
 * Swap sang DB: chỉ cần thay class này.
 */
const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.resolve(__dirname, 'projects');

const defaultObjects = require('./mockObjects.json');

const mockProjectObjects = {
    'ecommerce-platform-v2': [
        { id: 'commerce-core-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [5.2, 0.3, 3.2] } },
        { id: 'commerce-api-pipe-001', type: 'IfcPipeSegment', bbox: { min: [2.1, 0.1, 1.1], max: [6.1, 0.45, 1.6] } },
        { id: 'commerce-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [1.0, 1.9, 2.0], max: [4.6, 2.4, 2.5] } },
        { id: 'commerce-beam-001', type: 'IfcBeam', bbox: { min: [1.4, 1.6, 1.9], max: [5.4, 2.8, 2.9] } },
        { id: 'commerce-column-001', type: 'IfcColumn', bbox: { min: [6.4, 0.9, 0], max: [7.0, 1.5, 3.4] } },
        { id: 'commerce-slab-001', type: 'IfcSlab', bbox: { min: [0, 0, 3.0], max: [8.8, 6.6, 3.35] } },
    ],
    'mobile-banking-app': [
        { id: 'vault-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [4.5, 0.35, 3.2] } },
        { id: 'secure-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.8, 0.1, 1.0], max: [5.2, 0.45, 1.5] } },
        { id: 'network-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [0.8, 1.8, 2.0], max: [4.4, 2.4, 2.5] } },
        { id: 'atm-beam-001', type: 'IfcBeam', bbox: { min: [1.2, 1.5, 1.9], max: [5.1, 2.7, 2.8] } },
        { id: 'server-column-001', type: 'IfcColumn', bbox: { min: [6.5, 0.8, 0], max: [7.1, 1.6, 3.5] } },
        { id: 'security-slab-001', type: 'IfcSlab', bbox: { min: [0, 0, 3], max: [9, 7, 3.4] } },
    ],
    'crm-system-integration': [
        { id: 'crm-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [4.8, 0.25, 3.1] } },
        { id: 'crm-duct-001', type: 'IfcDuctSegment', bbox: { min: [1.9, 0.05, 2.4], max: [5.4, 0.45, 3.0] } },
        { id: 'crm-beam-001', type: 'IfcBeam', bbox: { min: [0.9, 1.7, 2.0], max: [4.7, 2.6, 2.8] } },
        { id: 'crm-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.4, 1.9, 2.2], max: [4.9, 2.3, 2.6] } },
        { id: 'crm-column-001', type: 'IfcColumn', bbox: { min: [5.9, 0.8, 0], max: [6.5, 1.4, 3.3] } },
        { id: 'crm-slab-001', type: 'IfcSlab', bbox: { min: [5.6, 0.6, 3.0], max: [7.2, 2.2, 3.4] } },
    ],
    'ui-ux-design-system': [
        { id: 'design-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [4.2, 0.28, 3.0] } },
        { id: 'design-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.5, 0.08, 1.0], max: [4.9, 0.42, 1.45] } },
        { id: 'design-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [0.8, 1.5, 1.9], max: [3.8, 2.0, 2.3] } },
        { id: 'design-beam-001', type: 'IfcBeam', bbox: { min: [1.1, 1.2, 1.8], max: [4.4, 2.3, 2.6] } },
        { id: 'design-column-001', type: 'IfcColumn', bbox: { min: [5.2, 0.6, 0], max: [5.8, 1.2, 3.0] } },
        { id: 'design-slab-001', type: 'IfcSlab', bbox: { min: [5.0, 0.5, 2.8], max: [6.8, 1.8, 3.2] } },
    ],
    'saas-dashboard-platform': [
        { id: 'saas-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [5.4, 0.3, 3.4] } },
        { id: 'saas-duct-001', type: 'IfcDuctSegment', bbox: { min: [2.4, 0.12, 2.6], max: [6.3, 0.5, 3.2] } },
        { id: 'saas-column-001', type: 'IfcColumn', bbox: { min: [6.8, 1.0, 0], max: [7.5, 1.8, 3.8] } },
        { id: 'saas-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [6.9, 1.1, 2.0], max: [9.4, 1.7, 2.4] } },
        { id: 'saas-beam-001', type: 'IfcBeam', bbox: { min: [1.3, 2.3, 2.2], max: [5.7, 3.1, 2.9] } },
        { id: 'saas-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.7, 2.5, 2.35], max: [5.0, 2.9, 2.75] } },
    ],
    'metro-station-phase-2': defaultObjects,
    'office-complex-tower-a': [
        { id: 'tower-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [6, 0.3, 3.6] } },
        { id: 'tower-duct-001', type: 'IfcDuctSegment', bbox: { min: [2.2, 0.05, 2.8], max: [6.8, 0.55, 3.4] } },
        { id: 'tower-column-001', type: 'IfcColumn', bbox: { min: [7.5, 1.2, 0], max: [8.3, 2.0, 4.2] } },
        { id: 'tower-cabletray-001', type: 'IfcCableCarrierSegment', bbox: { min: [7.7, 1.1, 1.8], max: [10.1, 1.7, 2.3] } },
        { id: 'tower-beam-001', type: 'IfcBeam', bbox: { min: [1.2, 2.2, 2.2], max: [5.8, 3.3, 2.9] } },
        { id: 'tower-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.5, 2.4, 2.4], max: [5.1, 2.9, 2.8] } },
    ],
    'residential-building': [
        { id: 'res-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [5.5, 0.25, 3.0] } },
        { id: 'res-pipe-001', type: 'IfcPipeSegment', bbox: { min: [2.0, 0.1, 1.2], max: [5.8, 0.4, 1.6] } },
        { id: 'res-column-001', type: 'IfcColumn', bbox: { min: [6.0, 1.0, 0], max: [6.7, 1.7, 3.2] } },
        { id: 'res-slab-001', type: 'IfcSlab', bbox: { min: [5.7, 0.8, 2.9], max: [7.6, 2.1, 3.3] } },
        { id: 'res-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [1.0, 1.8, 2.0], max: [4.1, 2.3, 2.4] } },
        { id: 'res-beam-001', type: 'IfcBeam', bbox: { min: [1.2, 1.6, 1.95], max: [4.8, 2.6, 2.7] } },
    ],
    'shopping-mall-extension': [
        { id: 'mall-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [6.2, 0.32, 3.5] } },
        { id: 'mall-duct-001', type: 'IfcDuctSegment', bbox: { min: [2.6, 0.08, 2.7], max: [6.9, 0.55, 3.1] } },
        { id: 'mall-column-001', type: 'IfcColumn', bbox: { min: [7.1, 1.3, 0], max: [7.9, 2.0, 4.0] } },
        { id: 'mall-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [7.2, 1.4, 2.1], max: [10.2, 1.9, 2.5] } },
        { id: 'mall-beam-001', type: 'IfcBeam', bbox: { min: [1.8, 2.5, 2.0], max: [6.3, 3.3, 2.8] } },
        { id: 'mall-pipe-001', type: 'IfcPipeSegment', bbox: { min: [2.1, 2.6, 2.2], max: [5.8, 3.0, 2.6] } },
    ],
    'hospital-renovation': [
        { id: 'hospital-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [5.0, 0.28, 3.3] } },
        { id: 'hospital-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.8, 0.12, 1.1], max: [5.6, 0.48, 1.7] } },
        { id: 'hospital-duct-001', type: 'IfcDuctSegment', bbox: { min: [0.9, 1.7, 2.4], max: [4.9, 2.2, 3.0] } },
        { id: 'hospital-beam-001', type: 'IfcBeam', bbox: { min: [1.3, 1.5, 2.2], max: [5.2, 2.6, 2.9] } },
        { id: 'hospital-column-001', type: 'IfcColumn', bbox: { min: [6.4, 0.9, 0], max: [7.1, 1.6, 3.6] } },
        { id: 'hospital-slab-001', type: 'IfcSlab', bbox: { min: [6.1, 0.7, 3.2], max: [8.3, 2.1, 3.7] } },
    ],
    'company-website-redesign': [
        { id: 'website-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [4.4, 0.25, 3.1] } },
        { id: 'website-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.6, 0.1, 1.2], max: [5.0, 0.4, 1.55] } },
        { id: 'website-column-001', type: 'IfcColumn', bbox: { min: [5.3, 0.7, 0], max: [5.9, 1.3, 3.1] } },
        { id: 'website-slab-001', type: 'IfcSlab', bbox: { min: [5.1, 0.6, 2.85], max: [6.7, 1.8, 3.25] } },
        { id: 'website-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [0.7, 1.7, 2.0], max: [3.7, 2.1, 2.4] } },
        { id: 'website-beam-001', type: 'IfcBeam', bbox: { min: [0.9, 1.4, 1.8], max: [4.2, 2.4, 2.7] } },
    ],
    'ai-chatbot-development': [
        { id: 'chatbot-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [5.1, 0.3, 3.4] } },
        { id: 'chatbot-duct-001', type: 'IfcDuctSegment', bbox: { min: [2.0, 0.09, 2.7], max: [5.9, 0.46, 3.1] } },
        { id: 'chatbot-column-001', type: 'IfcColumn', bbox: { min: [6.3, 0.9, 0], max: [6.9, 1.6, 3.7] } },
        { id: 'chatbot-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [6.4, 1.0, 2.0], max: [8.8, 1.5, 2.45] } },
        { id: 'chatbot-beam-001', type: 'IfcBeam', bbox: { min: [1.1, 2.0, 2.1], max: [5.3, 3.0, 2.85] } },
        { id: 'chatbot-pipe-001', type: 'IfcPipeSegment', bbox: { min: [1.5, 2.2, 2.25], max: [4.8, 2.7, 2.65] } },
    ],
    'school-campus': [
        { id: 'school-wall-001', type: 'IfcWall', bbox: { min: [0, 0, 0], max: [6.0, 0.3, 3.4] } },
        { id: 'school-pipe-001', type: 'IfcPipeSegment', bbox: { min: [2.3, 0.1, 1.0], max: [6.3, 0.46, 1.5] } },
        { id: 'school-column-001', type: 'IfcColumn', bbox: { min: [7.0, 1.1, 0], max: [7.7, 1.9, 3.8] } },
        { id: 'school-slab-001', type: 'IfcSlab', bbox: { min: [6.8, 1.0, 3.1], max: [9.1, 2.7, 3.5] } },
        { id: 'school-tray-001', type: 'IfcCableCarrierSegment', bbox: { min: [1.4, 2.0, 2.0], max: [5.0, 2.5, 2.5] } },
        { id: 'school-beam-001', type: 'IfcBeam', bbox: { min: [1.7, 1.8, 1.95], max: [5.6, 2.9, 2.8] } },
    ],
};

/**
 * Đọc file objects của project nếu tồn tại (data/projects/{slug}/objects.json).
 */
const readProjectFile = (projectSlug) => {
    try {
        const filePath = path.join(PROJECTS_DIR, projectSlug, 'objects.json');
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch {
        // Fallback to mock
    }
    return null;
};

/**
 * Lưu objects của project vào file (data/projects/{slug}/objects.json).
 */
const saveObjects = (projectSlug, objects) => {
    if (!projectSlug || !Array.isArray(objects)) {
        throw new Error('projectSlug and objects array are required');
    }
    const dir = path.join(PROJECTS_DIR, projectSlug);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'objects.json'), JSON.stringify(objects, null, 2), 'utf8');
};

/**
 * Lấy danh sách objects của project.
 * Priority: file-based > in-memory mock > defaultObjects
 */
const getObjects = (projectSlug) => {
    if (!projectSlug) return defaultObjects;
    const fromFile = readProjectFile(projectSlug);
    if (fromFile) return fromFile;
    return mockProjectObjects[projectSlug] || defaultObjects;
};

module.exports = {
    getObjects,
    saveObjects,
};
