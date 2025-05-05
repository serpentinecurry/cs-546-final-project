// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: 'scholario',
  api_key: '684564274524472',
  api_secret: 'yvCVvxizrPgHPAANwHDKFksxLU8'
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'absenceProofs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    upload_preset: 'ml_default', // <-- Add this
    public_id: (req, file) => `${Date.now()}-${file.originalname}`
  }
});

export { cloudinary, storage };
