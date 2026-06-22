export type ViewState = 'auth' | 'dashboard' | 'progress' | 'overview' | 'architecture' | 'chat' | 'files' | 'flows' | 'interview' | 'docs' | 'settings';

export interface User {
  _id: string;
  name: string;
  email: string;
}
