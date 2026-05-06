/**
 * Workflow Template API Service
 */
import { apiFetch } from './api-client';

export interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  color?: 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red';
}

export interface WorkflowTemplate {
  publicId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  stages: WorkflowStage[];
  authorId: string;
  authorName: string;
  isPrivate: boolean;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  isDownloaded?: boolean;
  isDownloadedCopy?: boolean;
  installedPublicId?: string;
  sourcePublicId?: string | null;
  originalDownloads?: number;
}

interface PaginatedResponse<T> {
  templates: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

class WorkflowTemplateService {
  private baseUrl = '/api/workflow-templates';

  // Get all public templates (library)
  async getTemplates(params?: {
    page?: number;
    limit?: number;
    search?: string;
    tags?: string[];
    category?: string;
    sort?: 'popular' | 'rating' | 'recent';
  }): Promise<PaginatedResponse<WorkflowTemplate>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
    if (params?.category) searchParams.set('category', params.category);
    if (params?.sort) searchParams.set('sort', params.sort);

    const query = searchParams.toString();
    const res = await apiFetch(`${this.baseUrl}${query ? `?${query}` : ''}`);
    const json: ApiResponse<PaginatedResponse<WorkflowTemplate>> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to fetch templates');
    return json.data;
  }

  // Get user's own templates
  async getMyTemplates(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<WorkflowTemplate>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const res = await apiFetch(`${this.baseUrl}/my${query ? `?${query}` : ''}`);
    const json: ApiResponse<PaginatedResponse<WorkflowTemplate>> = await res.json();

    if (!res.ok) throw new Error(json.message || 'Failed to fetch my templates');
    
    // Add isDownloadedCopy flag from repository response
    json.data.templates = json.data.templates.map(t => ({
      ...t,
      isDownloadedCopy: (t as any).isDownloadedCopy || false,
    }));
    
    return json.data;
  }

  // Get templates that user has downloaded (copied from others)
  async getDownloadedTemplates(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<WorkflowTemplate>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const res = await apiFetch(`${this.baseUrl}/downloaded${query ? `?${query}` : ''}`);
    const json: ApiResponse<PaginatedResponse<WorkflowTemplate>> = await res.json();

    if (!res.ok) throw new Error(json.message || 'Failed to fetch downloaded templates');
    
    // Mark all downloaded templates as downloaded copies
    json.data.templates = json.data.templates.map(t => ({
      ...t,
      isDownloadedCopy: true,
    }));
    
    return json.data;
  }

  // Get single template
  async getTemplate(publicId: string): Promise<WorkflowTemplate> {
    const res = await apiFetch(`${this.baseUrl}/${publicId}`);
    const json: ApiResponse<WorkflowTemplate> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to fetch template');
    return json.data;
  }

  // Create new template
  async createTemplate(data: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    stages: WorkflowStage[];
    isPrivate?: boolean;
  }): Promise<WorkflowTemplate> {
    const res = await apiFetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json: ApiResponse<WorkflowTemplate> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to create template');
    return json.data;
  }

  // Update template
  async updateTemplate(
    publicId: string,
    data: Partial<{
      name: string;
      description: string;
      category: string;
      tags: string[];
      stages: WorkflowStage[];
      isPrivate: boolean;
    }>
  ): Promise<WorkflowTemplate> {
    const res = await apiFetch(`${this.baseUrl}/${publicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json: ApiResponse<WorkflowTemplate> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to update template');
    return json.data;
  }

  // Delete template
  async deleteTemplate(publicId: string): Promise<void> {
    const res = await apiFetch(`${this.baseUrl}/${publicId}`, {
      method: 'DELETE',
    });
    const json: ApiResponse<null> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to delete template');
  }

  // Use template (increment downloads, optional rating)
  async useTemplate(publicId: string, rating?: number): Promise<WorkflowTemplate> {
    const res = await apiFetch(`${this.baseUrl}/${publicId}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rating ? { rating } : {}),
    });
    const json: ApiResponse<WorkflowTemplate> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to use template');
    return json.data;
  }

  // Copy template to user's templates
  async copyTemplate(publicId: string): Promise<WorkflowTemplate> {
    const res = await apiFetch(`${this.baseUrl}/copy/${publicId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const json: ApiResponse<WorkflowTemplate> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to copy template');
    return json.data;
  }

  // Get all available tags
  async getTags(): Promise<string[]> {
    const res = await apiFetch(`${this.baseUrl}/tags`);
    const json: ApiResponse<string[]> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to fetch tags');
    return json.data;
  }

  // Get all categories
  async getCategories(): Promise<string[]> {
    const res = await apiFetch(`${this.baseUrl}/categories`);
    const json: ApiResponse<string[]> = await res.json();
    
    if (!res.ok) throw new Error(json.message || 'Failed to fetch categories');
    return json.data;
  }
}

export const workflowTemplateService = new WorkflowTemplateService();
