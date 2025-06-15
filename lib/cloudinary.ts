import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
}

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  [key: string]: any;
}

export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<CloudinaryResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto',
      },
      (error, result: CloudinaryUploadResult | undefined) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else if (!result) {
          reject(new Error('No result from Cloudinary upload'));
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id
          });
        }
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    bufferStream.pipe(uploadStream);
  });
}

export default cloudinary; 