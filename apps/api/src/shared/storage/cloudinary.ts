import { v2 as cloudinary } from 'cloudinary';

import { env } from '../../config/env';
import { AppError } from '../errors/app-error';

const isCloudinaryConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface CloudinaryUploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowedFormats: string;
}

export function createMarketplaceUploadSignature(input: { tenantId: string; userId: string }): CloudinaryUploadSignature {
  return createScopedUploadSignature({ ...input, scope: 'marketplace' });
}

export function createComplaintUploadSignature(input: { tenantId: string; userId: string }): CloudinaryUploadSignature {
  return createScopedUploadSignature({ ...input, scope: 'complaints' });
}

export function createLostFoundUploadSignature(input: { tenantId: string; userId: string }): CloudinaryUploadSignature {
  return createScopedUploadSignature({ ...input, scope: 'lost-found' });
}
export function createChatUploadSignature(input: { tenantId: string; userId: string }): CloudinaryUploadSignature {
  return createScopedUploadSignature({ ...input, scope: 'chat' });
}

export function createMarketplaceImageUrl(publicId: string): string {
  return createImageUrl(publicId);
}

export function createComplaintImageUrl(publicId: string): string {
  return createImageUrl(publicId);
}

export function createLostFoundImageUrl(publicId: string): string {
  return createImageUrl(publicId);
}
export function createChatImageUrl(publicId: string): string {
  return createImageUrl(publicId);
}

export function isMarketplaceAssetOwnedByUser(publicId: string, input: { tenantId: string; userId: string }): boolean {
  return isScopedAssetOwnedByUser(publicId, { ...input, scope: 'marketplace' });
}

export function isComplaintAssetOwnedByUser(publicId: string, input: { tenantId: string; userId: string }): boolean {
  return isScopedAssetOwnedByUser(publicId, { ...input, scope: 'complaints' });
}

export function isLostFoundAssetOwnedByUser(publicId: string, input: { tenantId: string; userId: string }): boolean {
  return isScopedAssetOwnedByUser(publicId, { ...input, scope: 'lost-found' });
}
export function isChatAssetOwnedByUser(publicId: string, input: { tenantId: string; userId: string }): boolean {
  return isScopedAssetOwnedByUser(publicId, { ...input, scope: 'chat' });
}

function createScopedUploadSignature(input: { tenantId: string; userId: string; scope: MediaScope }): CloudinaryUploadSignature {
  ensureConfigured();
  const timestamp = Math.floor(Date.now() / 1_000);
  const folder = getAssetFolder(input);
  const allowedFormats = 'jpg,jpeg,png,webp';
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, overwrite: false, unique_filename: true, allowed_formats: allowedFormats },
    env.CLOUDINARY_API_SECRET as string,
  );

  return {
    timestamp,
    signature,
    apiKey: env.CLOUDINARY_API_KEY as string,
    cloudName: env.CLOUDINARY_CLOUD_NAME as string,
    folder,
    allowedFormats,
  };
}

function createImageUrl(publicId: string): string {
  ensureConfigured();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'image',
    fetch_format: 'auto',
    quality: 'auto',
  });
}

function isScopedAssetOwnedByUser(publicId: string, input: { tenantId: string; userId: string; scope: MediaScope }): boolean {
  return publicId.startsWith(`${getAssetFolder(input)}/`);
}

function getAssetFolder(input: { tenantId: string; userId: string; scope: MediaScope }): string {
  return `campusconnect/${input.tenantId}/${input.scope}/${input.userId}`;
}

type MediaScope = 'marketplace' | 'complaints' | 'lost-found' | 'chat';

function ensureConfigured(): void {
  if (!isCloudinaryConfigured) {
    throw new AppError({
      statusCode: 503,
      code: 'MEDIA_STORAGE_UNAVAILABLE',
      message: 'Image uploads are not configured for this environment.',
    });
  }
}
