const axios = require('axios');

const DISCORD_COLORS = {
    task_created: 0x22C55E,
    task_updated: 0x3B82F6,
    task_deleted: 0xEF4444,
    task_moved: 0x8B5CF6,
    task_commented: 0x06B6D4,
    folder_created: 0xF59E0B,
    folder_renamed: 0xEAB308,
    folder_deleted: 0xDC2626,
    file_uploaded: 0x10B981,
    file_renamed: 0xF59E0B,
    file_deleted: 0xEF4444,
};

const ACTION_LABELS = {
    task_created: 'created a new task',
    task_updated: 'updated a task',
    task_deleted: 'deleted a task',
    task_moved: 'moved a task to',
    task_commented: 'commented on a task',
    folder_created: 'created a folder',
    folder_renamed: 'renamed a folder',
    folder_deleted: 'deleted a folder',
    file_uploaded: 'uploaded a file',
    file_renamed: 'renamed a file',
    file_deleted: 'deleted a file',
};

const DiscordService = {
    async sendWebhook(webhookUrl, { projectName, userName, type, targetName, metadata = {} }) {
        if (!webhookUrl) return;

        const color = DISCORD_COLORS[type] || 0x6B7280;
        const actionLabel = ACTION_LABELS[type] || type;
        const timestamp = new Date().toISOString();

        let description = `**${userName}** ${actionLabel}`;
        if (targetName) {
            description = `**${userName}** ${actionLabel}: **${targetName}**`;
        }
        if (metadata.stageFrom && metadata.stageTo) {
            description = `**${userName}** moved task **${targetName}** from *${metadata.stageFrom}* to *${metadata.stageTo}*`;
        }
        if (metadata.newValue) {
            description = `**${userName}** ${actionLabel}: **${targetName}** — *${metadata.newValue}*`;
        }

        const fields = [];
        if (metadata.taskStatus) {
            fields.push({ name: 'Status', value: metadata.taskStatus, inline: true });
        }
        if (metadata.priority) {
            fields.push({ name: 'Priority', value: metadata.priority, inline: true });
        }
        if (metadata.assignees) {
            fields.push({ name: 'Assignees', value: metadata.assignees, inline: false });
        }
        if (metadata.packageName) {
            fields.push({ name: 'Package', value: metadata.packageName, inline: true });
        }

        const embed = {
            title: `SSOrbit — ${projectName}`,
            description,
            color,
            author: {
                name: userName,
                icon_url: 'https://i.imgur.com/AfFp7pu.png',
            },
            footer: {
                text: 'SSOrbit',
            },
            timestamp,
            fields: fields.length > 0 ? fields : undefined,
        };

        try {
            await axios.post(webhookUrl, { embeds: [embed] }, {
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (err) {
            console.error('[DiscordService] Failed to send webhook:', err.message);
        }
    },
};

module.exports = DiscordService;
