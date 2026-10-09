export type ValuationPhoto = {
  id: string;
  url: string;
};

export type PresignedUpload = {
  id: string;
  upload_url: string;
  content_type: 'image/webp' | 'image/jpeg' | 'image/png';
  expires_in_seconds: number;
};
