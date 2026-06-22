import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

let qdrantClient: QdrantClient | null = null;

export const getQdrantClient = () => {
  if (!qdrantClient) {
    if (process.env.QDRANT_URL && process.env.QDRANT_API_KEY) {
      qdrantClient = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
      });
    } else {
      console.warn('Qdrant variables not set. Vector search will be disabled.');
    }
  }
  return qdrantClient;
};

export const COLLECTION_NAME = 'repolens_chunks';

export const initQdrant = async () => {
  const client = getQdrantClient();
  if (!client) return;

  try {
    let exists = false;
    try {
        const response = await client.collectionExists(COLLECTION_NAME);
        exists = typeof response === 'boolean' ? response : response?.exists;
    } catch (e: any) {
        if (e.message && e.message.includes('Not Found')) {
            exists = false;
        } else {
            // some other error
            throw e;
        }
    }
    
    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 768, // Gemini Text Embedding dimension
          distance: 'Cosine',
        },
      });
      console.log(`Created Qdrant collection: ${COLLECTION_NAME}`);
    } else {
      console.log(`Qdrant collection ${COLLECTION_NAME} exists.`);
    }

    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'repoId',
        field_schema: 'keyword',
        wait: true,
      });
      console.log(`Ensured Payload index for repoId`);
    } catch (indexError) {
      // It might already exist, which is fine
      console.log(`Index for repoId might already exist or failed:`, indexError);
    }

    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'filePath',
        field_schema: 'keyword',
        wait: true,
      });
      console.log(`Ensured Payload index for filePath`);
    } catch (indexError) {
      console.log(`Index for filePath might already exist or failed:`, indexError);
    }
  } catch (error) {
    console.error('Failed to initialize Qdrant:', error);
  }
};
