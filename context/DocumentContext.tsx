import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ProcessedDocument } from '../types';
import { useAuth } from './AuthContext';
import { useClient } from './ClientContext';
import {
  saveDocument,
  getDocumentsByClient,
  updateDocument,
  deleteDocument as deleteDocumentFromDb,
} from '../services/documentService';

type DocumentContextValue = {
  documents: ProcessedDocument[];
  loading: boolean;
  error: string | null;
  addDocument: (document: ProcessedDocument) => Promise<void>;
  updateDocumentData: (documentId: string, updates: Partial<ProcessedDocument>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
};

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentClient } = useClient();
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const uid = user?.uid;
    const clientId = currentClient?.id;
    
    if (!uid || !clientId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const docs = await getDocumentsByClient(uid, clientId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, currentClient?.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback(
    async (document: ProcessedDocument) => {
      const uid = user?.uid;
      const clientId = currentClient?.id;
      
      if (!uid || !clientId) {
        throw new Error('User or client not found');
      }

      try {
        const docId = await saveDocument(uid, clientId, document);
        const newDoc = { ...document, id: docId, clientId, userId: uid };
        setDocuments((prev) => [newDoc, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [user?.uid, currentClient?.id]
  );

  const updateDocumentData = useCallback(
    async (documentId: string, updates: Partial<ProcessedDocument>) => {
      try {
        await updateDocument(documentId, updates);
        setDocuments((prev) =>
          prev.map((doc) => (doc.id === documentId ? { ...doc, ...updates } : doc))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    []
  );

  const deleteDocument = useCallback(async (documentId: string) => {
    try {
      await deleteDocumentFromDb(documentId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const value: DocumentContextValue = {
    documents,
    loading,
    error,
    addDocument,
    updateDocumentData,
    deleteDocument,
    refreshDocuments: fetchDocuments,
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentProvider');
  return ctx;
}
