import apiClient from './client';
import { Contact, ImportResult, ApiResponse } from '../types';

export const contactsApi = {
  // Upload contact list file (Excel/CSV)
  uploadContactList: async (campaignId: string, file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaignId', campaignId);

    const response = await apiClient.post<ApiResponse<ImportResult>>(
      `/campaigns/${campaignId}/contacts/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.data.data) {
      throw new Error('Failed to upload contact list');
    }

    return response.data.data;
  },

  // Get contacts for a campaign
  getContacts: async (campaignId: string): Promise<Contact[]> => {
    const response = await apiClient.get<ApiResponse<Contact[]>>(
      `/campaigns/${campaignId}/contacts`
    );
    return response.data.data || [];
  },

  // Delete a contact
  deleteContact: async (campaignId: string, contactId: string): Promise<void> => {
    await apiClient.delete(`/campaigns/${campaignId}/contacts/${contactId}`);
  },
};
