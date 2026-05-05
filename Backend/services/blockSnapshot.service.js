const mongoose = require('mongoose');
const Package = require('../models/Package');
const Activity = require('../models/Activity');
const UploadApproval = require('../models/UploadApproval');
const UploadApprovalComment = require('../models/UploadApprovalComment');
const ChangeRequest = require('../models/ChangeRequest');
const CRVersion = require('../models/CRVersion');
const CRComment = require('../models/CRComment');
const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const ProjectInvite = require('../models/ProjectInvite');
const ProjectRole = require('../models/ProjectRole');
const Team = require('../models/Team');
const TeamMember = require('../models/TeamMember');
const ProjectMember = require('../models/ProjectMember');
const User = require('../models/User');
const DocumentRepository = require('../repositories/DocumentRepository');
const DocumentFolderRepository = require('../repositories/DocumentFolderRepository');
const PackageRepository = require('../repositories/PackageRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function buildPackagesSummaryBlock(projectId, userId) {
    const member = await ProjectMemberRepository.findMember(projectId, userId);
    if (!member) {
        return { items: [], total: 0 };
    }

    const packages = member.role === 'admin' || member.role === 'owner'
        ? await PackageRepository.listByProjectIdSorted(projectId, 'active')
        : await PackageRepository.listByProjectAndMember(projectId, userId, 'active');

    return {
        items: packages.map((pkg) => ({
            publicId: pkg.publicId,
            projectId: pkg.projectId,
            name: pkg.name,
            description: pkg.description,
            packageType: pkg.packageType,
            status: pkg.status,
            dueDate: pkg.dueDate,
            creatorId: pkg.creatorId,
            teamMemberIds: pkg.teamMemberIds || [],
            archivedAt: pkg.archivedAt || null,
            createdAt: pkg.createdAt,
            updatedAt: pkg.updatedAt,
        })),
        total: packages.length,
    };
}

async function buildActivityFeedBlock(projectId, packageId = null) {
    const query = { projectId };
    if (packageId) {
        query.packageId = packageId;
    }

    const activities = await Activity.find(query)
        .sort({ createdAt: -1 })
        .limit(25)
        .select('publicId projectId packageId userName type targetId targetName metadata createdAt')
        .lean();

    return {
        items: activities.map((activity) => ({
            id: activity.publicId,
            projectId: activity.projectId,
            packageId: activity.packageId || null,
            user: activity.userName || 'System',
            type: activity.type,
            targetId: activity.targetId || null,
            targetName: activity.targetName || '',
            metadata: activity.metadata || {},
            createdAt: activity.createdAt,
        })),
    };
}

async function buildTeamsRosterBlock(projectId) {
    const [members, invites, roles, teams, teamMembers] = await Promise.all([
        ProjectMember.find({ projectId, status: 'accepted' })
            .sort({ createdAt: 1 })
            .select('publicId userId role status invitedBy createdAt')
            .lean(),
        ProjectInvite.find({ projectId })
            .sort({ createdAt: -1 })
            .select('_id projectId email role status invitedBy expiresAt createdAt')
            .lean(),
        ProjectRole.find({ projectId })
            .sort({ isSystem: -1, createdAt: 1 })
            .select('publicId name color roleKey description accessLevel isSystem permissions')
            .lean(),
        Team.find({ projectId })
            .sort({ createdAt: 1 })
            .select('publicId name description color createdBy createdAt')
            .lean(),
        TeamMember.find({ projectId })
            .select('teamId userId')
            .lean(),
    ]);

    const userIds = [...new Set(members.map((member) => normalizeString(member.userId)).filter(Boolean))];
    const users = userIds.length > 0
        ? await User.find({ _id: { $in: userIds } }).select('_id fullName email avatar').lean()
        : [];
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const membersByTeam = new Map();
    for (const entry of teamMembers) {
        const teamId = normalizeString(entry.teamId);
        if (!teamId) continue;
        if (!membersByTeam.has(teamId)) membersByTeam.set(teamId, []);
        membersByTeam.get(teamId).push(normalizeString(entry.userId));
    }

    return {
        members: members.map((member) => ({
            publicId: member.publicId,
            userId: member.userId,
            role: member.role,
            status: member.status,
            invitedBy: member.invitedBy,
            createdAt: member.createdAt,
            user: (() => {
                const user = userMap.get(normalizeString(member.userId));
                if (!user) return undefined;
                return {
                    fullName: user.fullName,
                    email: user.email,
                    avatar: user.avatar || null,
                };
            })(),
        })),
        invites: invites.map((invite) => ({
            publicId: String(invite._id),
            projectId: invite.projectId,
            email: invite.email,
            role: invite.role,
            status: invite.status,
            invitedBy: invite.invitedBy,
            expiresAt: invite.expiresAt,
            createdAt: invite.createdAt,
        })),
        roles: roles.map((role) => ({
            id: role.publicId,
            name: role.name,
            color: role.color,
            roleKey: role.roleKey,
            description: role.description,
            accessLevel: role.accessLevel,
            isSystem: role.isSystem,
            permissions: role.permissions || [],
        })),
        teams: teams.map((team) => ({
            id: team.publicId,
            name: team.name,
            description: team.description,
            color: team.color,
            createdBy: team.createdBy,
            createdAt: team.createdAt,
            memberIds: membersByTeam.get(team.publicId) || [],
        })),
    };
}

async function buildVersionsSummaryBlock(projectId) {
    const [approvals, changeRequests, crVersions] = await Promise.all([
        UploadApproval.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('publicId projectId documentId packageId originalName mimeType size versionGroupId versionNumber versionLabel versionDescription isNewVersion status reviewedBy reviewedAt rejectionReason approvedAt uploaderId createdAt updatedAt')
            .lean(),
        ChangeRequest.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('publicId crId title status priority description createdBy createdAt updatedAt')
            .lean(),
        CRVersion.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean(),
    ]);
    const crMap = new Map(changeRequests.map((cr) => [cr.publicId, cr]));

    return {
        approvals,
        crVersions: crVersions.map((version) => ({
            ...version,
            changeRequest: crMap.get(version.crId) || null,
        })),
        changeRequests,
    };
}

async function buildTasksListBlock(projectId, userId, packageId = null) {
    const member = await ProjectMember.findOne({ projectId, userId }).lean();
    if (!member) return { items: [] };

    const baseQuery = { projectId };
    if (packageId) {
        baseQuery.packageId = packageId;
    } else {
        baseQuery.$or = [
            { packageId: null },
            { packageId: '' },
            { packageId: { $exists: false } },
        ];
    }

    const tasks = await Task.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(100)
        .select('publicId projectId packageId title description priority status tags commentsCount attachmentsCount dueDate assigneeId assigneeIds reviewerIds linkedUrl affectedModels')
        .lean();

    let crMap = new Map();
    const crIds = [...new Set(
        tasks
            .map((task) => {
                const linkedUrl = String(task.linkedUrl || '');
                const match = linkedUrl.match(/^cr:([a-zA-Z0-9-]+)$/);
                return match ? match[1] : '';
            })
            .filter(Boolean)
    )];

    if (crIds.length > 0) {
        const crs = await ChangeRequest.find({ publicId: { $in: crIds } })
            .select('publicId title crId')
            .lean();
        crMap = new Map(crs.map((cr) => [cr.publicId, cr]));
    }

    return {
        items: tasks.map((task) => {
            const linkedUrl = String(task.linkedUrl || '');
            const match = linkedUrl.match(/^cr:([a-zA-Z0-9-]+)$/);
            const cr = match ? crMap.get(match[1]) : null;
            return {
                id: task.publicId,
                title: task.title || 'Untitled task',
                description: task.description || '',
                priority: task.priority || 'medium',
                status: task.status || 'backlog',
                tags: Array.isArray(task.tags) ? task.tags : [],
                linkedItem: linkedUrl
                    ? { type: 'link', name: cr?.title || cr?.crId || match?.[1] || linkedUrl, crId: match?.[1] || undefined }
                    : undefined,
                comments: Number(task.commentsCount || 0),
                attachments: Number(task.attachmentsCount || 0),
                dueDate: task.dueDate || '',
                assigneeId: String(task.assigneeId || ''),
                assigneeIds: Array.isArray(task.assigneeIds) ? task.assigneeIds : [],
                reviewerIds: Array.isArray(task.reviewerIds) ? task.reviewerIds : [],
                projectId,
                affectedModels: Array.isArray(task.affectedModels) ? task.affectedModels : [],
            };
        }),
    };
}

async function buildChangesListBlock(projectId) {
    const changeRequests = await ChangeRequest.find({ projectId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    return {
        items: changeRequests.map((cr) => ({
            ...cr,
            affectedModels: Array.isArray(cr.affectedModels) ? cr.affectedModels : [],
            assignedTo: Array.isArray(cr.assignedTo) ? cr.assignedTo : [],
            reviewers: Array.isArray(cr.reviewers) ? cr.reviewers : [],
            attachments: Array.isArray(cr.attachments) ? cr.attachments : [],
            linkedTaskIds: Array.isArray(cr.linkedTaskIds) ? cr.linkedTaskIds : [],
            affectedDocuments: Array.isArray(cr.affectedDocuments) ? cr.affectedDocuments : [],
            derivedPackageIds: Array.isArray(cr.derivedPackageIds) ? cr.derivedPackageIds : [],
            resultAttachments: Array.isArray(cr.resultAttachments) ? cr.resultAttachments : [],
        })),
    };
}

async function buildChangesMetaBlock(projectId) {
    const [disciplines, members] = await Promise.all([
        mongoose.model('Discipline').find({ projectId }).sort({ createdAt: 1 }).lean(),
        ProjectMember.find({ projectId, status: 'accepted' }).sort({ createdAt: 1 }).lean(),
    ]);

    const userIds = [...new Set(members.map((member) => normalizeString(member.userId)).filter(Boolean))];
    const users = userIds.length > 0
        ? await User.find({ _id: { $in: userIds } }).select('_id fullName email avatar').lean()
        : [];
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    return {
        disciplines: disciplines.map((discipline) => ({
            id: discipline.publicId,
            name: discipline.name,
            description: discipline.description,
            color: discipline.color,
            createdBy: discipline.createdBy,
            createdAt: discipline.createdAt,
            updatedAt: discipline.updatedAt,
        })),
        teamMembers: members.map((member) => {
            const user = userMap.get(normalizeString(member.userId));
            return {
                publicId: member.publicId,
                userId: member.userId,
                role: member.role,
                status: member.status,
                invitedBy: member.invitedBy,
                createdAt: member.createdAt,
                user: user
                    ? {
                        fullName: user.fullName,
                        email: user.email,
                        avatar: user.avatar || null,
                    }
                    : undefined,
            };
        }),
    };
}

function buildDocumentsTree({ docs, folders, rootName = 'All Files', rootId = 'root', versionCounts = new Map() }) {
    const treeMap = new Map();
    treeMap.set(rootId, {
        id: rootId,
        name: rootName,
        type: 'folder',
        children: [],
    });

    const ensureFolderNode = (parentKey, name, fullKey) => {
        if (treeMap.has(fullKey)) return treeMap.get(fullKey);
        const node = {
            id: fullKey,
            name,
            type: 'folder',
            icon: 'folder',
            children: [],
        };
        treeMap.set(fullKey, node);
        treeMap.get(parentKey).children.push(node);
        return node;
    };

    const resolveFolderChain = (folderPath = '') => {
        if (!folderPath) return rootId;
        const segments = String(folderPath)
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean);

        let parentKey = rootId;
        let currentPath = rootId;
        for (const segment of segments) {
            currentPath = `${currentPath}/${segment}`;
            ensureFolderNode(parentKey, segment, currentPath);
            parentKey = currentPath;
        }
        return parentKey;
    };

    for (const folder of folders || []) {
        resolveFolderChain(folder.folderPath || '');
    }

    const latestByVersionGroup = new Map();
    for (const doc of docs || []) {
        const versionGroupId = doc.versionGroupId || doc.publicId;
        const existing = latestByVersionGroup.get(versionGroupId);
        if (!existing || Number(doc.versionNumber || 0) > Number(existing.versionNumber || 0)) {
            latestByVersionGroup.set(versionGroupId, doc);
        }
    }

    for (const doc of latestByVersionGroup.values()) {
        const parentKey = resolveFolderChain(doc.folderPath || '');
        const versionGroupId = doc.versionGroupId || doc.publicId;
        treeMap.get(parentKey).children.push({
            id: doc.publicId,
            name: doc.originalName,
            type: 'file',
            category: doc.mimeType?.startsWith('image/') ? 'Image' : 'File',
            size: `${Math.round((doc.size || 0) / 1024)} KB`,
            updatedAt: doc.updatedAt,
            author: doc.uploadedBy,
            mimeType: doc.mimeType || '',
            folderPath: doc.folderPath || '',
            s3Key: doc.s3Key,
            s3Url: doc.s3Url,
            versionNumber: doc.versionNumber || 1,
            versionLabel: doc.versionLabel || '',
            versionDescription: doc.versionDescription || '',
            versionGroupId,
            versionId: doc.publicId,
            versionCount: versionCounts.get(versionGroupId) || 1,
            conversionStatus: doc.conversionStatus || 'NOT_SUPPORTED',
            conversionError: doc.conversionError || '',
            isIfc: /\.ifc$/i.test(doc.originalName || ''),
            approvalStatus: doc.approvalStatus || 'approved',
        });
    }

    return treeMap.get(rootId);
}

async function buildDocumentsTreeBlock(projectId, packageId = null) {
    const [docs, folders] = packageId
        ? await Promise.all([
            DocumentRepository.listByProjectAndPackage(projectId, packageId),
            DocumentFolderRepository.listByProjectAndPackage(projectId, packageId),
        ])
        : await Promise.all([
            DocumentRepository.listByProject(projectId),
            DocumentFolderRepository.listByProject(projectId),
        ]);

    const approvedDocs = (docs || []).filter((doc) => doc.approvalStatus !== 'pending' && doc.approvalStatus !== 'rejected');
    const versionGroupIds = [...new Set(approvedDocs.map((doc) => doc.versionGroupId || doc.publicId))];
    const versionCounts = await DocumentRepository.countVersionsByVersionGroupIds(versionGroupIds);

    const rootId = packageId ? `root/pkg/${packageId}` : 'root';
    const rootName = packageId ? 'Package Files' : 'All Files';

    return {
        tree: buildDocumentsTree({
            docs: approvedDocs,
            folders,
            rootId,
            rootName,
            versionCounts,
        }),
    };
}

async function loadUsersByIds(authorIds = []) {
    const uniqueIds = [...new Set(authorIds.map((id) => normalizeString(id)).filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    const users = await User.find({ _id: { $in: uniqueIds } }).select('_id publicId fullName email avatar').lean();
    return new Map(users.map((user) => [String(user._id), user]));
}

async function buildTaskCommentsBlock(projectId, taskId) {
    const comments = await TaskComment.find({ projectId, taskId }).sort({ createdAt: -1 }).lean();
    const userMap = await loadUsersByIds(comments.map((comment) => comment.authorId));

    return {
        items: comments.map((comment) => {
            const user = userMap.get(String(comment.authorId));
            return {
                id: String(comment.publicId || comment._id),
                authorId: String(comment.authorId || ''),
                authorName: String(user?.fullName || user?.email || 'Unknown'),
                avatar: user?.avatar || null,
                content: String(comment.content || ''),
                createdAt: String(comment.createdAt || ''),
                updatedAt: comment.updatedAt ? String(comment.updatedAt) : undefined,
                isEdited: Boolean(comment.isEdited),
            };
        }),
    };
}

async function buildChangeRequestCommentsBlock(projectId, crId) {
    const comments = await CRComment.find({ projectId, crId }).sort({ createdAt: -1 }).lean();
    const userMap = await loadUsersByIds(comments.map((comment) => comment.authorId));

    return {
        items: comments.map((comment) => {
            const user = userMap.get(String(comment.authorId));
            return {
                id: String(comment.publicId || comment._id),
                authorId: String(comment.authorId || ''),
                authorName: String(user?.fullName || user?.email || 'Unknown'),
                avatar: user?.avatar || null,
                content: String(comment.content || ''),
                createdAt: String(comment.createdAt || ''),
                updatedAt: comment.updatedAt ? String(comment.updatedAt) : undefined,
                isEdited: Boolean(comment.isEdited),
            };
        }),
    };
}

async function buildApprovalCommentsBlock(projectId, approvalId) {
    const comments = await UploadApprovalComment.find({ projectId, approvalId }).sort({ createdAt: -1 }).lean();
    const userMap = await loadUsersByIds(comments.map((comment) => comment.authorId));

    return {
        items: comments.map((comment) => {
            const user = userMap.get(String(comment.authorId));
            return {
                id: String(comment.publicId || comment._id),
                authorId: String(user?.publicId || ''),
                authorName: String(user?.fullName || user?.email || 'Unknown'),
                avatar: user?.avatar || null,
                content: String(comment.content || ''),
                createdAt: String(comment.createdAt || ''),
                updatedAt: comment.updatedAt ? String(comment.updatedAt) : undefined,
                isEdited: Boolean(comment.isEdited),
            };
        }),
    };
}

const blockBuilders = {
    'packages:summary': async ({ projectId, userId }) => buildPackagesSummaryBlock(projectId, userId),
    'activity:feed': async ({ projectId, packageId }) => buildActivityFeedBlock(projectId, packageId || null),
    'teams:roster': async ({ projectId }) => buildTeamsRosterBlock(projectId),
    'versions:summary': async ({ projectId }) => buildVersionsSummaryBlock(projectId),
    'tasks:list': async ({ projectId, userId, packageId }) => buildTasksListBlock(projectId, userId, packageId || null),
    'changes:list': async ({ projectId }) => buildChangesListBlock(projectId),
    'changes:meta': async ({ projectId }) => buildChangesMetaBlock(projectId),
    'documents:tree': async ({ projectId, packageId }) => buildDocumentsTreeBlock(projectId, packageId || null),
};

async function getProjectBlockSnapshot({ projectId, scope, blockId, userId, packageId = null }) {
    const key = `${scope}:${blockId}`;
    const builder = blockBuilders[key];
    let data;
    if (builder) {
        data = await builder({ projectId, scope, blockId, userId, packageId });
    } else if (scope === 'tasks' && blockId.startsWith('comments:task:')) {
        data = await buildTaskCommentsBlock(projectId, blockId.replace('comments:task:', ''));
    } else if (scope === 'changes' && blockId.startsWith('comments:change-request:')) {
        data = await buildChangeRequestCommentsBlock(projectId, blockId.replace('comments:change-request:', ''));
    } else if (scope === 'versions' && blockId.startsWith('comments:approval:')) {
        data = await buildApprovalCommentsBlock(projectId, blockId.replace('comments:approval:', ''));
    } else {
        return null;
    }

    return {
        projectId,
        scope,
        blockId,
        data,
        updatedAt: Date.now(),
    };
}

module.exports = {
    getProjectBlockSnapshot,
};
