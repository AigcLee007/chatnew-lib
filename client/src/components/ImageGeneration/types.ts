import type { ReferenceImage } from 'librechat-data-provider';

export type ReferenceUpload = ReferenceImage & {
  id: string;
  name: string;
};
