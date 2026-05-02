/**
 * Report Controller
 * Handles report data retrieval and file export (PDF, CSV, XLSX).
 */
const ReportService = require('../services/reportService');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const Project = require('../models/Project');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLib, rgb } = require('pdf-lib');
const fontkit = require('fontkit');
const XLSX = require('xlsx');
const { format } = require('date-fns');
const fs = require('fs');

const errorResponse = (res, status, message) =>
    res.status(status).json({ success: false, message });

class ReportController {
    /**
     * Verify the requesting user has access to the project.
     * Allows: project owner, Admin, Manager (high access), or Member (medium access).
     * Rejects: Viewer (minimal access).
     */
    async _verifyAccess(projectId, userId) {
        // Owner always has access
        const project = await Project.findOne({ publicId: projectId }).select('ownerId').lean();
        if (project && project.ownerId === userId) return true;

        // Check project membership role
        const member = await ProjectMemberRepository.findMember(projectId, userId);
        if (!member) return false;

        const highAccessRoles = ['owner', 'admin', 'manager'];
        const allowedRoles = ['owner', 'admin', 'manager', 'member'];
        if (!allowedRoles.includes(member.role)) return false;
        return true;
    }

    /**
     * GET /api/projects/:projectId/reports
     * Returns the aggregated report data (JSON) for preview.
     */
    async getReport(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const projectId = req.params.projectId;
            if (!projectId) return errorResponse(res, 400, 'Project ID is required');

            const hasAccess = await this._verifyAccess(projectId, userId);
            if (!hasAccess) return errorResponse(res, 403, 'You do not have permission to export reports');

            const reportData = await ReportService.getProjectReportData(projectId);
            return res.json({ success: true, data: reportData });
        } catch (err) {
            console.error('[ReportController] getReport error:', err);
            return errorResponse(res, 500, 'Failed to generate report data');
        }
    }

    /**
     * POST /api/projects/:projectId/reports/export
     * Body: { format: 'pdf' | 'csv' | 'xlsx' }
     * Returns a file download.
     */
    async exportReport(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const projectId = req.params.projectId;
            if (!projectId) return errorResponse(res, 400, 'Project ID is required');

            const format = (req.body?.format || 'pdf').toLowerCase();
            if (!['pdf', 'csv', 'xlsx'].includes(format)) {
                return errorResponse(res, 400, 'Invalid format. Supported: pdf, csv, xlsx');
            }

            const hasAccess = await this._verifyAccess(projectId, userId);
            if (!hasAccess) return errorResponse(res, 403, 'You do not have permission to export reports');

            const reportData = await ReportService.getProjectReportData(projectId);

            if (format === 'pdf') {
                return await this._exportPDF(res, reportData);
            } else if (format === 'csv') {
                return this._exportCSV(res, reportData);
            } else {
                return this._exportXLSX(res, reportData);
            }
        } catch (err) {
            console.error('[ReportController] exportReport error:', err);
            return errorResponse(res, 500, 'Failed to export report');
        }
    }

    _exportPDF(res, data) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const chunks = [];
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
                doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

                const projectName = data.project?.name || 'Project Report';
                const generatedAt = data.generatedAt
                    ? format(new Date(data.generatedAt), 'dd MMM yyyy, HH:mm')
                    : new Date().toLocaleString('en-GB');
                const accentColor = '#155DFC';

                // ── Header (fixed position at top of first page) ─────────
                doc.rect(0, 0, doc.page.width, 90).fill(accentColor);
                doc.fillColor('#ffffff')
                    .fontSize(22).font('Arial-Bold')
                    .text('Project Report', 50, 28, { lineBreak: false });
                doc.font('Arial').fontSize(11).text(projectName, 50, 54);
                doc.fontSize(9).text(`Generated: ${generatedAt}`, 50, 72);
                doc.moveDown(3);

                // ── Summary Section ──────────────────────────────────────
                doc.fillColor('#101828').fontSize(14).font('Arial-Bold').text('Summary');
                doc.moveDown(0.5);
                const summary = data.summary || {};
                const summaryRows = [
                    ['Total Documents & Drawings', `${summary.totalDocuments} (${summary.totalSizeMB} MB)`],
                    ['Total Tasks', String(summary.totalTasks)],
                    ['Completed Tasks', String(summary.completedTasks)],
                    ['Pending Tasks', String(summary.pendingTasks)],
                    ['Project Progress', `${summary.progressPercent}%`],
                    ['Total Packages', String(summary.totalPackages)],
                ];
                for (const [label, value] of summaryRows) {
                    const rowY = doc.y;
                    doc.fillColor('#374151').fontSize(10).font('Arial').text(label, 50, rowY);
                    doc.fillColor('#101828').font('Arial-Bold').text(value, 270, rowY);
                    doc.moveDown(1);
                }
                doc.moveDown(1);

                // ── Task Count by Status ─────────────────────────────────
                doc.fillColor('#101828').fontSize(14).font('Arial-Bold').text('Task Count by Status');
                doc.moveDown(0.5);
                const taskStatuses = data.taskCountByStatus || {};
                const statusColors = {
                    backlog: '#6A7280', 'to-do': '#155DFC', 'in-progress': '#F59E0B',
                    review: '#8B5CF6', done: '#10B981',
                };
                for (const [status, count] of Object.entries(taskStatuses)) {
                    const rowY = doc.y;
                    const color = statusColors[status] || '#374151';
                    const displayStatus = status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    doc.fillColor(color).fontSize(10).font('Arial-Bold').text(displayStatus, 50, rowY);
                    doc.fillColor('#101828').font('Arial').text(String(count), 270, rowY);
                    doc.moveDown(1);
                }
                doc.moveDown(1);

                // ── Progress Over Time ───────────────────────────────────
                doc.fillColor('#101828').fontSize(14).font('Arial-Bold').text('Project Progress Over Time');
                doc.moveDown(0.5);
                const progressData = data.progressOverTime || [];
                if (progressData.length > 0) {
                    const headerY = doc.y;
                    doc.fillColor('#6A7282').fontSize(9).font('Arial-Bold')
                        .text('Month', 50, headerY)
                        .text('Tasks Created', 200, headerY)
                        .text('Tasks Completed', 330, headerY);
                    const lineY = doc.y;
                    doc.strokeColor('#E5E7EB').lineWidth(0.5)
                        .moveTo(50, lineY).lineTo(460, lineY).stroke();
                    doc.moveDown(0.5);
                    for (const row of progressData) {
                        const rowY = doc.y;
                        doc.fillColor('#374151').fontSize(9).font('Arial')
                            .text(row.month, 50, rowY)
                            .text(String(row.created), 200, rowY)
                            .text(String(row.completed), 330, rowY);
                        doc.moveDown(1);
                    }
                } else {
                    doc.fillColor('#6A7282').fontSize(10).font('Arial')
                        .text('No progress data available.');
                }
                doc.moveDown(1);

                // ── Recent Activities ──────────────────────────────────────
                doc.fillColor('#101828').fontSize(14).font('Arial-Bold').text('Recent Activities');
                doc.moveDown(0.5);
                const activities = data.recentActivities || [];
                if (activities.length > 0) {
                    doc.strokeColor('#E5E7EB').lineWidth(0.5)
                        .moveTo(50, doc.y).lineTo(460, doc.y).stroke();
                    doc.moveDown(0.5);
                    for (const act of activities) {
                        const ts = act.timestamp ? format(new Date(act.timestamp), 'dd/MM HH:mm') : '';
                        doc.fillColor('#6A7282').fontSize(8).font('Arial').text(ts, 50);
                        doc.fillColor('#374151').fontSize(9).font('Arial')
                            .text(`${act.description || act.type}`, 110, undefined, { width: 350 });
                        doc.moveDown(0.5);
                    }
                } else {
                    doc.fillColor('#6A7282').fontSize(10).font('Arial')
                        .text('No recent activities.');
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        }).then(async (pdfBuffer) => {
            // Phase 2: post-process with pdf-lib to add footers on every page
            const pdfDoc = await PDFLib.load(pdfBuffer);
            const pages = pdfDoc.getPages();
            const totalPages = pages.length;

            const fontBytes = fs.readFileSync('C:\\Windows\\Fonts\\arial.ttf');
            pdfDoc.registerFontkit(fontkit);
            const font = await pdfDoc.embedFont(fontBytes);

            for (let i = 0; i < totalPages; i++) {
                const { width } = pages[i].getSize();
                const gray = 0.61;

                pages[i].drawText(`SSOrbit — Confidential`, {
                    x: 50, y: 20, size: 8, font, color: rgb(gray, gray, gray),
                });
                pages[i].drawText(`Page ${i + 1} of ${totalPages}`, {
                    x: width - 90, y: 20, size: 8, font, color: rgb(gray, gray, gray),
                });
            }

            const finalBuffer = await pdfDoc.save();
            const filename = `project-report-${(data.project?.name || 'export').replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(finalBuffer);
        });
    }

    _exportCSV(res, data) {
        const rows = [];

        // Summary
        rows.push(['PROJECT REPORT']);
        rows.push(['Project', data.project?.name || '']);
        rows.push(['Generated At', data.generatedAt ? format(new Date(data.generatedAt), 'yyyy-MM-dd HH:mm:ss') : '']);
        rows.push([]);

        rows.push(['SUMMARY']);
        rows.push(['Metric', 'Value']);
        const summary = data.summary || {};
        rows.push(['Total Documents & Drawings', summary.totalDocuments || 0]);
        rows.push(['Total Size (MB)', summary.totalSizeMB || 0]);
        rows.push(['Total Tasks', summary.totalTasks || 0]);
        rows.push(['Completed Tasks', summary.completedTasks || 0]);
        rows.push(['Pending Tasks', summary.pendingTasks || 0]);
        rows.push(['Progress (%)', summary.progressPercent || 0]);
        rows.push(['Total Packages', summary.totalPackages || 0]);
        rows.push([]);

        rows.push(['TASK COUNT BY STATUS']);
        rows.push(['Status', 'Count']);
        for (const [status, count] of Object.entries(data.taskCountByStatus || {})) {
            rows.push([status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count]);
        }
        rows.push([]);

        rows.push(['PROGRESS OVER TIME']);
        rows.push(['Month', 'Tasks Created', 'Tasks Completed']);
        for (const row of (data.progressOverTime || [])) {
            rows.push([row.month, row.created, row.completed]);
        }
        rows.push([]);

        rows.push(['RECENT ACTIVITIES']);
        rows.push(['Timestamp', 'User', 'Action', 'Target']);
        for (const act of (data.recentActivities || [])) {
            rows.push([
                act.timestamp ? format(new Date(act.timestamp), 'yyyy-MM-dd HH:mm') : '',
                act.user || '',
                act.description || act.type || '',
                act.target || '',
            ]);
        }

        const csvContent = rows.map(row =>
            row.map(cell => {
                const str = String(cell ?? '');
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        ).join('\n');

        const filename = `project-report-${data.project?.name || 'export'}-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);
    }

    _exportXLSX(res, data) {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryRows = [
            ['Metric', 'Value'],
            ['Total Documents & Drawings', data.summary?.totalDocuments || 0],
            ['Total Size (MB)', data.summary?.totalSizeMB || 0],
            ['Total Tasks', data.summary?.totalTasks || 0],
            ['Completed Tasks', data.summary?.completedTasks || 0],
            ['Pending Tasks', data.summary?.pendingTasks || 0],
            ['Progress (%)', data.summary?.progressPercent || 0],
            ['Total Packages', data.summary?.totalPackages || 0],
            ['Generated At', data.generatedAt ? format(new Date(data.generatedAt), 'yyyy-MM-dd HH:mm:ss') : ''],
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
        summaryWs['!cols'] = [{ wch: 35 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // Sheet 2: Tasks by Status
        const taskRows = [['Status', 'Count']];
        for (const [status, count] of Object.entries(data.taskCountByStatus || {})) {
            taskRows.push([status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count]);
        }
        const taskWs = XLSX.utils.aoa_to_sheet(taskRows);
        taskWs['!cols'] = [{ wch: 25 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, taskWs, 'Tasks by Status');

        // Sheet 3: Progress Over Time
        const progressRows = [['Month', 'Tasks Created', 'Tasks Completed']];
        for (const row of (data.progressOverTime || [])) {
            progressRows.push([row.month, row.created, row.completed]);
        }
        const progressWs = XLSX.utils.aoa_to_sheet(progressRows);
        progressWs['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, progressWs, 'Progress Over Time');

        // Sheet 4: Recent Activities
        const actRows = [['Timestamp', 'User', 'Description', 'Target']];
        for (const act of (data.recentActivities || [])) {
            actRows.push([
                act.timestamp ? format(new Date(act.timestamp), 'yyyy-MM-dd HH:mm') : '',
                act.user || '',
                act.description || act.type || '',
                act.target || '',
            ]);
        }
        const actWs = XLSX.utils.aoa_to_sheet(actRows);
        actWs['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, actWs, 'Recent Activities');

        const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const filename = `project-report-${data.project?.name || 'export'}-${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(xlsxBuffer);
    }
}

module.exports = new ReportController();
