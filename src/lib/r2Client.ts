import axios from 'axios';

/**
 * Handles secure, pre-signed URL processing for direct binary uploads to Cloudflare R2.
 * Bypasses sending heavy payloads through the core server architecture.
 */
export async function uploadAssetToR2(
  presignedUrl: string, 
  file: File, 
  onProgress: (progress: number) => void
): Promise<boolean> {
  try {
    const response = await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? file.size)
        );
        onProgress(percentCompleted);
      }
    });
    return response.status === 200;
  } catch (error) {
    console.error('R2 Binary Target Upload Failure:', error);
    return false;
  }
}
