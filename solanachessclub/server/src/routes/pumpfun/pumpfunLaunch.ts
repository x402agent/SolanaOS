import {Router} from 'express';
import multer from 'multer';
import {UploadMetadataController} from '../../controllers/uploadMetadataController';

// We store uploads in ./uploads by default
const upload = multer({ storage: multer.memoryStorage() });

const launchRouter = Router();

launchRouter.post(
  '/uploadMetadata',
  upload.single('image'),
  UploadMetadataController,
);

export {launchRouter};
