import libraries from 'quiz:typescript-libs';
import { createTypeScriptService } from './typescript-service.js';

const services = new Map();
self.onmessage = ({ data }) => {
  try {
    if (!services.has(data.language)) services.set(data.language, createTypeScriptService(libraries, data.language));
    self.postMessage({ id: data.id, result: services.get(data.language)(data) });
  } catch {
    self.postMessage({ id: data.id, error: true });
  }
};
